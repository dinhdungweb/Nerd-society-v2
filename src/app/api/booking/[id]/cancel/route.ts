import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { differenceInMinutes } from 'date-fns'
import { notifyBookingCancelled } from '@/lib/notifications'

const CANCEL_BEFORE_MINUTES = 360 // Cho phép hủy trước 6 tiếng

/**
 * POST /api/booking/[id]/cancel
 * Customer cancels their own booking (before 30 minutes of start time)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        // Get booking
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { payment: true },
        })

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
        }

        // Check ownership
        if (booking.userId !== session.user.id) {
            return NextResponse.json({ error: 'Not your booking' }, { status: 403 })
        }

        // Check if already cancelled
        if (booking.status === 'CANCELLED') {
            return NextResponse.json({ error: 'Booking đã được hủy' }, { status: 400 })
        }

        // Check if can cancel (only PENDING or CONFIRMED)
        if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
            return NextResponse.json({
                error: 'Không thể hủy booking đang sử dụng hoặc đã hoàn thành'
            }, { status: 400 })
        }

        // Check time - must be at least 30 minutes before start
        const bookingStart = new Date(booking.date)
        const [hours, minutes] = booking.startTime.split(':').map(Number)
        bookingStart.setHours(hours, minutes, 0, 0)

        const now = new Date()
        const minutesToStart = differenceInMinutes(bookingStart, now)

        if (minutesToStart < CANCEL_BEFORE_MINUTES) {
            return NextResponse.json({
                error: `Chỉ có thể hủy trước ${CANCEL_BEFORE_MINUTES} phút. Vui lòng liên hệ staff.`
            }, { status: 400 })
        }

        // Cancel the booking
        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                note: `Khách tự hủy lúc ${now.toLocaleString('vi-VN')}`,
            },
        })

        // Send notification to admin
        notifyBookingCancelled(
            updatedBooking.bookingCode,
            updatedBooking.customerName || 'Khách',
            updatedBooking.id
        ).catch(console.error)

        return NextResponse.json({
            success: true,
            message: 'Đã hủy đặt lịch thành công',
            booking: {
                id: updatedBooking.id,
                bookingCode: updatedBooking.bookingCode,
                status: updatedBooking.status,
            },
        })
    } catch (error) {
        console.error('Error cancelling booking:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
