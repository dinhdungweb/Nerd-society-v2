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
    // We need to check a date range from (startDate - 1 day) to (endDate + 1 day) to catch all possible overlaps
    const startDateStr = startDate.toISOString().split('T')[0]
    const searchStartDate = new Date(`${startDateStr}T00:00:00.000Z`)
    searchStartDate.setDate(searchStartDate.getDate() - 1)

    const endDateStr = endDate.toISOString().split('T')[0]
    const searchEndDate = new Date(`${endDateStr}T00:00:00.000Z`)
    searchEndDate.setDate(searchEndDate.getDate() + 1)

    const existingBookings = await prisma.booking.findMany({
        where: {
            roomId,
            date: {
                gte: searchStartDate,
                lte: searchEndDate,
            },
            OR: [
                { status: { in: activeStatuses } },
                { status: 'PENDING' as BookingStatus, createdAt: { gt: pendingTimeout } },
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
        // If endDate is null, determine it:
        // - If endTime <= startTime, it's cross-day (next day)
        // - Otherwise, same day
        let existingEndDate: Date
        if (booking.endDate) {
            existingEndDate = new Date(booking.endDate)
        } else {
            // Legacy: no endDate field
            const isCrossDay = parseTimeToMinutes(booking.endTime) <= parseTimeToMinutes(booking.startTime)
            existingEndDate = new Date(existingStartDate)
            if (isCrossDay) {
                existingEndDate.setDate(existingEndDate.getDate() + 1)
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
 * Bao gồm cả slot từ booking ngày hôm trước tràn sang (cross-day)
 * @param roomId - ID của phòng
 * @param dateStr - Ngày theo format YYYY-MM-DD (sẽ được parse như UTC midnight)
 */
export async function getBookedSlots(roomId: string, dateStr: string) {
    // Parse dateStr as UTC midnight to match how dates are stored in DB
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`)

    // Tính ngày hôm trước
    const prevDate = new Date(targetDate)
    prevDate.setDate(prevDate.getDate() - 1)

    // Lấy booking ngày hiện tại
    const sameDayBookings = await prisma.booking.findMany({
        where: {
            roomId,
            date: targetDate,
            status: {
                notIn: ['CANCELLED', 'NO_SHOW'],
            },
        },
        select: {
            startTime: true,
            endTime: true,
        },
        orderBy: {
            startTime: 'asc',
        },
    })

    // Lấy booking ngày hôm trước (để check cross-day)
    const prevDayBookings = await prisma.booking.findMany({
        where: {
            roomId,
            date: prevDate,
            status: {
                notIn: ['CANCELLED', 'NO_SHOW'],
            },
        },
        select: {
            startTime: true,
            endTime: true,
        },
    })

    // Kết quả: bao gồm cả booking cùng ngày và phần tràn từ hôm trước
    const result: { startTime: string; endTime: string; isSpillover?: boolean }[] = []

    // Thêm booking cùng ngày
    sameDayBookings.forEach(b => {
        result.push({ startTime: b.startTime, endTime: b.endTime })
    })

    // Thêm phần tràn từ booking hôm trước (cross-day)
    prevDayBookings.forEach(b => {
        const isCrossDay = parseTimeToMinutes(b.endTime) <= parseTimeToMinutes(b.startTime)
        if (isCrossDay) {
            // Booking hôm trước tràn sang: chiếm từ 00:00 đến endTime của nó
            result.push({ startTime: '00:00', endTime: b.endTime, isSpillover: true })
        }
    })

    return result
}

/**
 * Operating hours mặc định (24/7)
 */
export const OPERATING_HOURS = {
    open: '00:00',
    close: '24:00',
} as const

/**
 * Combine Date and Time string (HH:mm) into Date object
 */
export function getBookingDateTime(date: Date | string, time: string): Date {
    const dateTime = new Date(date)
    const [hours, minutes] = time.split(':').map(Number)
    dateTime.setHours(hours, minutes, 0, 0)
    return dateTime
}
