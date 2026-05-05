import { prisma } from '@/lib/prisma'
import { updateEmployeeStatus } from '@/lib/mytime-api'

const MIN_WALLET_BALANCE = 3750

export async function syncAllSubscribersStatus() {
    console.log('[SyncStatus] Starting global status synchronization...')

    const subscribers = await prisma.subscriber.findMany({
        where: {
            mytimeEmpId: { not: null },
        },
        include: {
            subscriptions: {
                where: { status: 'ACTIVE' },
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
    const sub = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        include: {
            subscriptions: {
                where: { status: 'ACTIVE' },
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
