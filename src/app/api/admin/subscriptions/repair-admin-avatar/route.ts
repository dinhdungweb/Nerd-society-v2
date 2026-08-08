import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const TARGET_ORDER_CODE = 'MB-20260805-005'

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
        select: { id: true, selfieUrl: true, subscriberId: true },
      })
      if (!order) throw new Error('Không tìm thấy đơn Phạm Vân Anh')

      const repairAudit = await tx.subscriptionAuditLog.findFirst({
        where: {
          action: 'subscriber_assignment_repaired',
          entityId: order.id,
        },
        orderBy: { createdAt: 'desc' },
      })
      const repairDetails = repairAudit?.details as { fromSubscriberId?: unknown } | null
      const adminSubscriberId =
        typeof repairDetails?.fromSubscriberId === 'string' ? repairDetails.fromSubscriberId : null
      if (!adminSubscriberId) throw new Error('Không tìm thấy subscriber Admin Nerd từ audit sửa dữ liệu')

      const adminSubscriber = await tx.subscriber.findUnique({
        where: { id: adminSubscriberId },
        include: { user: { select: { avatar: true } } },
      })
      if (!adminSubscriber) throw new Error('Không tìm thấy subscriber Admin Nerd')

      const previousAdminOrder = await tx.registrationOrder.findFirst({
        where: {
          subscriberId: adminSubscriber.id,
          id: { not: order.id },
        },
        orderBy: { assignedAt: 'desc' },
        select: { selfieUrl: true },
      })

      const restorePhotoUrl = adminSubscriber.user?.avatar || previousAdminOrder?.selfieUrl || null
      if (!restorePhotoUrl) throw new Error('Không tìm thấy avatar cũ để khôi phục cho Admin Nerd')

      const plan = {
        sourceSubscriber: adminSubscriber.fullName,
        currentPhotoIsVanAnhSelfie: adminSubscriber.photoUrl === order.selfieUrl,
        restoreFromUserAvatar: Boolean(adminSubscriber.user?.avatar),
        restoreFromPreviousOrder: !adminSubscriber.user?.avatar && Boolean(previousAdminOrder?.selfieUrl),
        targetSubscriberUnchanged: order.subscriberId,
      }

      if (adminSubscriber.photoUrl === restorePhotoUrl) {
        return { alreadyRepaired: true, plan }
      }

      if (dryRun) return { dryRun: true, plan }

      await tx.subscriber.update({
        where: { id: adminSubscriber.id },
        data: { photoUrl: restorePhotoUrl },
      })

      await tx.subscriptionAuditLog.create({
        data: {
          action: 'subscriber_avatar_repaired',
          entityType: 'subscriber',
          entityId: adminSubscriber.id,
          performedBy: 'production_repair',
          details: { sourceOrderCode: TARGET_ORDER_CODE },
        },
      })

      return { repaired: true, plan }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[repair-admin-avatar]', error)
    return NextResponse.json({ success: false, error: error.message || 'Repair failed' }, { status: 500 })
  }
}
