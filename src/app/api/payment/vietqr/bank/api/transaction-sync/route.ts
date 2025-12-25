
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
        // 0. LOG EVERYTHING (Debug Phase)
        const authHeader = request.headers.get('authorization')
        console.log('[VietQR Sync] INCOMING REQUEST ---------------------------')
        console.log('[VietQR Sync] Headers:', Object.fromEntries(request.headers))
        console.log('[VietQR Sync] Auth Header:', authHeader)

        // 1. Verify Bearer Token (Security)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: true, errorReason: 'INVALID_AUTH_HEADER', toastMessage: 'Authorization header is missing or invalid', object: null },
                { status: 401 }
            )
        }

        const token = authHeader.split(' ')[1]
        try {
            jwt.verify(token, JWT_SECRET)
        } catch (err) {
            return NextResponse.json(
                { error: true, errorReason: 'INVALID_TOKEN', toastMessage: 'Invalid or expired token', object: null },
                { status: 401 }
            )
        }

        // 2. Process Payload
        const body = await request.json()
        console.log('[VietQR Sync] Received:', JSON.stringify(body, null, 2))

        const { notificationType, transactionid, amount, content, transType } = body as VietQRVNWebhookPayload
        console.log('[VietQR Sync] Payload:', { transactionid, amount, content, transType, notificationType })

        // Only process incoming transfers (Credit)
        // VietQR spec: transType 'C' or '+' 
        if (transType !== 'C' && transType !== '+') {
            console.log('[VietQR Sync] Skipped: Not a credit transaction', transType)
            return NextResponse.json({ error: false, errorReason: null, toastMessage: 'Ignored non-credit transaction', object: null })
        }

        // Parse booking code from content
        // Format DB: NERD-YYYYMMDD-XXX (ví dụ: NERD-20251225-001)
        // Format trong content (sau khi sanitize): NERD20251225001
        // Regex tìm: NERD + 8 số (ngày) + 3 số (thứ tự)
        const bookingCodeMatch = (content || '').match(/NERD[- ]?(\d{8})[- ]?(\d{3})/i)

        if (!bookingCodeMatch) {
            console.log('[VietQR Sync] No booking code found in content:', content)
            return NextResponse.json({
                error: true,
                errorReason: 'NO_BOOKING_CODE',
                toastMessage: 'No booking code found in transfer content',
                object: null
            })
        }

        // Rebuild đúng format DB: NERD-YYYYMMDD-XXX
        const datePart = bookingCodeMatch[1]  // 8 số ngày: 20251225
        const seqPart = bookingCodeMatch[2]   // 3 số thứ tự: 001
        const extractedCode = `NERD-${datePart}-${seqPart}`

        console.log('[VietQR Sync] Extracted Code:', extractedCode)
        const transactionAmount = Number(amount)

        // Find booking
        const booking = await prisma.booking.findFirst({
            where: {
                bookingCode: extractedCode, // Match EXACTLY what is in DB
                status: 'PENDING',
                depositPaidAt: null,
            },
            include: { user: true }
        })

        if (!booking) {
            console.log('[VietQR Sync] Booking not found/valid for code:', extractedCode)
            return NextResponse.json({
                error: true,
                errorReason: 'BOOKING_NOT_FOUND',
                toastMessage: 'Booking not found or already paid',
                object: null
            })
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
            error: false,
            errorReason: null,
            toastMessage: 'Transaction processed successfully',
            object: { reftransactionid: booking.id }
        })

    } catch (error) {
        console.error('[VietQR Sync] Error:', error)
        return NextResponse.json(
            {
                error: true,
                errorReason: 'INTERNAL_ERROR',
                toastMessage: 'Internal Server Error',
                object: null
            },
            { status: 500 }
        )
    }
}
