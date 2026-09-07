import { prisma } from '@/lib/prisma'
import { businessDateOnly } from '@/lib/subscription/date-utils'
import { notifyExpiringSubscriptions } from '@/lib/subscription/zalo-notifications'

export async function expireOverdueSubscriptions(today: Date = businessDateOnly(), subscriberId?: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { endDate: { lt: today } },
        { startDate: null, endDate: null, activationDeadline: { lt: today } },
      ],
      ...(subscriberId ? { subscriberId } : {}),
    },
    select: { id: true, subscriberId: true, planType: true, endDate: true, activationDeadline: true },
  })
  if (!subscriptions.length) return 0

  return prisma.$transaction(async (tx) => {
    let expiredCount = 0
    for (const item of subscriptions) {
      const updated = await tx.subscription.updateMany({
        where: {
          id: item.id,
          status: 'ACTIVE',
          ...(item.endDate
            ? { endDate: { lt: today } }
            : { startDate: null, endDate: null, activationDeadline: { lt: today } }),
        },
        data: { status: 'EXPIRED' },
      })
      if (!updated.count) continue

      expiredCount += 1
      await tx.subscriptionAuditLog.create({
        data: {
          action: 'AUTO_EXPIRE_SUBSCRIPTION',
          entityType: 'SUBSCRIPTION',
          entityId: item.id,
          performedBy: 'system',
          details: {
            subscriberId: item.subscriberId,
            planType: item.planType,
            endDate: item.endDate?.toISOString(),
            activationDeadline: item.activationDeadline?.toISOString(),
            reason: item.endDate ? 'term_expired' : 'activation_window_expired',
          },
        },
      })
    }
    return expiredCount
  })
}

export async function expireOverdueRegistrationOrders(now: Date = new Date()) {
  const orders = await prisma.registrationOrder.findMany({
    where: { orderStatus: 'PENDING_PAYMENT', expiresAt: { lt: now } },
    select: { id: true, orderCode: true, expiresAt: true },
  })
  if (!orders.length) return 0

  return prisma.$transaction(async (tx) => {
    let expiredCount = 0
    for (const order of orders) {
      const updated = await tx.registrationOrder.updateMany({
        where: { id: order.id, orderStatus: 'PENDING_PAYMENT', expiresAt: { lt: now } },
        data: { orderStatus: 'ORDER_EXPIRED' },
      })
      if (!updated.count) continue
      expiredCount += 1
      await tx.subscriptionAuditLog.create({
        data: {
          action: 'AUTO_EXPIRE_REGISTRATION_ORDER',
          entityType: 'REGISTRATION_ORDER',
          entityId: order.id,
          performedBy: 'system',
          details: { orderCode: order.orderCode, expiresAt: order.expiresAt?.toISOString() },
        },
      })
    }
    return expiredCount
  })
}

export async function runSubscriptionMaintenance() {
  const [expired, expiredOrders, expiringNotifications] = await Promise.all([
    expireOverdueSubscriptions(),
    expireOverdueRegistrationOrders(),
    notifyExpiringSubscriptions(),
  ])
  return { expired, expiredOrders, autoCheckouts: 0, expiringNotifications }
}
