import { sendBookingEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs' // đảm bảo chạy Node runtime (prisma/jwt)

type VietQRTransactionSyncPayload = {
    bankaccount?: string
    amount?: string | number
    transType?: string // D/C theo spec
    content?: string
    transactionid?: string
    transactiontime?: string | number // timestamp ms
    referencenumber?: string
    orderId?: string
    sign?: string
}

function jsonError(
    errorReason: string,
    toastMessage: string,
    status = 400
) {
    return NextResponse.json(
        { error: true, errorReason, toastMessage, object: null },
        { status }
    )
}

function jsonOk(toastMessage: string, reftransactionid = '') {
    return NextResponse.json({
        error: false,
        errorReason: null,
        toastMessage,
        object: { reftransactionid }
    })
}

/**
 * POST /api/payment/vietqr/bank/api/transaction-sync
 */
export async function POST(request: NextRequest) {
    try {
        const JWT_SECRET = process.env.VIETQR_WEBHOOK_SECRET
        if (!JWT_SECRET) {
            // Đừng fallback secret ở prod
            return jsonError('SERVER_MISCONFIG', 'Missing VIETQR_WEBHOOK_SECRET', 500)
        }

        // 0) Debug log
        const authHeader = request.headers.get('authorization')
        console.log('[VietQR Sync] INCOMING REQUEST ---------------------------')
        console.log('[VietQR Sync] Headers:', Object.fromEntries(request.headers))
        console.log('[VietQR Sync] Auth Header:', authHeader)

        // 1) Verify Bearer Token
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // dùng E74 để VietQR dễ hiểu là token invalid
            return jsonError('E74', 'Authorization header is missing or invalid', 400)
        }

        const token = authHeader.split(' ')[1]
        try {
            jwt.verify(token, JWT_SECRET, { algorithms: ['HS512', 'HS256'] })
        } catch (err) {
            return jsonError('E74', 'Invalid or expired token', 400)
        }

        // 2) Parse body
        let body: VietQRTransactionSyncPayload
        try {
            body = (await request.json()) as VietQRTransactionSyncPayload
        } catch {
            return jsonError('INVALID_JSON', 'Body must be valid JSON', 400)
        }

        console.log('[VietQR Sync] Received:', JSON.stringify(body, null, 2))

        const {
            transactionid,
            amount,
            content,
            transType,
            transactiontime
        } = body

        if (!transactionid) {
            return jsonError('INVALID_PAYLOAD', 'Missing transactionid', 400)
        }

        // 3) Idempotency: nếu transactionid đã được ghi nhận -> OK luôn
        const existed = await prisma.payment.findFirst({
            where: { transactionId: transactionid },
            select: { id: true, bookingId: true }
        })

        if (existed) {
            console.log('[VietQR Sync] Idempotent hit - already processed:', transactionid)
            return jsonOk('Already processed', transactionid)
        }

        // 4) Only process credit transactions
        // Spec: transType D/C
        if (transType !== 'C') {
            console.log('[VietQR Sync] Ignored non-credit transaction:', transType)
            return jsonOk('Ignored non-credit transaction', transactionid)
        }

        // 5) Parse content to determine transaction type
        const contentStr = (content || '').trim().toUpperCase()
        const transactionAmount = Number(amount)
        if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
            return jsonError('INVALID_AMOUNT', 'Invalid amount', 400)
        }

        const paidAt =
            transactiontime !== undefined && transactiontime !== null && String(transactiontime).trim() !== ''
                ? new Date(Number(transactiontime))
                : new Date()

        const finalPaidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt

        // ===== Pattern A: Wallet Topup — "TU {empId}" =====
        const topupMatch = contentStr.match(/TU\s+(\S+)/i)
        if (topupMatch) {
            const empId = topupMatch[1]
            console.log('[VietQR Sync] Topup detected for empId:', empId)

            // Tìm subscriber theo empId (myTimeEmployeeId)
            const subscriber = await prisma.subscriber.findFirst({
                where: { myTimeEmployeeId: empId }
            })

            if (!subscriber) {
                console.log('[VietQR Sync] No subscriber found for empId:', empId)
                return jsonOk('No subscriber found for topup empId', transactionid)
            }

            // Gọi topUpWallet để cộng tiền
            const { topUpWallet } = await import('@/lib/subscription/wallet-actions')
            const result = await topUpWallet(
                subscriber.id,
                transactionAmount,
                transactionid,
                `Nạp ví qua VietQR — ${transactionAmount.toLocaleString()}đ`
            )

            if (!result.success) {
                console.error('[VietQR Sync] Topup wallet failed:', result.error)
                return jsonError('TOPUP_FAILED', result.error || 'Topup failed', 500)
            }

            // Lưu Payment record để idempotency check lần sau
            await prisma.payment.create({
                data: {
                    transactionId: transactionid,
                    amount: transactionAmount,
                    method: 'BANK_TRANSFER',
                    status: 'COMPLETED',
                    paidAt: finalPaidAt,
                    metadata: {
                        type: 'WALLET_TOPUP',
                        empId,
                        subscriberId: subscriber.id,
                        newBalance: result.newBalance
                    }
                }
            })

            console.log('[VietQR Sync] Topup success! New balance:', result.newBalance)
            return jsonOk('Wallet topup processed successfully', transactionid)
        }

        // ===== Pattern B: Booking/Subscription — "NERD-xxx" / "MB-xxx" / "NP-xxx" =====
        // Pattern 1: NERD-YYYYMMDD-XXX (Booking)
        // Pattern 2: MB-YYYYMMDD-XXX (Monthly Beaver Subscription — mới)
        // Pattern 3: NP-YYYYMMDD-XXX (Nerd Pass Subscription — cũ, backward compat)
        const commonMatch = contentStr.match(/(NERD|MB|NP)[- ]?(\d{8})[- ]?(\d{3})/i)
        if (!commonMatch) {
            console.log('[VietQR Sync] No valid code found in content:', content)
            return jsonOk('No valid code found in transfer content', transactionid)
        }

        const prefix = commonMatch[1].toUpperCase()
        const datePart = commonMatch[2]
        const seqPart = commonMatch[3]
        const extractedCode = `${prefix}-${datePart}-${seqPart}`

        console.log('[VietQR Sync] Extracted Code:', extractedCode)

        // 6) Find entity based on prefix
        if (prefix === 'NERD') {
            const booking = await prisma.booking.findFirst({
                where: {
                    bookingCode: extractedCode,
                    status: 'PENDING'
                },
                include: { user: true }
            })

            if (booking) {
                // Optional amount check (log only)
                if (transactionAmount < booking.depositAmount) {
                    console.log('[VietQR Sync] Amount is lower than depositAmount:', {
                        received: transactionAmount,
                        expected: booking.depositAmount
                    })
                }

                // Update DB (transaction)
                await prisma.$transaction([
                    prisma.booking.update({
                        where: { id: booking.id },
                        data: {
                            status: 'CONFIRMED',
                            depositStatus: 'PAID_ONLINE',
                            depositPaidAt: finalPaidAt
                        }
                    }),
                    prisma.payment.updateMany({
                        where: { bookingId: booking.id },
                        data: {
                            status: 'COMPLETED',
                            transactionId: transactionid,
                            paidAt: finalPaidAt,
                            amount: transactionAmount
                        }
                    })
                ])

                // Send email (best-effort)
                const emailRecipient = booking.customerEmail || booking.user?.email
                if (emailRecipient) {
                    try {
                        const fullBooking = await prisma.booking.findUnique({
                            where: { id: booking.id },
                            include: { location: true, room: true, user: true }
                        })
                        if (fullBooking) await sendBookingEmail(fullBooking)
                    } catch (emailError) {
                        console.error('[VietQR Sync] Email error:', emailError)
                    }
                }
                return jsonOk('Booking processed successfully', transactionid)
            }
        } else if (prefix === 'MB' || prefix === 'NP') {
            // Check RegistrationOrder (Subscription) — hỗ trợ cả MB (mới) và NP (cũ)
            const regOrder = await prisma.registrationOrder.findFirst({
                where: {
                    orderCode: extractedCode,
                    orderStatus: 'PENDING_PAYMENT'
                }
            })

            if (regOrder) {
                console.log('[VietQR Sync] Found RegistrationOrder:', extractedCode)
                
                // Update RegistrationOrder
                await prisma.registrationOrder.update({
                    where: { id: regOrder.id },
                    data: {
                        orderStatus: 'PAID',
                        paidAt: finalPaidAt,
                        paymentRef: transactionid
                    }
                })

                // Log audit
                await prisma.subscriptionAuditLog.create({
                    data: {
                        action: 'payment_confirmed_webhook',
                        entityType: 'registration_order',
                        entityId: regOrder.id,
                        performedBy: 'system_webhook',
                        details: { 
                            transactionid, 
                            amount: transactionAmount,
                            orderCode: extractedCode
                        }
                    }
                })

                // Send subscription email
                try {
                    const { sendSubscriptionPaidEmail } = await import('@/lib/email')
                    await sendSubscriptionPaidEmail(regOrder)
                } catch (emailError) {
                    console.error('[VietQR Sync] Subscription Email error:', emailError)
                }

                return jsonOk('RegistrationOrder processed successfully', transactionid)
            }
        }

        console.log('[VietQR Sync] No matching order found for:', extractedCode)
        return jsonOk('No matching order found', transactionid)
    } catch (error) {
        console.error('[VietQR Sync] Fatal error:', error)
        // E05: Unknown error
        return NextResponse.json(
            { error: true, errorReason: 'E05', toastMessage: 'Internal Server Error', object: null },
            { status: 500 }
        )
    }
}
