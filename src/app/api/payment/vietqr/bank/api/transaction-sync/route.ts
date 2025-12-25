
import { sendBookingEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { VietQRVNWebhookPayload } from '@/lib/vietqr'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.VIETQR_WEBHOOK_SECRET || 'fallback_secret_for_dev'

/**
 * POST /api/payment/vietqr/bank/api/transaction-sync
 * 
 * Actual Webhook endpoint mandated by VietQR structure.
 * Path is usually: {BaseURL}/{Path}/bank/api/transaction-sync
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Verify Bearer Token (Security)
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { code: '401', desc: 'Unauthorized - Missing Token', data: null },
                { status: 401 }
            )
        }

        const token = authHeader.split(' ')[1]
        try {
            jwt.verify(token, JWT_SECRET)
        } catch (err) {
            return NextResponse.json(
                { code: '401', desc: 'Unauthorized - Invalid Token', data: null },
                { status: 401 }
            )
        }

        // 2. Process Payload
        const body = await request.json()
        console.log('[VietQR Sync] Received:', JSON.stringify(body, null, 2))

        const { notificationType, transactionid, amount, content, transType } = body as VietQRVNWebhookPayload

        // Only process incoming transfers (Credit)
        // VietQR spec: transType 'C' or '+' 
        if (transType !== 'C' && transType !== '+') {
            return NextResponse.json({ code: '00', desc: 'Ignored non-credit transaction', data: null })
        }

        // Parse booking code from content
        // Expected format in description: "NERD-XXXXXXXX-XXX"
        // Note: content might be "MBVCB.1234... NERD-..."
        const bookingCodeMatch = (content || '').match(/NERD-\d{8}-\d{3}/i)

        if (!bookingCodeMatch) {
            console.log('[VietQR Sync] No booking code found:', content)
            return NextResponse.json({ code: '00', desc: 'No booking code found', data: { status: false } })
        }

        const bookingCode = bookingCodeMatch[0].toUpperCase()
        const transactionAmount = Number(amount)

        // Find booking
        const booking = await prisma.booking.findFirst({
            where: {
                bookingCode,
                status: 'PENDING',
                depositPaidAt: null,
            },
            include: { user: true }
        })

        if (!booking) {
            console.log('[VietQR Sync] Booking not found/valid:', bookingCode)
            return NextResponse.json({ code: '00', desc: 'Booking invalid', data: { status: false } })
        }

        // Verify amount (optional loose check)
        if (transactionAmount < booking.depositAmount) {
            console.log('[VietQR Sync] Amount partial:', { received: transactionAmount, expected: booking.depositAmount })
            // Decide policy: Accept or Reject? For now acknowledge but maybe not confirm?
            // Let's confirm for UX, but log it.
        }

        // Update DB
        await prisma.$transaction([
            prisma.booking.update({
                where: { id: booking.id },
                data: {
                    status: 'CONFIRMED',
                    depositPaidAt: new Date(),
                },
            }),
            prisma.payment.updateMany({
                where: { bookingId: booking.id },
                data: {
                    status: 'COMPLETED',
                    transactionId: transactionid,
                    paidAt: new Date(),
                    amount: transactionAmount,
                },
            })
        ])

        // Send Email
        const emailRecipient = booking.customerEmail || booking.user?.email;
        if (emailRecipient) {
            try {
                // Ensure customerEmail is present in object passed to email function
                // Fetch full booking data again or rely on types logic if sendBookingEmail handles it
                const fullBooking = await prisma.booking.findUnique({
                    where: { id: booking.id },
                    include: { location: true, room: true, user: true }
                })
                if (fullBooking) await sendBookingEmail(fullBooking)
            } catch (emailError) {
                console.error('[VietQR Sync] Email error:', emailError)
            }
        }

        return NextResponse.json({
            code: '00',
            desc: 'Success',
            data: { status: true }
        })

    } catch (error) {
        console.error('[VietQR Sync] Error:', error)
        return NextResponse.json(
            { code: '500', desc: 'Internal Server Error', data: null },
            { status: 500 }
        )
    }
}
