import { sendBookingEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { applyWalletTransaction, processVietQRWalletTopup, recordBankTransaction } from '@/lib/wallet-ledger'
import { WalletTransactionSource } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type VietQRTransactionSyncPayload = {
    bankaccount?: string
    amount?: string | number
    transType?: string
    content?: string
    transactionid?: string
    transactiontime?: string | number
    referencenumber?: string
    orderId?: string
    sign?: string
}

function jsonError(errorReason: string, toastMessage: string, status = 400) {
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
        object: { reftransactionid },
    })
}

function parseTransactionTime(value: string | number | undefined) {
    if (value === undefined || value === null || String(value).trim() === '') return new Date()
    const parsed = new Date(Number(value))
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

async function findUserIdForWalletCredit(input: {
    userId?: string | null
    email?: string | null
    phone?: string | null
}) {
    if (input.userId) return input.userId

    const conditions: Array<{ email?: string; phone?: string }> = []
    if (input.email) conditions.push({ email: input.email })
    if (input.phone) conditions.push({ phone: input.phone })
    if (conditions.length === 0) return null

    const user = await prisma.user.findFirst({
        where: { OR: conditions },
        select: { id: true },
    })

    return user?.id || null
}

async function creditCancelledPaymentToWallet(input: {
    bankTransactionId: string
    externalTransactionId: string
    amount: number
    userId?: string | null
    email?: string | null
    phone?: string | null
    source: WalletTransactionSource
    referenceType: string
    referenceId: string
    description: string
    rawPayload: unknown
}) {
    const userId = await findUserIdForWalletCredit(input)
    if (!userId) {
        await prisma.bankTransaction.update({
            where: { id: input.bankTransactionId },
            data: { status: 'ERROR', note: 'Cancelled payment matched but no user wallet found' },
        })
        return { credited: false, reason: 'NO_USER_WALLET' }
    }

    const walletAccount = await ensureUserWalletAccount(userId)
    if (!walletAccount.success) {
        await prisma.bankTransaction.update({
            where: { id: input.bankTransactionId },
            data: { status: 'ERROR', note: walletAccount.message },
        })
        return { credited: false, reason: walletAccount.reason }
    }

    const walletResult = await applyWalletTransaction({
        walletId: walletAccount.wallet.id,
        type: 'REFUND',
        amount: input.amount,
        source: input.source,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        externalTransactionId: input.externalTransactionId,
        description: input.description,
        rawPayload: input.rawPayload,
    })

    await prisma.bankTransaction.update({
        where: { id: input.bankTransactionId },
        data: {
            status: walletResult.alreadyProcessed ? 'DUPLICATE' : 'MATCHED',
            matchedWalletId: walletAccount.wallet.id,
            matchedTransactionId: walletResult.transaction.id,
            note: walletResult.alreadyProcessed
                ? 'Duplicate cancelled payment wallet credit'
                : 'Credited cancelled payment to wallet',
        },
    })

    return {
        credited: true,
        alreadyProcessed: walletResult.alreadyProcessed,
        walletTransaction: walletResult.transaction,
    }
}

export async function POST(request: NextRequest) {
    try {
        const jwtSecret = process.env.VIETQR_WEBHOOK_SECRET
        if (!jwtSecret) {
            return jsonError('SERVER_MISCONFIG', 'Missing VIETQR_WEBHOOK_SECRET', 500)
        }

        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return jsonError('E74', 'Authorization header is missing or invalid', 400)
        }

        try {
            jwt.verify(authHeader.split(' ')[1], jwtSecret, { algorithms: ['HS512', 'HS256'] })
        } catch {
            return jsonError('E74', 'Invalid or expired token', 400)
        }

        let body: VietQRTransactionSyncPayload
        try {
            body = (await request.json()) as VietQRTransactionSyncPayload
        } catch {
            return jsonError('INVALID_JSON', 'Body must be valid JSON', 400)
        }

        const { transactionid, amount, content, transType, transactiontime, bankaccount } = body
        if (!transactionid) {
            return jsonError('INVALID_PAYLOAD', 'Missing transactionid', 400)
        }

        const transactionAmount = Number(amount)
        if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
            return jsonError('INVALID_AMOUNT', 'Invalid amount', 400)
        }

        const finalPaidAt = parseTransactionTime(transactiontime)
        const contentStr = (content || '').trim().toUpperCase()

        const existedPayment = await prisma.payment.findFirst({
            where: { transactionId: transactionid },
            select: { id: true },
        })
        const existedWalletTransaction = await prisma.walletTransaction.findUnique({
            where: { externalTransactionId: transactionid },
            select: { id: true },
        })

        if (existedPayment || existedWalletTransaction) {
            await recordBankTransaction({
                externalTransactionId: transactionid,
                bankAccount: bankaccount,
                amount: Math.round(transactionAmount),
                transType,
                content,
                transactionTime: finalPaidAt,
                status: 'DUPLICATE',
                rawPayload: body,
                note: 'Already processed',
            })
            return jsonOk('Already processed', transactionid)
        }

        if (contentStr.match(/(?:^|\s)VI\s+([A-Z0-9]+)/i)) {
            const result = await processVietQRWalletTopup({
                externalTransactionId: transactionid,
                bankAccount: bankaccount,
                amount: Math.round(transactionAmount),
                transType,
                content,
                transactionTime: finalPaidAt,
                rawPayload: body,
            })

            return jsonOk(result.message, transactionid)
        }

        const { bankTransaction, duplicate } = await recordBankTransaction({
            externalTransactionId: transactionid,
            bankAccount: bankaccount,
            amount: Math.round(transactionAmount),
            transType,
            content,
            transactionTime: finalPaidAt,
            status: transType === 'C' ? 'PENDING' : 'IGNORED',
            rawPayload: body,
            note: transType === 'C' ? undefined : 'Ignored non-credit transaction',
        })

        if (duplicate) {
            return jsonOk('Duplicate bank transaction', transactionid)
        }

        if (transType !== 'C') {
            return jsonOk('Ignored non-credit transaction', transactionid)
        }

        const commonMatch = contentStr.match(/(NERD|MB|NP)[- ]?(\d{8})[- ]?(\d{3})/i)
        if (!commonMatch) {
            await prisma.bankTransaction.update({
                where: { id: bankTransaction.id },
                data: { status: 'ERROR', note: 'No valid code found in transfer content' },
            })
            return jsonOk('No valid code found in transfer content', transactionid)
        }

        const prefix = commonMatch[1].toUpperCase()
        const extractedCode = `${prefix}-${commonMatch[2]}-${commonMatch[3]}`

        if (prefix === 'NERD') {
            const booking = await prisma.booking.findFirst({
                where: {
                    bookingCode: extractedCode,
                    status: 'PENDING',
                },
                include: { user: true },
            })

            if (booking) {
                await prisma.$transaction([
                    prisma.booking.update({
                        where: { id: booking.id },
                        data: {
                            status: 'CONFIRMED',
                            depositStatus: 'PAID_ONLINE',
                            depositPaidAt: finalPaidAt,
                        },
                    }),
                    prisma.payment.updateMany({
                        where: { bookingId: booking.id },
                        data: {
                            status: 'COMPLETED',
                            transactionId: transactionid,
                            paidAt: finalPaidAt,
                            amount: Math.round(transactionAmount),
                        },
                    }),
                    prisma.bankTransaction.update({
                        where: { id: bankTransaction.id },
                        data: { status: 'MATCHED', note: `Matched booking ${booking.bookingCode}` },
                    }),
                ])

                const emailRecipient = booking.customerEmail || booking.user?.email
                if (emailRecipient) {
                    try {
                        const fullBooking = await prisma.booking.findUnique({
                            where: { id: booking.id },
                            include: { location: true, room: true, user: true },
                        })
                        if (fullBooking) await sendBookingEmail(fullBooking)
                    } catch (emailError) {
                        console.error('[VietQR Sync] Email error:', emailError)
                    }
                }

                return jsonOk('Booking processed successfully', transactionid)
            }

            const cancelledBooking = await prisma.booking.findFirst({
                where: {
                    bookingCode: extractedCode,
                    status: 'CANCELLED',
                },
            })

            if (cancelledBooking) {
                const creditResult = await creditCancelledPaymentToWallet({
                    bankTransactionId: bankTransaction.id,
                    externalTransactionId: transactionid,
                    amount: Math.round(transactionAmount),
                    userId: cancelledBooking.userId,
                    email: cancelledBooking.customerEmail,
                    phone: cancelledBooking.customerPhone,
                    source: 'BOOKING',
                    referenceType: 'booking',
                    referenceId: cancelledBooking.id,
                    description: `Cộng ví do thanh toán sau khi booking ${cancelledBooking.bookingCode} đã hủy`,
                    rawPayload: body,
                })

                return jsonOk(
                    creditResult.credited
                        ? 'Cancelled booking payment credited to wallet'
                        : 'Cancelled booking payment needs reconciliation',
                    transactionid
                )
            }
        }

        if (prefix === 'MB' || prefix === 'NP') {
            const regOrder = await prisma.registrationOrder.findFirst({
                where: {
                    orderCode: extractedCode,
                    orderStatus: 'PENDING_PAYMENT',
                },
            })

            if (regOrder) {
                await prisma.$transaction([
                    prisma.registrationOrder.update({
                        where: { id: regOrder.id },
                        data: {
                            orderStatus: 'PAID',
                            paidAt: finalPaidAt,
                            paymentRef: transactionid,
                        },
                    }),
                    prisma.subscriptionAuditLog.create({
                        data: {
                            action: 'payment_confirmed_webhook',
                            entityType: 'registration_order',
                            entityId: regOrder.id,
                            performedBy: 'system_webhook',
                            details: {
                                transactionid,
                                amount: Math.round(transactionAmount),
                                orderCode: extractedCode,
                            },
                        },
                    }),
                    prisma.bankTransaction.update({
                        where: { id: bankTransaction.id },
                        data: { status: 'MATCHED', note: `Matched registration order ${regOrder.orderCode}` },
                    }),
                ])

                try {
                    const { sendSubscriptionPaidEmail } = await import('@/lib/email')
                    await sendSubscriptionPaidEmail(regOrder)
                } catch (emailError) {
                    console.error('[VietQR Sync] Subscription email error:', emailError)
                }

                return jsonOk('RegistrationOrder processed successfully', transactionid)
            }

            const cancelledOrder = await prisma.registrationOrder.findFirst({
                where: {
                    orderCode: extractedCode,
                    orderStatus: 'CANCELLED',
                },
            })

            if (cancelledOrder) {
                const creditResult = await creditCancelledPaymentToWallet({
                    bankTransactionId: bankTransaction.id,
                    externalTransactionId: transactionid,
                    amount: Math.round(transactionAmount),
                    userId: cancelledOrder.userId,
                    email: cancelledOrder.email,
                    phone: cancelledOrder.phone,
                    source: 'MONTHLY_BEAVER',
                    referenceType: 'registration_order',
                    referenceId: cancelledOrder.id,
                    description: `Cộng ví do thanh toán sau khi đơn ${cancelledOrder.orderCode} đã hủy`,
                    rawPayload: body,
                })

                return jsonOk(
                    creditResult.credited
                        ? 'Cancelled registration order payment credited to wallet'
                        : 'Cancelled registration order payment needs reconciliation',
                    transactionid
                )
            }
        }

        await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: { status: 'ERROR', note: `No matching order found for ${extractedCode}` },
        })

        return jsonOk('No matching order found', transactionid)
    } catch (error) {
        console.error('[VietQR Sync] Fatal error:', error)
        return NextResponse.json(
            { error: true, errorReason: 'E05', toastMessage: 'Internal Server Error', object: null },
            { status: 500 }
        )
    }
}
