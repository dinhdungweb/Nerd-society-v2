import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { notifyBookingCancelled } from '@/lib/notifications'

// Configuration
const PENDING_TIMEOUT_MINUTES = 5 // Hủy booking PENDING sau 5 phút

/**
 * GET /api/cron/cancel-pending-bookings
 * Cron job: Auto-cancel PENDING bookings older than 5 minutes
 * 
 * This endpoint should be called by Vercel Cron or external cron service
 */
export async function GET(request: Request) {
    try {
        // Verify cron secret (optional but recommended for security)
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const timeoutThreshold = new Date()
        timeoutThreshold.setMinutes(timeoutThreshold.getMinutes() - PENDING_TIMEOUT_MINUTES)

        // Find pending bookings to cancel
        const bookingsToCancel = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                depositStatus: 'PENDING',
                createdAt: {
                    lt: timeoutThreshold
                }
            },
            select: {
                id: true,
                bookingCode: true,
                customerName: true
            }
        })

        // Cancel each booking and send notification
        for (const booking of bookingsToCancel) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: {
                    status: 'CANCELLED',
                    note: `Tự động hủy do không thanh toán cọc sau ${PENDING_TIMEOUT_MINUTES} phút`
                }
            })

            // Send notification
            notifyBookingCancelled(
                booking.bookingCode,
                booking.customerName || 'Khách',
                booking.id
            ).catch(console.error)
        }

        console.log(`[Cron] Auto-cancelled ${bookingsToCancel.length} pending bookings`)

        return NextResponse.json({
            success: true,
            cancelled: bookingsToCancel.length,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('[Cron] Error cancelling pending bookings:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

