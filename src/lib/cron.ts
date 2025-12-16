import { prisma } from '@/lib/prisma'
import cron from 'node-cron'

const PENDING_TIMEOUT_MINUTES = 5

/**
 * Cancel pending bookings that haven't been paid within 5 minutes
 */
async function cancelPendingBookings() {
    try {
        const timeoutThreshold = new Date()
        timeoutThreshold.setMinutes(timeoutThreshold.getMinutes() - PENDING_TIMEOUT_MINUTES)

        const result = await prisma.booking.updateMany({
            where: {
                status: 'PENDING',
                depositStatus: 'PENDING',
                createdAt: {
                    lt: timeoutThreshold
                }
            },
            data: {
                status: 'CANCELLED',
                note: `Tự động hủy do không thanh toán cọc sau ${PENDING_TIMEOUT_MINUTES} phút`
            }
        })

        if (result.count > 0) {
            console.log(`[Cron] Auto-cancelled ${result.count} pending bookings at ${new Date().toISOString()}`)
        }
    } catch (error) {
        console.error('[Cron] Error cancelling pending bookings:', error)
    }
}

let isScheduled = false

/**
 * Initialize cron job - runs every minute
 * Should be called once when the server starts
 */
export function initCronJobs() {
    if (isScheduled) {
        console.log('[Cron] Jobs already scheduled, skipping...')
        return
    }

    // Run every minute
    cron.schedule('* * * * *', () => {
        cancelPendingBookings()
    })

    isScheduled = true
    console.log('[Cron] Booking cleanup job scheduled - runs every minute')

    // Run once immediately on startup
    cancelPendingBookings()
}
