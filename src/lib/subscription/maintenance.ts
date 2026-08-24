import { prisma } from '@/lib/prisma'
import { businessDateOnly } from '@/lib/subscription/date-utils'
import { autoCheckOutStaleSessions } from '@/lib/subscription/session-manager'

export async function expireOverdueSubscriptions(today: Date = businessDateOnly(), subscriberId?: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endDate: { lt: today }, ...(subscriberId ? { subscriberId } : {}) },
    select: { id: true, subscriberId: true, planType: true, endDate: true },
  })
  if (!subscriptions.length) return 0

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.updateMany({
      where: { id: { in: subscriptions.map((item) => item.id) }, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    })
    await tx.subscriptionAuditLog.createMany({
      data: subscriptions.map((item) => ({
        action: 'AUTO_EXPIRE_SUBSCRIPTION',
        entityType: 'SUBSCRIPTION',
        entityId: item.id,
        performedBy: 'system',
        details: { subscriberId: item.subscriberId, planType: item.planType, endDate: item.endDate?.toISOString() },
      })),
    })
    return updated.count
  })
}

export async function runSubscriptionMaintenance() {
  const [expired, autoCheckouts] = await Promise.all([
    expireOverdueSubscriptions(),
    autoCheckOutStaleSessions(),
  ])
  return { expired, autoCheckouts: autoCheckouts.length }
}
