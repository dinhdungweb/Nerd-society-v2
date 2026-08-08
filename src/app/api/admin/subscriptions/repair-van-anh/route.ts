import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const TARGET_ORDER_CODE = 'MB-20260805-005'

function sameContact(
  order: { phone: string; email: string | null },
  subscriber: { phone: string; email: string | null }
) {
  const emailMatches =
    !!order.email && !!subscriber.email && order.email.toLowerCase() === subscriber.email.toLowerCase()
  return order.phone === subscriber.phone || emailMatches
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  const suppliedSecret = request.headers.get('x-repair-secret')

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun !== false

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.registrationOrder.findUnique({
        where: { orderCode: TARGET_ORDER_CODE },
        include: { subscriber: true, subscription: true },
      })

      if (!order || !order.subscriber || !order.subscription || !order.subscriptionId) {
        throw new Error('Không tìm thấy đầy đủ đơn, subscriber và subscription cần sửa')
      }

      if (sameContact(order, order.subscriber)) {
        return {
          alreadyRepaired: true,
          orderCode: order.orderCode,
          subscriberName: order.subscriber.fullName,
        }
      }

      const sourceSubscriber = order.subscriber
      const targetCardNo = order.assignedCardNo || order.subscription.cardAssigned
      if (!targetCardNo || sourceSubscriber.cardNo !== targetCardNo) {
        throw new Error('Thẻ trên đơn không khớp với subscriber đang bị liên kết nhầm')
      }

      const matchingUser = await tx.user.findFirst({
        where: {
          OR: [{ phone: order.phone }, ...(order.email ? [{ email: order.email }] : [])],
        },
        select: { id: true },
      })

      const targetByPhone = await tx.subscriber.findUnique({ where: { phone: order.phone } })
      const targetByUser = matchingUser ? await tx.subscriber.findUnique({ where: { userId: matchingUser.id } }) : null

      if (targetByPhone && targetByUser && targetByPhone.id !== targetByUser.id) {
        throw new Error('Số điện thoại và tài khoản khách đang thuộc hai subscriber khác nhau')
      }

      const existingTarget = targetByPhone || targetByUser
      if (existingTarget?.cardNo && existingTarget.cardNo !== targetCardNo) {
        throw new Error('Subscriber đích đang có một thẻ khác; không tự động ghi đè')
      }

      const previousOrder = await tx.registrationOrder.findFirst({
        where: {
          subscriberId: sourceSubscriber.id,
          id: { not: order.id },
          assignedCardNo: { not: null },
        },
        orderBy: { assignedAt: 'desc' },
      })

      const previousAudit = previousOrder
        ? await tx.subscriptionAuditLog.findFirst({
            where: {
              action: 'card_assigned',
              entityId: previousOrder.id,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null

      const previousDetails = previousAudit?.details as { empId?: unknown } | null
      const previousCardNo = previousOrder?.assignedCardNo || null
      const previousEmpId = typeof previousDetails?.empId === 'string' ? previousDetails.empId : null

      const [previousCardOwner, previousEmpOwner] = await Promise.all([
        previousCardNo ? tx.subscriber.findUnique({ where: { cardNo: previousCardNo } }) : Promise.resolve(null),
        previousEmpId ? tx.subscriber.findUnique({ where: { mytimeEmpId: previousEmpId } }) : Promise.resolve(null),
      ])

      if (previousCardOwner && previousCardOwner.id !== sourceSubscriber.id) {
        throw new Error('Thẻ cũ của subscriber nguồn hiện đã thuộc người khác')
      }
      if (previousEmpOwner && previousEmpOwner.id !== sourceSubscriber.id) {
        throw new Error('Mã MyTime cũ của subscriber nguồn hiện đã thuộc người khác')
      }

      const plan = {
        orderCode: order.orderCode,
        sourceSubscriber: sourceSubscriber.fullName,
        targetSubscriber: order.fullName,
        targetExists: Boolean(existingTarget),
        matchingCustomerUser: Boolean(matchingUser),
        targetCardSuffix: targetCardNo.slice(-4),
        targetMytimeEmpId: sourceSubscriber.mytimeEmpId,
        restoreSourceCardSuffix: previousCardNo?.slice(-4) || null,
        restoreSourceMytimeEmpId: previousEmpId,
        subscriptionStatus: order.subscription.status,
      }

      if (dryRun) return { dryRun: true, plan }

      await tx.subscriber.update({
        where: { id: sourceSubscriber.id },
        data: { cardNo: null, mytimeEmpId: null },
      })

      const targetSubscriber = existingTarget
        ? await tx.subscriber.update({
            where: { id: existingTarget.id },
            data: {
              fullName: order.fullName,
              phone: order.phone,
              email: order.email,
              photoUrl: order.selfieUrl,
              cardNo: targetCardNo,
              mytimeEmpId: sourceSubscriber.mytimeEmpId,
              branchPrimary: order.branchPrimary,
              ...(matchingUser ? { userId: matchingUser.id } : {}),
            },
          })
        : await tx.subscriber.create({
            data: {
              fullName: order.fullName,
              phone: order.phone,
              email: order.email,
              photoUrl: order.selfieUrl,
              cardNo: targetCardNo,
              mytimeEmpId: sourceSubscriber.mytimeEmpId,
              branchPrimary: order.branchPrimary,
              userId: matchingUser?.id || null,
            },
          })

      await tx.subscription.update({
        where: { id: order.subscriptionId },
        data: { subscriberId: targetSubscriber.id },
      })

      await tx.subscriptionSession.updateMany({
        where: { subscriptionId: order.subscriptionId },
        data: { subscriberId: targetSubscriber.id },
      })

      await tx.dailyUsage.updateMany({
        where: { subscriptionId: order.subscriptionId },
        data: { subscriberId: targetSubscriber.id },
      })

      await tx.registrationOrder.update({
        where: { id: order.id },
        data: {
          subscriberId: targetSubscriber.id,
          userId: matchingUser?.id || null,
        },
      })

      await tx.subscriber.update({
        where: { id: sourceSubscriber.id },
        data: {
          cardNo: previousCardNo,
          mytimeEmpId: previousEmpId,
        },
      })

      await tx.subscriptionAuditLog.create({
        data: {
          action: 'subscriber_assignment_repaired',
          entityType: 'registration_order',
          entityId: order.id,
          performedBy: 'production_repair',
          details: {
            orderCode: order.orderCode,
            fromSubscriberId: sourceSubscriber.id,
            toSubscriberId: targetSubscriber.id,
          },
        },
      })

      return {
        repaired: true,
        plan,
        targetSubscriberId: targetSubscriber.id,
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[repair-van-anh]', error)
    return NextResponse.json({ success: false, error: error.message || 'Repair failed' }, { status: 500 })
  }
}
