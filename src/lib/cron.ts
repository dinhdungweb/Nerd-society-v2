import { prisma } from '@/lib/prisma'
import { notifyOvertime, notifyEndingSoon } from '@/lib/notifications'
import cron from 'node-cron'
import { differenceInMinutes, parse, format } from 'date-fns'

const PENDING_TIMEOUT_MINUTES = 5
const ENDING_SOON_MINUTES = 15 // Cảnh báo 15 phút trước khi hết giờ
const OVERTIME_NOTIFICATION_INTERVAL = 15 // Thông báo lại mỗi 15 phút khi quá giờ

/**
 * Cancel pending bookings that haven't been paid within 5 minutes
 * Only cancels bookings where paymentStartedAt is set (customer has selected payment method)
 */
async function cancelPendingBookings() {
    try {
        const timeoutThreshold = new Date()
        timeoutThreshold.setMinutes(timeoutThreshold.getMinutes() - PENDING_TIMEOUT_MINUTES)

        const result = await prisma.booking.updateMany({
            where: {
                status: 'PENDING',
                depositStatus: 'PENDING',
                // Only cancel if payment process has started (customer selected payment method)
                paymentStartedAt: {
                    not: null,
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

/**
 * Helper: Parse booking time string (HH:mm) to Date object based on booking date
 */
function getBookingEndTime(bookingDate: Date, endTimeStr: string): Date {
    const [hours, minutes] = endTimeStr.split(':').map(Number)
    const endTime = new Date(bookingDate)
    endTime.setHours(hours, minutes, 0, 0)
    return endTime
}

/**
 * Check for bookings that are IN_PROGRESS and overtime or ending soon
 */
async function checkOvertimeBookings() {
    try {
        const now = new Date()

        // Get all IN_PROGRESS bookings (no date filter - IN_PROGRESS status is sufficient)
        const inProgressBookings = await prisma.booking.findMany({
            where: {
                status: 'IN_PROGRESS',
            },
            include: {
                room: { select: { name: true } },
            },
        })

        console.log(`[Cron] Checking ${inProgressBookings.length} in-progress bookings at ${now.toLocaleTimeString('vi-VN')}`)

        for (const booking of inProgressBookings) {
            // Combine booking date with end time
            const scheduledEnd = getBookingEndTime(booking.date, booking.endTime)
            const minutesDiff = differenceInMinutes(now, scheduledEnd)

            if (minutesDiff > 0) {
                // Booking is OVERTIME
                // Check if we already sent an overtime notification recently for this booking (within last 15 mins)
                const recentNotification = await prisma.notification.findFirst({
                    where: {
                        bookingId: booking.id,
                        title: { contains: 'quá giờ' },
                        createdAt: {
                            gte: new Date(now.getTime() - OVERTIME_NOTIFICATION_INTERVAL * 60 * 1000),
                        },
                    },
                })

                // Send notification if no recent one exists
                if (!recentNotification) {
                    await notifyOvertime(
                        booking.bookingCode,
                        booking.customerName,
                        booking.room.name,
                        minutesDiff,
                        booking.id
                    )
                    console.log(`[Cron] Overtime alert: ${booking.bookingCode} is ${minutesDiff} minutes over`)
                }
            } else if (minutesDiff >= -ENDING_SOON_MINUTES && minutesDiff < -10) {
                // Booking is ending soon (15-10 minutes left) - only notify once
                const minutesLeft = Math.abs(minutesDiff)

                // Check if we already sent an ending soon notification for this booking
                const existingNotification = await prisma.notification.findFirst({
                    where: {
                        bookingId: booking.id,
                        title: { contains: 'Sắp hết giờ' },
                    },
                })

                if (!existingNotification) {
                    await notifyEndingSoon(
                        booking.bookingCode,
                        booking.customerName,
                        booking.room.name,
                        minutesLeft,
                        booking.id
                    )
                    console.log(`[Cron] Ending soon alert: ${booking.bookingCode} has ${minutesLeft} minutes left`)
                }
            }
        }
    } catch (error) {
        console.error('[Cron] Error checking overtime bookings:', error)
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
        checkOvertimeBookings()
    })

    isScheduled = true
    console.log('[Cron] Booking cleanup and overtime check jobs scheduled - runs every minute')

    // Run once immediately on startup
    cancelPendingBookings()
    checkOvertimeBookings()
}
