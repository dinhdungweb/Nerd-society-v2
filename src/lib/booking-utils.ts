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
 * Kiểm tra slot có trống không (hỗ trợ cross-day booking)
 * @returns true nếu slot available
 */
export async function isSlotAvailable(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string
): Promise<boolean> {
    // Normalize date to UTC midnight to match DB storage format
    const dateStr = date.toISOString().split('T')[0]
    const bookingDate = new Date(`${dateStr}T00:00:00.000Z`)

    // Tính ngày hôm trước và hôm sau
    const prevDate = new Date(bookingDate)
    prevDate.setDate(prevDate.getDate() - 1)
    const nextDate = new Date(bookingDate)
    nextDate.setDate(nextDate.getDate() + 1)

    // Threshold: Ignore PENDING bookings older than 5 minutes
    const pendingTimeout = new Date()
    pendingTimeout.setMinutes(pendingTimeout.getMinutes() - 5)

    const activeStatuses: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
    const statusCondition = {
        OR: [
            { status: { in: activeStatuses } },
            { status: 'PENDING' as BookingStatus, createdAt: { gt: pendingTimeout } },
        ],
    }

    const isCrossDay = parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)

    // --- CHECK 1: Conflict với booking cùng ngày ---
    const sameDayConflict = await prisma.booking.findFirst({
        where: {
            roomId,
            date: bookingDate,
            ...statusCondition,
            // Overlap: A.start < B.end AND A.end > B.start
            // Cần xử lý cả trường hợp existing booking là cross-day
            OR: [
                // Trường hợp booking cùng ngày (endTime > startTime)
                {
                    AND: [
                        { startTime: { lt: isCrossDay ? '24:00' : endTime } },
                        { endTime: { gt: startTime } },
                    ],
                },
            ],
        },
    })
    if (sameDayConflict) return false

    // --- CHECK 2: Conflict với booking từ ngày hôm TRƯỚC tràn sang ---
    // Query tất cả booking hôm trước và check thủ công xem có cross-day không
    const prevDayBookings = await prisma.booking.findMany({
        where: {
            roomId,
            date: prevDate,
            ...statusCondition,
        },
        select: { startTime: true, endTime: true },
    })
    for (const booking of prevDayBookings) {
        const existingIsCrossDay = parseTimeToMinutes(booking.endTime) <= parseTimeToMinutes(booking.startTime)
        if (existingIsCrossDay) {
            // Booking hôm trước tràn sang, endTime của nó overlap với phần đầu ngày hôm nay
            // Conflict nếu: target.startTime < existing.endTime (phần tràn sang)
            if (parseTimeToMinutes(startTime) < parseTimeToMinutes(booking.endTime)) {
                return false
            }
        }
    }

    // --- CHECK 3: Nếu target là cross-day, check conflict với booking NGÀY HÔM SAU ---
    if (isCrossDay) {
        const nextDayBookings = await prisma.booking.findMany({
            where: {
                roomId,
                date: nextDate,
                ...statusCondition,
            },
            select: { startTime: true, endTime: true },
        })
        for (const booking of nextDayBookings) {
            // Target tràn sang ngày mai từ 00:00 đến endTime
            // Conflict nếu: existing.startTime < target.endTime
            if (parseTimeToMinutes(booking.startTime) < parseTimeToMinutes(endTime)) {
                return false
            }
        }
    }

    return true
}

/**
 * Lấy danh sách slot đã book trong ngày
 * @param roomId - ID của phòng
 * @param dateStr - Ngày theo format YYYY-MM-DD (sẽ được parse như UTC midnight)
 */
export async function getBookedSlots(roomId: string, dateStr: string) {
    // Parse dateStr as UTC midnight to match how dates are stored in DB
    // DB stores dates as UTC midnight (e.g., "2025-12-15T00:00:00.000Z")
    // So we need to query with exact UTC midnight
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`)

    const bookings = await prisma.booking.findMany({
        where: {
            roomId,
            date: targetDate, // Exact match with UTC midnight
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

    return bookings
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
