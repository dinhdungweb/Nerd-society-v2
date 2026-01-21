import { prisma } from './prisma'
import { format } from 'date-fns'
import { BookingStatus } from '@prisma/client'

/**
 * Generate mã booking: NERD-YYYYMMDD-XXX
 */
export async function generateBookingCode(date: Date): Promise<string> {
    const dateStr = format(date, 'yyyyMMdd')
    const prefix = `NERD-${dateStr}`

    // Đếm số booking trong ngày để tạo số thứ tự
    const count = await prisma.booking.count({
        where: {
            bookingCode: {
                startsWith: prefix,
            },
        },
    })

    const suffix = (count + 1).toString().padStart(3, '0')
    return `${prefix}-${suffix}`
}

/**
 * Parse time string "HH:MM" thành phút từ đầu ngày
 */
export function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}

/**
 * Thêm phút vào time string
 */
export function addMinutesToTime(time: string, minutesToAdd: number): string {
    const totalMinutes = parseTimeToMinutes(time) + minutesToAdd
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Tính duration giữa 2 time strings (phút)
 * Hỗ trợ cross-day: nếu endTime < startTime thì coi endTime là ngày hôm sau
 */
export function calculateDuration(startTime: string, endTime: string): number {
    const startMinutes = parseTimeToMinutes(startTime)
    let endMinutes = parseTimeToMinutes(endTime)

    // Cross-day: endTime thuộc ngày hôm sau
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60 // Cộng 24 giờ
    }

    return endMinutes - startMinutes
}

/**
 * Combine Date and Time string (HH:mm) into Date object
 */
export function getBookingDateTime(date: Date | string, time: string): Date {
    const dateTime = new Date(date)
    const [hours, minutes] = time.split(':').map(Number)
    dateTime.setUTCHours(hours, minutes, 0, 0)
    return dateTime
}

/**
 * Kiểm tra slot có trống không (hỗ trợ multi-day booking với endDate)
 * @returns true nếu slot available
 */
export async function isSlotAvailable(
    roomId: string,
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string
): Promise<boolean> {
    // Convert target booking to absolute timestamps (milliseconds)
    const targetStartMs = getBookingDateTime(startDate, startTime).getTime()
    const targetEndMs = getBookingDateTime(endDate, endTime).getTime()

    // Threshold: Ignore PENDING bookings older than 5 minutes
    const pendingTimeout = new Date()
    pendingTimeout.setMinutes(pendingTimeout.getMinutes() - 5)

    const activeStatuses: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']

    // Get bookings that could potentially overlap
    // For multi-day bookings, we need to catch bookings that:
    // 1. Start within our date range (startDate-1 to endDate+1)
    // 2. OR end within our date range (for bookings that started much earlier)
    // 3. OR completely span our date range (started before AND ends after)
    const startDateStr = startDate.toISOString().split('T')[0]
    const searchStartDate = new Date(`${startDateStr}T00:00:00.000Z`)
    searchStartDate.setDate(searchStartDate.getDate() - 1)

    const endDateStr = endDate.toISOString().split('T')[0]
    const searchEndDate = new Date(`${endDateStr}T00:00:00.000Z`)
    searchEndDate.setDate(searchEndDate.getDate() + 1)

    const existingBookings = await prisma.booking.findMany({
        where: {
            roomId,
            OR: [
                // Case 1: Booking starts within our search range
                {
                    date: {
                        gte: searchStartDate,
                        lte: searchEndDate,
                    },
                },
                // Case 2: Booking ends within or after our target start (for long multi-day bookings)
                // This catches bookings that started long ago but are still ongoing
                {
                    endDate: {
                        gte: searchStartDate,
                    },
                    date: {
                        lte: searchEndDate,
                    },
                },
            ],
            AND: [
                {
                    OR: [
                        { status: { in: activeStatuses } },
                        { status: 'PENDING' as BookingStatus, createdAt: { gt: pendingTimeout } },
                    ],
                },
            ],
        },
        select: {
            date: true,
            endDate: true,
            startTime: true,
            endTime: true,
        },
    })

    // Check each existing booking for overlap
    for (const booking of existingBookings) {
        // Calculate existing booking's start and end timestamps
        const existingStartDate = new Date(booking.date)
        let existingEndDate: Date
        if (booking.endDate) {
            existingEndDate = new Date(booking.endDate)
        } else {
            // Legacy: no endDate field
            const isCrossDay = parseTimeToMinutes(booking.endTime) <= parseTimeToMinutes(booking.startTime)
            existingEndDate = new Date(existingStartDate)
            if (isCrossDay) {
                existingEndDate.setUTCDate(existingEndDate.getUTCDate() + 1)
            }
        }

        const existingStartMs = getBookingDateTime(existingStartDate, booking.startTime).getTime()
        const existingEndMs = getBookingDateTime(existingEndDate, booking.endTime).getTime()

        // Simple range overlap check: A.start < B.end AND A.end > B.start
        if (targetStartMs < existingEndMs && targetEndMs > existingStartMs) {
            return false // Overlap found!
        }
    }

    return true
}

/**
 * Lấy danh sách slot đã book trong ngày
 * Bao gồm cả slot từ booking nhiều ngày (multi-day)
 * @param roomId - ID của phòng
 * @param dateStr - Ngày theo format YYYY-MM-DD
 */
export async function getBookedSlots(roomId: string, dateStr: string) {
    // Parse dateStr as UTC midnight
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`)
    const targetDateEnd = new Date(targetDate)
    targetDateEnd.setDate(targetDateEnd.getDate() + 1)

    // Find all active bookings that overlap with this entire 24h period
    // Use a range that covers potential cross-day and multi-day overlaps
    const startOfTarget = new Date(`${dateStr}T00:00:00.000Z`)
    const startOfPrevious = new Date(startOfTarget)
    startOfPrevious.setDate(startOfPrevious.getDate() - 1)

    const activeBookings = await prisma.booking.findMany({
        where: {
            roomId,
            status: {
                notIn: ['CANCELLED', 'NO_SHOW'],
            },
            // Started before midnight tomorrow
            date: {
                lt: targetDateEnd,
            },
            // Ended after midnight today (or could have ended today if legacy cross-day)
            OR: [
                { endDate: { gte: startOfTarget } },
                { endDate: null, date: { gte: startOfPrevious } }
            ]
        },
        select: {
            date: true,
            endDate: true,
            startTime: true,
            endTime: true,
        },
    })

    const result: { startTime: string; endTime: string; isSpillover?: boolean }[] = []

    activeBookings.forEach(booking => {
        const bStart = new Date(booking.date)
        let bEnd: Date
        if (booking.endDate) {
            bEnd = new Date(booking.endDate)
        } else {
            // Legacy cross-day check
            const isCrossDay = parseTimeToMinutes(booking.endTime) <= parseTimeToMinutes(booking.startTime)
            bEnd = new Date(bStart)
            if (isCrossDay) bEnd.setUTCDate(bEnd.getUTCDate() + 1)
        }

        const bStartFull = getBookingDateTime(bStart, booking.startTime)
        const bEndFull = getBookingDateTime(bEnd, booking.endTime)

        // Check if this booking overlaps with our target 24h window [targetDate, targetDateEnd)
        if (bStartFull < targetDateEnd && bEndFull > targetDate) {
            // It overlaps! Now calculate the portion within this day
            let displayStart = '00:00'
            let displayEnd = '24:00'
            let isSpillover = false

            // If it starts today
            if (bStartFull >= targetDate) {
                displayStart = booking.startTime
            } else {
                isSpillover = true
            }

            // If it ends today
            if (bEndFull <= targetDateEnd) {
                displayEnd = booking.endTime
            }

            result.push({
                startTime: displayStart,
                endTime: displayEnd,
                isSpillover
            })
        }
    })

    // Sort by startTime
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/**
 * Operating hours mặc định (24/7)
 */
export const OPERATING_HOURS = {
    open: '00:00',
    close: '24:00',
} as const


/**
 * Helper: Tính duration (multi-day) returning minutes
 */
export function calculateDurationMultiDay(startDate: Date, endDate: Date, startTime: string, endTime: string): number {
    if (!startDate || !endDate || !startTime || !endTime) return 0
    const startMin = parseTimeToMinutes(startTime)
    const endMin = parseTimeToMinutes(endTime)

    const s = new Date(startDate); s.setHours(0, 0, 0, 0)
    const e = new Date(endDate); e.setHours(0, 0, 0, 0)
    const daysDiff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))

    return (daysDiff * 24 * 60) + endMin - startMin
}

/**
 * Helper: Check overlap Logic (Client/Server Shared Helper)
 * Checks if range [sDate+sTime, eDate+eTime] overlaps with any slot in startDaySlots/endDaySlots
 */
export function isRangeOverlapping(
    sDate: Date,
    sTime: string,
    eDate: Date,
    eTime: string,
    startDaySlots: any[],
    endDaySlots: any[] = []
): boolean {
    if (!sDate || !sTime || !eDate || !eTime) return false

    const newStart = getBookingDateTime(sDate, sTime).getTime()
    const newEnd = getBookingDateTime(eDate, eTime).getTime()

    const checkSlots = (slots: any[], targetDay: Date) => {
        for (const slot of slots) {
            let slotStartMs: number
            let slotEndMs: number
            const baseDate = new Date(targetDay); baseDate.setUTCHours(0, 0, 0, 0)

            if (slot.isSpillover) {
                slotStartMs = getBookingDateTime(baseDate, '00:00').getTime()
                slotEndMs = getBookingDateTime(baseDate, slot.endTime).getTime()
            } else {
                slotStartMs = getBookingDateTime(baseDate, slot.startTime).getTime()
                const slotEnd = getBookingDateTime(baseDate, slot.endTime)
                if (parseTimeToMinutes(slot.endTime) <= parseTimeToMinutes(slot.startTime)) {
                    slotEnd.setUTCDate(slotEnd.getUTCDate() + 1)
                }
                slotEndMs = slotEnd.getTime()
            }
            // Check intersection: StartA < EndB && EndA > StartB
            if (newStart < slotEndMs && newEnd > slotStartMs) return true
        }
        return false
    }

    if (checkSlots(startDaySlots, sDate)) return true

    // If multi-day booking, check end date slots too
    if (sDate.toISOString().split('T')[0] !== eDate.toISOString().split('T')[0] && endDaySlots.length > 0) {
        if (checkSlots(endDaySlots, eDate)) return true
    }

    return false
}
