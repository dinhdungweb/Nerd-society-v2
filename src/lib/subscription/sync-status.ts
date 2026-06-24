import { prisma } from '@/lib/prisma'
import { updateEmployeeStatus } from '@/lib/mytime-api'
import { businessDateOnly } from '@/lib/subscription/date-utils'

const MIN_WALLET_BALANCE = 3750

function activeSubscriptionWhere(today: Date) {
    return {
        status: 'ACTIVE' as const,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
    }
}

export async function expireOverdueSubscriptions(today: Date = businessDateOnly(), subscriberId?: string) {
    const overdueSubscriptions = await prisma.subscription.findMany({
        where: {
            status: 'ACTIVE',
            endDate: { lt: today },
            ...(subscriberId ? { subscriberId } : {}),
        },
        select: {
            id: true,
            subscriberId: true,
            planType: true,
            endDate: true,
        },
    })

    if (overdueSubscriptions.length === 0) return 0

    const result = await prisma.subscription.updateMany({
        where: {
            status: 'ACTIVE',
            id: { in: overdueSubscriptions.map((subscription) => subscription.id) },
        },
        data: { status: 'EXPIRED' },
    })

    if (result.count > 0) {
        await prisma.subscriptionAuditLog.createMany({
            data: overdueSubscriptions.map((subscription) => ({
                action: 'AUTO_EXPIRE_SUBSCRIPTION',
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                performedBy: 'system',
                details: {
                    subscriberId: subscription.subscriberId,
                    planType: subscription.planType,
                    endDate: subscription.endDate?.toISOString().slice(0, 10),
                    expiredBefore: today.toISOString().slice(0, 10),
                },
            })),
        })

        console.log(`[SyncStatus] Expired ${result.count} overdue subscription(s) before ${today.toISOString().slice(0, 10)}`)
    }

    return result.count
}

export async function syncAllSubscribersStatus() {
    console.log('[SyncStatus] Starting global status synchronization...')
    const today = businessDateOnly()
    const expiredSubscriptions = await expireOverdueSubscriptions(today)

    const subscribers = await prisma.subscriber.findMany({
        where: {
            mytimeEmpId: { not: null },
        },
        include: {
            subscriptions: {
                where: activeSubscriptionWhere(today),
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            user: {
                select: {
                    wallet: { select: { balance: true } },
                },
            },
        },
    })

    const results = {
        total: subscribers.length,
        activated: 0,
        locked: 0,
        errors: 0,
        expiredSubscriptions,
    }

    for (const sub of subscribers) {
        try {
            const hasActiveSub = sub.subscriptions.length > 0
            const hasWalletBalance = (sub.user?.wallet?.balance || 0) >= MIN_WALLET_BALANCE
            const isSubActive = sub.status === 'ACTIVE'

            const shouldBeActive = isSubActive && (hasActiveSub || hasWalletBalance)
            const targetStatus = shouldBeActive ? 'ACTIVE' : 'LOCKED'

            await updateEmployeeStatus(sub.mytimeEmpId!, targetStatus)

            if (shouldBeActive) results.activated += 1
            else results.locked += 1
        } catch (error) {
            console.error(`[SyncStatus] Failed to sync status for ${sub.mytimeEmpId}:`, error)
            results.errors += 1
        }
    }

    console.log('[SyncStatus] Synchronization completed:', results)
    return results
}

export async function syncSubscriberStatus(subscriberId: string) {
    const today = businessDateOnly()
    await expireOverdueSubscriptions(today, subscriberId)

    const sub = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        include: {
            subscriptions: {
                where: activeSubscriptionWhere(today),
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            user: {
                select: {
                    wallet: { select: { balance: true } },
                },
            },
        },
    })

    if (!sub || !sub.mytimeEmpId) return

    const hasActiveSub = sub.subscriptions.length > 0
    const hasWalletBalance = (sub.user?.wallet?.balance || 0) >= MIN_WALLET_BALANCE
    const isSubActive = sub.status === 'ACTIVE'

    const shouldBeActive = isSubActive && (hasActiveSub || hasWalletBalance)
    const targetStatus = shouldBeActive ? 'ACTIVE' : 'LOCKED'

    return updateEmployeeStatus(sub.mytimeEmpId, targetStatus)
}
