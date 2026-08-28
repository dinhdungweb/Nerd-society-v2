import { prisma } from '@/lib/prisma'
import { businessDateOnly, formatBusinessDate } from '@/lib/subscription/date-utils'
import { ensureMembershipQrCredentialInTx } from '@/lib/subscription/qr-credential'
import { Prisma, type PlanType } from '@prisma/client'

export const PLAN_HOURS_MIN: Record<PlanType, number> = {
  WEEKLY_LIMITED: 15 * 60,
  MONTHLY_LIMITED: 0,
  MONTHLY_UNLIMITED: 0,
}

export const PLAN_DURATION_DAYS: Record<PlanType, number> = {
  WEEKLY_LIMITED: 7,
  MONTHLY_LIMITED: 30,
  MONTHLY_UNLIMITED: 30,
}

export function getPlanEndDate(startDate: Date, planType: PlanType) {
  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + PLAN_DURATION_DAYS[planType] - 1)
  return endDate
}

export function nextRegistrationOrderCode(now: Date, latestOrderCode?: string | null) {
  const datePart = formatBusinessDate(now).replace(/-/g, '')
  const prefix = `MB-${datePart}-`
  const latestSuffix = latestOrderCode ? Number(latestOrderCode.slice(prefix.length)) : 0
  if (!Number.isSafeInteger(latestSuffix) || latestSuffix < 0 || latestSuffix >= 999) {
    throw new Error(`Đã đạt giới hạn 999 đơn Monthly Beaver trong ngày ${datePart}`)
  }
  return `${prefix}${String(latestSuffix + 1).padStart(3, '0')}`
}

export async function createRegistrationOrderWithCode(
  data: Omit<Prisma.RegistrationOrderUncheckedCreateInput, 'orderCode'>,
  now: Date = new Date()
) {
  const datePart = formatBusinessDate(now).replace(/-/g, '')
  const prefix = `MB-${datePart}-`

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly-beaver-order:${datePart}`}))`

    const latest = await tx.registrationOrder.findFirst({
      where: { orderCode: { startsWith: prefix } },
      orderBy: { orderCode: 'desc' },
      select: { orderCode: true },
    })
    const orderCode = nextRegistrationOrderCode(now, latest?.orderCode)
    return tx.registrationOrder.create({ data: { ...data, orderCode } })
  })
}

export async function processRenewalSubscriptionInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentRef: string | null,
  activatedAt: Date = new Date()
) {
  const order = await tx.registrationOrder.findUnique({ where: { id: orderId } })
  if (!order || !order.subscriberId || !['PAID', 'ACTIVATED'].includes(order.orderStatus)) return null

  const subscriber = await tx.subscriber.findUnique({ where: { id: order.subscriberId } })
  if (!subscriber) return null

  const totalMin = PLAN_HOURS_MIN[order.planType]
  const today = businessDateOnly(activatedAt)
  await tx.subscription.updateMany({
    where: { subscriberId: subscriber.id, status: 'ACTIVE', endDate: { lt: today } },
    data: { status: 'EXPIRED' },
  })
  const currentSubscription = await tx.subscription.findFirst({
    where: {
      subscriberId: subscriber.id,
      status: 'ACTIVE',
      endDate: { gte: today },
    },
    orderBy: { endDate: 'desc' },
  })

  if (currentSubscription) {
    if (currentSubscription.planType !== order.planType) {
      throw new Error('Chi co the gia han dung goi dang su dung khi goi hien tai chua het han')
    }

    const endDate = new Date(currentSubscription.endDate!)
    endDate.setUTCDate(endDate.getUTCDate() + PLAN_DURATION_DAYS[order.planType])
    const subscription = await tx.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        endDate,
        ...(totalMin > 0 ? { totalHoursMin: { increment: totalMin } } : {}),
        paymentMethod: order.paymentMethod,
        paymentRef,
      },
    })

    await tx.registrationOrder.update({
      where: { id: order.id },
      data: {
        subscriptionId: subscription.id,
        orderStatus: 'ACTIVATED',
        assignedBy: 'system',
        assignedAt: activatedAt,
      },
    })
    await tx.subscriptionAuditLog.create({
      data: {
        action: 'renewal_subscription_extended',
        entityType: 'registration_order',
        entityId: order.id,
        performedBy: 'system',
        details: {
          credential: 'qr',
          planType: order.planType,
          subscriptionId: subscription.id,
          previousEndDate: currentSubscription.endDate,
          newEndDate: endDate,
        },
      },
    })
    return subscription
  }

  const startDate = businessDateOnly(activatedAt)
  const endDate = getPlanEndDate(startDate, order.planType)
  const subscription = await tx.subscription.create({
    data: {
      subscriberId: subscriber.id,
      planType: order.planType,
      pricePaid: order.amount,
      status: 'ACTIVE',
      activationDate: activatedAt,
      startDate,
      endDate,
      totalHoursMin: totalMin > 0 ? totalMin : null,
      dailyLimitMin: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'].includes(order.planType) ? 480 : null,
      paymentMethod: order.paymentMethod,
      paymentRef,
    },
  })

  await tx.registrationOrder.update({
    where: { id: order.id },
    data: {
      subscriptionId: subscription.id,
      orderStatus: 'ACTIVATED',
      assignedBy: 'system',
      assignedAt: activatedAt,
    },
  })
  await tx.subscriptionAuditLog.create({
    data: {
      action: 'renewal_subscription_activated',
      entityType: 'registration_order',
      entityId: order.id,
      performedBy: 'system',
      details: {
        credential: 'qr',
        planType: order.planType,
        subscriptionId: subscription.id,
        activationPolicy: 'payment_confirmed',
        startDate,
        endDate,
      },
    },
  })
  return subscription
}

async function activateNewRegistrationInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentRef: string | null,
  activatedAt: Date,
  performedBy: string
): Promise<'REGISTERED' | 'RENEWED'> {
  const order = await tx.registrationOrder.findUniqueOrThrow({ where: { id: orderId } })
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly-beaver-subscriber:${order.userId || order.phone}`}))`

  const [byUser, byPhone] = await Promise.all([
    order.userId
      ? tx.subscriber.findUnique({ where: { userId: order.userId } })
      : Promise.resolve(null),
    tx.subscriber.findUnique({ where: { phone: order.phone } }),
  ])
  if (byUser && byPhone && byUser.id !== byPhone.id) {
    throw new Error('Tài khoản và số điện thoại đang thuộc hai hồ sơ Monthly Beaver khác nhau')
  }

  const existingSubscriber = byUser || byPhone
  if (existingSubscriber) {
    if (order.userId && existingSubscriber.userId && existingSubscriber.userId !== order.userId) {
      throw new Error('Số điện thoại đã thuộc một tài khoản Monthly Beaver khác')
    }
    if (existingSubscriber.outstandingBalance > 0) {
      throw new Error(`Còn công nợ ${existingSubscriber.outstandingBalance.toLocaleString('vi-VN')}đ; không thể kích hoạt gói`)
    }
    await tx.subscriber.update({
      where: { id: existingSubscriber.id },
      data: {
        fullName: order.fullName,
        email: order.email,
        photoUrl: order.selfieUrl,
        branchPrimary: order.branchPrimary,
        ...(order.userId && !existingSubscriber.userId ? { userId: order.userId } : {}),
      },
    })
    await tx.registrationOrder.update({
      where: { id: order.id },
      data: { subscriberId: existingSubscriber.id },
    })
    await processRenewalSubscriptionInTx(tx, order.id, paymentRef, activatedAt)
    await ensureMembershipQrCredentialInTx(tx, existingSubscriber.id)
    return 'RENEWED'
  }

  const subscriber = await tx.subscriber.create({
    data: {
      fullName: order.fullName,
      phone: order.phone,
      email: order.email,
      photoUrl: order.selfieUrl,
      branchPrimary: order.branchPrimary,
      userId: order.userId,
    },
  })
  const startDate = businessDateOnly(activatedAt)
  const endDate = getPlanEndDate(startDate, order.planType)
  const totalMin = PLAN_HOURS_MIN[order.planType]
  const subscription = await tx.subscription.create({
    data: {
      subscriberId: subscriber.id,
      planType: order.planType,
      pricePaid: order.amount,
      status: 'ACTIVE',
      activationDate: activatedAt,
      startDate,
      endDate,
      totalHoursMin: totalMin > 0 ? totalMin : null,
      dailyLimitMin: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'].includes(order.planType) ? 480 : null,
      paymentMethod: order.paymentMethod,
      paymentRef,
    },
  })
  await ensureMembershipQrCredentialInTx(tx, subscriber.id)
  await tx.registrationOrder.update({
    where: { id: order.id },
    data: {
      orderStatus: 'ACTIVATED',
      subscriberId: subscriber.id,
      subscriptionId: subscription.id,
      assignedBy: performedBy,
      assignedAt: activatedAt,
    },
  })
  await tx.subscriptionAuditLog.create({
    data: {
      action: 'registration_auto_activated',
      entityType: 'registration_order',
      entityId: order.id,
      performedBy,
      details: {
        subscriberId: subscriber.id,
        subscriptionId: subscription.id,
        credential: 'qr',
        activationPolicy: 'payment_confirmed',
        startDate,
        endDate,
      },
    },
  })
  return 'REGISTERED'
}

type SettlementOrder = Prisma.RegistrationOrderGetPayload<{
  include: { subscriber: { select: { outstandingBalance: true } } }
}>

export type RegistrationOrderSettlementResult = {
  outcome: 'SETTLED' | 'ALREADY_SETTLED' | 'EXPIRED'
  order: SettlementOrder
  isRenewal: boolean
  activationKind: 'REGISTERED' | 'RENEWED' | null
}

export async function settleRegistrationOrderInTx(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string
    paidAt: Date
    paymentRef: string | null
    paymentMethod?: string
    performedBy: string
    auditAction: string
  }
): Promise<RegistrationOrderSettlementResult> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly-beaver-settlement:${input.orderId}`}))`

  let order = await tx.registrationOrder.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { subscriber: { select: { outstandingBalance: true } } },
  })
  let isRenewal = Boolean(order.subscriberId)
  let activationKind: RegistrationOrderSettlementResult['activationKind'] = null

  if (order.orderStatus === 'ACTIVATED' || order.orderStatus === 'PAID') {
    if (order.orderStatus === 'PAID' && !order.subscriptionId) {
      if (isRenewal) {
        await processRenewalSubscriptionInTx(tx, order.id, input.paymentRef, input.paidAt)
        await ensureMembershipQrCredentialInTx(tx, order.subscriberId!)
        activationKind = 'RENEWED'
      } else {
        activationKind = await activateNewRegistrationInTx(
          tx,
          order.id,
          input.paymentRef,
          input.paidAt,
          input.performedBy
        )
        isRenewal = activationKind === 'RENEWED'
      }
      order = await tx.registrationOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { subscriber: { select: { outstandingBalance: true } } },
      })
    }
    return { outcome: 'ALREADY_SETTLED', order, isRenewal, activationKind }
  }

  if (order.orderStatus !== 'PENDING_PAYMENT') {
    throw new Error(`Don hang khong the thanh toan o trang thai ${order.orderStatus}`)
  }

  if (order.expiresAt && input.paidAt > order.expiresAt) {
    order = await tx.registrationOrder.update({
      where: { id: order.id },
      data: { orderStatus: 'ORDER_EXPIRED' },
      include: { subscriber: { select: { outstandingBalance: true } } },
    })
    await tx.subscriptionAuditLog.create({
      data: {
        action: 'order_expired_on_payment',
        entityType: 'registration_order',
        entityId: order.id,
        performedBy: input.performedBy,
        details: { paidAt: input.paidAt, expiresAt: order.expiresAt, paymentRef: input.paymentRef },
      },
    })
    return { outcome: 'EXPIRED', order, isRenewal, activationKind: null }
  }

  if (isRenewal && (order.subscriber?.outstandingBalance || 0) > 0) {
    throw new Error(`Con cong no ${order.subscriber!.outstandingBalance.toLocaleString('vi-VN')}d; khong the gia han`)
  }

  order = await tx.registrationOrder.update({
    where: { id: order.id },
    data: {
      orderStatus: 'PAID',
      paidAt: input.paidAt,
      paymentRef: input.paymentRef,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    },
    include: { subscriber: { select: { outstandingBalance: true } } },
  })
  await tx.subscriptionAuditLog.create({
    data: {
      action: input.auditAction,
      entityType: 'registration_order',
      entityId: order.id,
      performedBy: input.performedBy,
      details: { paymentRef: input.paymentRef, orderCode: order.orderCode, amount: order.amount },
    },
  })

  if (isRenewal) {
    await processRenewalSubscriptionInTx(tx, order.id, input.paymentRef, input.paidAt)
    await ensureMembershipQrCredentialInTx(tx, order.subscriberId!)
    activationKind = 'RENEWED'
  } else {
    activationKind = await activateNewRegistrationInTx(
      tx,
      order.id,
      input.paymentRef,
      input.paidAt,
      input.performedBy
    )
    isRenewal = activationKind === 'RENEWED'
  }

  if (activationKind) {
    order = await tx.registrationOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { subscriber: { select: { outstandingBalance: true } } },
    })
  }

  return { outcome: 'SETTLED', order, isRenewal, activationKind }
}
