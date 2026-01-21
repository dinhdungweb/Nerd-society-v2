import {
    calculateDuration,
    generateBookingCode,
    isSlotAvailable,
    parseTimeToMinutes,
    OPERATING_HOURS,
    getBookingDateTime,
} from '@/lib/booking-utils'
import { sendBookingEmail, sendAdminNewBookingEmail } from '@/lib/email'
import {
    calculateBookingPriceFromDB,
    calculateDeposit,
    getNerdCoinRewardFromDB,
} from '@/lib/pricing-db'
import { prisma } from '@/lib/prisma'
// VNPay disabled - using VietQR instead
// import { generateVNPayUrl } from '@/lib/vnpay'
import { RoomType, ServiceType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

interface CreateBookingRequest {
    roomId: string
    locationId: string
    serviceType: ServiceType
    date: string // ISO date string (start date)
    endDate?: string // ISO date string (end date, defaults to date)
    startTime: string // "HH:MM"
    endTime: string // "HH:MM"
    guests: number
    customerName: string
    customerPhone: string
    customerEmail?: string
    note?: string
}

/**
 * Map RoomType to ServiceType
 */
function roomTypeToServiceType(roomType: RoomType): ServiceType {
    switch (roomType) {
        case 'MEETING_LONG':
        case 'MEETING_ROUND':
            return 'MEETING'
        case 'POD_MONO':
            return 'POD_MONO'
        case 'POD_MULTI':
            return 'POD_MULTI'
    }
}

/**
 * POST /api/booking/create
 * Tạo booking mới
 */
export async function POST(request: NextRequest) {
    try {
        const body: CreateBookingRequest = await request.json()
        const {
            roomId,
            locationId,
            date,
            endDate: endDateStr,
            startTime,
            endTime,
            guests,
            customerName,
            customerPhone,
            customerEmail,
            note,
        } = body

        // Validate required fields
        if (!roomId || !locationId || !date || !startTime || !endTime) {
            return NextResponse.json(
                { error: 'Missing required fields: roomId, locationId, date, startTime, endTime' },
                { status: 400 }
            )
        }

        if (!customerName || !customerPhone) {
            return NextResponse.json(
                { error: 'Missing customer info: customerName, customerPhone' },
                { status: 400 }
            )
        }

        // Validate Vietnamese phone number (10 digits, starts with 0)
        const phoneRegex = /^0\d{9}$/
        if (!phoneRegex.test(customerPhone)) {
            return NextResponse.json(
                { error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' },
                { status: 400 }
            )
        }

        // Parse date
        const bookingDate = new Date(date)
        if (isNaN(bookingDate.getTime())) {
            return NextResponse.json(
                { error: 'Invalid date format' },
                { status: 400 }
            )
        }

        // Parse endDate (default to bookingDate if not provided)
        const bookingEndDate = endDateStr ? new Date(endDateStr) : bookingDate
        if (isNaN(bookingEndDate.getTime())) {
            return NextResponse.json(
                { error: 'Invalid end date format' },
                { status: 400 }
            )
        }

        // Validate: endDate >= date
        if (bookingEndDate < bookingDate) {
            return NextResponse.json(
                { error: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu' },
                { status: 400 }
            )
        }

        // Verify room exists and get its type
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { id: true, type: true, capacity: true, locationId: true },
        })

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            )
        }

        if (room.locationId !== locationId) {
            return NextResponse.json(
                { error: 'Room does not belong to the specified location' },
                { status: 400 }
            )
        }

        // Check capacity for all room types
        const serviceType = roomTypeToServiceType(room.type)
        if (guests > room.capacity) {
            return NextResponse.json(
                { error: `Số người (${guests}) vượt quá sức chứa phòng (${room.capacity})` },
                { status: 400 }
            )
        }

        // Validate: Not in the past
        const now = new Date()
        const bookingStartDateTime = getBookingDateTime(bookingDate, startTime)
        if (bookingStartDateTime < now) {
            return NextResponse.json(
                { error: 'Không thể đặt lịch trong quá khứ' },
                { status: 400 }
            )
        }

        // Lưu ý: Operating hours 24/7 đã được xử lý, không cần check giới hạn giờ

        // Validate: Minimum duration (60 minutes)
        // Calculate duration for multi-day bookings
        const daysDiff = Math.round((bookingEndDate.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24))
        const startMinutes = parseTimeToMinutes(startTime)
        const endMinutes = parseTimeToMinutes(endTime)
        const durationMinutes = (daysDiff * 24 * 60) + endMinutes - startMinutes

        if (durationMinutes < 60) {
            return NextResponse.json(
                { error: 'Thời lượng tối thiểu là 60 phút' },
                { status: 400 }
            )
        }

        // Check slot availability
        const available = await isSlotAvailable(roomId, bookingDate, bookingEndDate, startTime, endTime)
        if (!available) {
            return NextResponse.json(
                { error: 'Khung giờ này vừa có người đặt trước. Vui lòng chọn khung giờ khác.' },
                { status: 409 }
            )
        }


        // Calculate pricing from database (durationMinutes already validated above)
        const estimatedAmount = await calculateBookingPriceFromDB(serviceType, durationMinutes, guests)
        const depositAmount = calculateDeposit(estimatedAmount)
        const nerdCoinReward = await getNerdCoinRewardFromDB(serviceType)

        // Generate booking code
        const bookingCode = await generateBookingCode(bookingDate)

        // Find user by customerEmail (not session) - so booking links to correct profile
        // This allows: logged in as A, book for B → booking appears in B's profile
        let validUserId: string | null = null
        if (customerEmail) {
            const userByEmail = await prisma.user.findUnique({
                where: { email: customerEmail.toLowerCase() },
                select: { id: true }
            })
            validUserId = userByEmail?.id || null
        }

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                bookingCode,
                userId: validUserId,
                roomId,
                locationId,
                customerName,
                customerPhone,
                customerEmail,
                date: bookingDate,
                endDate: bookingEndDate,
                startTime,
                endTime,
                guests,
                estimatedAmount,
                depositAmount,
                nerdCoinIssued: 0, // Nerd Coin issued at Check-in, not at creation
                source: 'WEBSITE', // Booking từ website (có thể có hoặc không tài khoản)
                status: 'PENDING',
                depositStatus: 'PENDING',
                note,
                // Payment record will be created when user selects a payment method
            },
            include: {
                user: true,
                room: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
                location: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                    },
                },
                payment: true,
            },
        })

        // Use VietQR payment page instead of VNPay
        const paymentUrl = `/booking/payment?id=${booking.id}`

        // Send email notification (async, don't wait)
        sendBookingEmail({
            ...booking,
            user: booking.user || null,
        }).catch(console.error)

        // Send email to Admin (async)
        sendAdminNewBookingEmail({
            ...booking,
            // Ensure necessary fields are populated for template
            customerName,
            customerPhone,
            note
        }).catch(console.error)

        // Create admin notification (async, don't wait)
        import('@/lib/notifications').then(({ notifyNewBooking }) => {
            notifyNewBooking(booking.bookingCode, customerName, booking.id).catch(console.error)
        })

        return NextResponse.json({
            booking: {
                id: booking.id,
                bookingCode: booking.bookingCode,
                room: booking.room,
                location: booking.location,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                guests: booking.guests,
                estimatedAmount: booking.estimatedAmount,
                depositAmount: booking.depositAmount,
                nerdCoinReward,
                status: booking.status,
            },
            paymentUrl,
            depositAmount,
        })
    } catch (error) {
        console.error('Error creating booking:', error)
        return NextResponse.json(
            { error: 'Failed to create booking' },
            { status: 500 }
        )
    }
}
