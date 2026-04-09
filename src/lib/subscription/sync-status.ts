import { prisma } from '@/lib/prisma';
import { updateEmployeeStatus } from '@/lib/mytime-api';

/**
 * Đồng bộ trạng thái của tất cả hội viên sang máy chấm công MyTime
 */
export async function syncAllSubscribersStatus() {
    console.log('[SyncStatus] Starting global status synchronization...');
    
    const subscribers = await prisma.subscriber.findMany({
        where: {
            mytimeEmpId: { not: null }
        },
        include: {
            subscriptions: {
                where: { status: 'ACTIVE' },
                take: 1
            }
        }
    });

    const results = {
        total: subscribers.length,
        activated: 0,
        locked: 0,
        errors: 0
    };

    for (const sub of subscribers) {
        try {
            const hasActiveSub = sub.subscriptions.length > 0;
            const hasWalletBalance = sub.walletBalance >= 3750; // Đủ 15 phút
            const isSubActive = sub.status === 'ACTIVE';

            const shouldBeActive = isSubActive && (hasActiveSub || hasWalletBalance);
            const targetStatus = shouldBeActive ? 'ACTIVE' : 'LOCKED';

            await updateEmployeeStatus(sub.mytimeEmpId!, targetStatus);
            
            if (shouldBeActive) results.activated++;
            else results.locked++;

            // Optional: Log status change if needed
        } catch (error) {
            console.error(`[SyncStatus] Failed to sync status for ${sub.mytimeEmpId}:`, error);
            results.errors++;
        }
    }

    console.log('[SyncStatus] Synchronization completed:', results);
    return results;
}

/**
 * Đồng bộ trạng thái cho 1 hội viên cụ thể
 */
export async function syncSubscriberStatus(subscriberId: string) {
    const sub = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        include: {
            subscriptions: {
                where: { status: 'ACTIVE' },
                take: 1
            }
        }
    });

    if (!sub || !sub.mytimeEmpId) return;

    const hasActiveSub = sub.subscriptions.length > 0;
    const hasWalletBalance = sub.walletBalance >= 3750;
    const isSubActive = sub.status === 'ACTIVE';

    const shouldBeActive = isSubActive && (hasActiveSub || hasWalletBalance);
    const targetStatus = shouldBeActive ? 'ACTIVE' : 'LOCKED';

    return updateEmployeeStatus(sub.mytimeEmpId, targetStatus);
}
