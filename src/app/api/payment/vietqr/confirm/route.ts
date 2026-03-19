import { sendBookingEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/payment/vietqr/confirm
 * User confirms they have made the payment
 * This marks the booking as PAYMENT_PENDING (waiting for verification)
 */
export async function POST(request: NextRequest) {
    try {
        const { bookingId } = await request.json()

        if (!bookingId) {
            return NextResponse.json(
                { error: 'bookingId is required' },
                { status: 400 }
            )
        }

        // Get booking
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                location: true,
                room: true,
            },
        })

        if (!booking) {
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            )
        }

        // Check if booking is cancelled or completed
        if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
            return NextResponse.json(
                { error: 'Booking has been cancelled or completed' },
                { status: 400 }
            )
        }

        // Check if already confirmed
        if (booking.depositPaidAt) {
            return NextResponse.json(
                { error: 'Deposit already confirmed' },
                { status: 400 }
            )
        }

        // Keep status as PENDING, just mark that user has reported payment
        // Admin will manually verify and change to CONFIRMED
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                // Chỉ đánh dấu thời gian user báo đã chuyển khoản
                // KHÔNG đổi status sang CONFIRMED ở đây, để webhook tự động xử lý
                depositPaidAt: new Date(),
                payment: {
                    update: {
                        method: 'BANK_TRANSFER',
                        status: 'PENDING' // Vẫn giữ PENDING cho đến khi có callback
                    }
                }
            },
            include: {
                location: true,
                room: true,
                user: true,
            },
        })

        // Don't send confirmation email yet - wait for admin to verify
        // Email will be sent when admin confirms the payment

        return NextResponse.json({
            success: true,
            message: 'Payment notification received. Waiting for admin verification.',
            booking: {
                id: updatedBooking.id,
                bookingCode: updatedBooking.bookingCode,
                status: updatedBooking.status,
            },
        })
    } catch (error) {
        console.error('Error confirming VietQR payment:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
