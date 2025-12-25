
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
        console.log('[VietQR Sync] Payload:', { transactionid, amount, content, transType, notificationType })

        // Only process incoming transfers (Credit)
        // VietQR spec: transType 'C' or '+' 
        if (transType !== 'C' && transType !== '+') {
            console.log('[VietQR Sync] Skipped: Not a credit transaction', transType)
            return NextResponse.json({ code: '00', desc: 'Ignored non-credit transaction', data: null })
        }

        // Parse booking code from content
        // Regex to find "NERD" followed by optional space/dash and then alphanumeric code (including dashes)
        // Supports: "NERD-123", "NERD 123", "NERD123", "NERD-2024-001"
        const bookingCodeMatch = (content || '').match(/NERD[- ]?([a-zA-Z0-9-]+)/i)

        if (!bookingCodeMatch) {
            console.log('[VietQR Sync] No booking code found in content:', content)
            return NextResponse.json({ code: '00', desc: 'No booking code found', data: { status: false } })
        }

        // Standardize: If user typed "NERD123", we might want to treat it as "NERD-123" if that's how it's stored
        // OR just extract the ID part if your system relies on ID. 
        // Assuming your DB stores "NERD-123":
        // let rawCode = bookingCodeMatch[1].toUpperCase()
        // const bookingCode = `NERD-${rawCode}` 

        // HOWEVER, based on previous regex /NERD-\d{8}-\d{3}/, it seems strict.
        // Let's rely on the FULL match normalized.

        let extractedCode = bookingCodeMatch[0].toUpperCase();
        // Normalize: Ensure it has a dash if your DB expects "NERD-..." but user typed "NERD..."
        // If DB has "NERD-123" and user typed "NERD123", we need to insert dash.
        if (!extractedCode.includes('-') && !extractedCode.includes(' ')) {
            // "NERD123" -> "NERD-123"
            extractedCode = extractedCode.replace('NERD', 'NERD-');
        } else if (extractedCode.includes(' ')) {
            // "NERD 123" -> "NERD-123"
            extractedCode = extractedCode.replace(' ', '-');
        }

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
            // Try fuzzy search just in case? (Optional)
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
