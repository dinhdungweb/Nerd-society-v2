import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { calculateBookingPriceFromDB, calculateDeposit, SYSTEM_CONFIG } from '@/lib/pricing-db'
import { isSlotAvailable, generateBookingCode, getBookingDateTime, parseTimeToMinutes, OPERATING_HOURS } from '@/lib/booking-utils'
import { parseISO, addMinutes, format } from 'date-fns'
import { audit } from '@/lib/audit'
import { canView, canBooking } from '@/lib/apiPermissions'
import { Prisma } from '@prisma/client'

const bookingInclude = {
    user: { select: { name: true, email: true, phone: true } },
    location: { select: { name: true } },
    room: { select: { name: true, type: true } },
    payment: { select: { status: true, method: true } },
} satisfies Prisma.BookingInclude

function transformBooking<T extends Record<string, any>>(booking: T) {
    return {
        ...booking,
        combo: booking.room ? { name: booking.room.name, duration: 60 } : null,
        user: {
            name: booking.customerName || booking.user?.name || 'N/A',
            email: booking.customerEmail || booking.user?.email || '',
            phone: booking.customerPhone || booking.user?.phone || '',
        },
        totalAmount: booking.estimatedAmount,
    }
}

// GET /api/admin/bookings - Paginated table data or a bounded calendar window.
export async function GET(req: Request) {
    try {
        const { session, hasAccess } = await canView('Bookings')

        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem bookings' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'table'
        const assignedLocationId = (session.user.role === 'STAFF' || session.user.role === 'MANAGER')
            ? session.user.assignedLocationId
            : null
        const requestedLocationId = searchParams.get('locationId') || null
        const locationId = assignedLocationId || requestedLocationId
        const baseWhere: Prisma.BookingWhereInput = locationId ? { locationId } : {}

        if (view === 'calendar') {
            const from = new Date(searchParams.get('from') || '')
            const to = new Date(searchParams.get('to') || '')
            if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
                return NextResponse.json({ error: 'Khoảng ngày không hợp lệ' }, { status: 400 })
            }

            const previousDay = new Date(from)
            previousDay.setUTCDate(previousDay.getUTCDate() - 1)
            const bookings = await prisma.booking.findMany({
                where: {
                    ...baseWhere,
                    date: { lte: to },
                    OR: [
                        { endDate: { gte: from } },
                        { endDate: null, date: { gte: previousDay } },
                    ],
                },
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                include: bookingInclude,
            })

            return NextResponse.json({ data: bookings.map(transformBooking) })
        }

        const page = Math.max(1, Number(searchParams.get('page')) || 1)
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize')) || 10))
        const search = searchParams.get('q')?.trim() || ''
        const status = searchParams.get('status') || 'ALL'
        const where: Prisma.BookingWhereInput = {
            ...baseWhere,
            ...(status !== 'ALL' ? { status: status as Prisma.EnumBookingStatusFilter['equals'] } : {}),
            ...(search ? {
                OR: [
                    { bookingCode: { contains: search, mode: 'insensitive' } },
                    { customerName: { contains: search, mode: 'insensitive' } },
                    { customerPhone: { contains: search } },
                    { customerEmail: { contains: search, mode: 'insensitive' } },
                    { user: { is: { name: { contains: search, mode: 'insensitive' } } } },
                    { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
                    { user: { is: { phone: { contains: search } } } },
                ],
            } : {}),
        }

        const [bookings, total, statusGroups] = await Promise.all([
            prisma.booking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: bookingInclude,
            }),
            prisma.booking.count({ where }),
            prisma.booking.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
            }),
        ])

        const statusCounts = Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all]))
        return NextResponse.json({
            data: bookings.map(transformBooking),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
            },
            stats: {
                pending: statusCounts.PENDING || 0,
                confirmed: statusCounts.CONFIRMED || 0,
                inProgress: statusCounts.IN_PROGRESS || 0,
                cancelled: statusCounts.CANCELLED || 0,
            },
        })
    } catch (error) {
        console.error('Error fetching bookings:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// POST /api/admin/bookings - Create Walk-in Booking (requires canCreateBookings permission)
export async function POST(req: Request) {
    try {
        const { session, hasAccess } = await canBooking('Create')

        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền tạo booking' }, { status: 403 })
        }

        const body = await req.json()
        const {
            roomId,
            date, // Starting date string (YYYY-MM-DD)
            endDate, // Ending date string (YYYY-MM-DD)
            startTime, // "HH:mm"
            endTime, // "HH:mm"
            customerName,
            customerPhone,
            customerEmail,
            depositStatus, // 'PAID_CASH' | 'WAIVED'
            note
        } = body

        // 1. Validation
        if (!roomId || !date || !endDate || !startTime || !endTime || !customerName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 2. Pricing
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { location: true }
        })
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        
        // 2a. Location Permission Check for STAFF/MANAGER
        if ((session.user.role === 'STAFF' || session.user.role === 'MANAGER') && 
             session.user.assignedLocationId && 
             room.locationId !== session.user.assignedLocationId) {
            return NextResponse.json({ error: 'Bạn không có quyền tạo booking tại cơ sở này' }, { status: 403 })
        }

        // Map Room Type to Service Type
        let serviceType: any = 'MEETING'
        if (room.type === 'POD_MONO') serviceType = 'POD_MONO'
        if (room.type === 'POD_MULTI') serviceType = 'POD_MULTI'

        // Calculate duration and end date time
        const startDateTime = getBookingDateTime(date, startTime)
        const endDateTime = getBookingDateTime(endDate, endTime)
        const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60))

        let finalAmount = await calculateBookingPriceFromDB(serviceType, durationMinutes, 1)
        if (serviceType === 'MEETING' && body.guests) {
            finalAmount = await calculateBookingPriceFromDB('MEETING', durationMinutes, body.guests)
        }

        const depositAmount = calculateDeposit(finalAmount)
        const bookingCode = await generateBookingCode(new Date(date))

        // 3. Validation: Past booking, Operating hours, Min duration
        // const now = new Date()

        // Admin: Allow booking in past for backfill (optional - uncomment to block)
        // if (startDateTime < now) {
        //     return NextResponse.json({ error: 'Không thể đặt lịch trong quá khứ' }, { status: 400 })
        // }

        // Operating hours check
        const startMinutes = parseTimeToMinutes(startTime)
        const endMinutes = parseTimeToMinutes(format(endDateTime, 'HH:mm'))
        const openMinutes = parseTimeToMinutes(OPERATING_HOURS.open)
        const closeMinutes = parseTimeToMinutes(OPERATING_HOURS.close)

        if (startMinutes < openMinutes || endMinutes > closeMinutes) {
            return NextResponse.json(
                { error: `Giờ hoạt động từ ${OPERATING_HOURS.open} đến ${OPERATING_HOURS.close}` },
                { status: 400 }
            )
        }

        // Minimum duration (30 minutes for POD or walk-in flexibility)
        if (durationMinutes < 30) {
            return NextResponse.json(
                { error: 'Thời lượng tối thiểu là 30 phút' },
                { status: 400 }
            )
        }

        const available = await isSlotAvailable(
            roomId,
            new Date(date),
            new Date(endDate),
            startTime,
            endTime
        )

        if (!available) {
            return NextResponse.json({
                error: `Phòng đã bị đặt trong khung giờ này.`
            }, { status: 409 })
        }

        // 3a. Find existing user to link
        let userId: string | null = null
        if (customerEmail || customerPhone) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        ...(customerEmail ? [{ email: customerEmail }] : []),
                        ...(customerPhone ? [{ phone: customerPhone }] : [])
                    ]
                },
                select: { id: true }
            })
            if (existingUser) {
                userId = existingUser.id
            }
        }

        // 4. Create Booking
        const booking = await prisma.booking.create({
            data: {
                bookingCode,
                roomId,
                locationId: room.locationId,
                date: new Date(date),
                endDate: new Date(endDate),
                startTime,
                endTime,
                guests: body.guests || 1,
                customerName,
                customerPhone,
                customerEmail,
                source: 'ONSITE',
                status: depositStatus === 'PAID_CASH' || depositStatus === 'WAIVED' ? 'CONFIRMED' : 'PENDING',
                estimatedAmount: finalAmount,
                depositAmount: depositAmount,
                depositStatus: depositStatus === 'PAID_CASH' ? 'PAID_CASH' : (depositStatus === 'WAIVED' ? 'WAIVED' : 'PENDING'),
                depositPaidAt: depositStatus === 'PAID_CASH' ? new Date() : null,
                note,
                userId,
                nerdCoinIssued: 0,
            }
        })

        // 5. Create Payment record if Cash paid
        if (depositStatus === 'PAID_CASH') {
            await prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    amount: depositAmount,
                    method: 'CASH',
                    status: 'COMPLETED',
                    paidAt: new Date()
                }
            })
        }

        // Create notification for new booking created by staff
        import('@/lib/notifications').then(({ notifyNewBooking }) => {
            notifyNewBooking(booking.bookingCode, customerName, booking.id).catch(console.error)
        })

        // Audit logging
        await audit.create(
            session.user.id || 'unknown',
            session.user.name || session.user.email || 'Admin',
            'booking',
            booking.id,
            { bookingCode: booking.bookingCode, customerName, source: 'ONSITE' }
        )

        return NextResponse.json(booking)

    } catch (error) {
        console.error('Error creating walk-in booking:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
