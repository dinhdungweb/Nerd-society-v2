import { prisma } from '@/lib/prisma'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import {
    BankTransactionStatus,
    Prisma,
    WalletTransactionSource,
    WalletTransactionType,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'

type ApplyWalletTransactionInput = {
    walletId: string
    type: WalletTransactionType
    amount: number
    source?: WalletTransactionSource
    referenceType?: string
    referenceId?: string
    externalTransactionId?: string
    description?: string
    note?: string
    createdById?: string
    rawPayload?: unknown
    allowNegativeBalance?: boolean
}

async function applyWalletTransactionInTx(
    tx: Prisma.TransactionClient,
    input: ApplyWalletTransactionInput
) {
    if (input.externalTransactionId) {
        const existing = await tx.walletTransaction.findUnique({
            where: { externalTransactionId: input.externalTransactionId },
        })

        if (existing) {
            return {
                alreadyProcessed: true,
                transaction: existing,
                balanceAfter: existing.balanceAfter,
            }
        }
    }

    const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
        select: { id: true, balance: true, status: true },
    })

    if (!wallet) throw new Error('Không tìm thấy ví')
    if (wallet.status !== 'ACTIVE') throw new Error('Ví đang bị khóa')

    const balanceBefore = wallet.balance
    const balanceAfter = balanceBefore + input.amount

    if (!input.allowNegativeBalance && balanceAfter < 0) {
        throw new Error('Số dư ví không đủ')
    }

    await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
    })

    const transaction = await tx.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: input.type,
            amount: input.amount,
            balanceBefore,
            balanceAfter,
            source: input.source || 'SYSTEM',
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            externalTransactionId: input.externalTransactionId,
            description: input.description,
            note: input.note,
            createdById: input.createdById,
            rawPayload: input.rawPayload as any,
        },
    })

    return {
        alreadyProcessed: false,
        transaction,
        balanceAfter,
    }
}

export async function applyWalletTransaction(input: ApplyWalletTransactionInput) {
    if (!Number.isInteger(input.amount) || input.amount === 0) {
        throw new Error('Số tiền giao dịch ví không hợp lệ')
    }

    const result = await prisma.$transaction((tx) => applyWalletTransactionInTx(tx, input))

    revalidatePath('/profile/wallet')
    revalidatePath('/profile/monthly-beaver')
    revalidatePath('/admin/wallets')
    revalidatePath('/admin/subscriptions')

    return result
}

async function findRefundUserId(input: {
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

const REFUNDABLE_BOOKING_METHODS = new Set(['BANK_TRANSFER', 'WALLET', 'VNPAY', 'MOMO', 'ZALOPAY'])

export async function refundBookingPaymentToWallet(input: {
    bookingId: string
    note?: string
    createdById?: string
}) {
    const booking = await prisma.booking.findUnique({
        where: { id: input.bookingId },
        include: { payment: true },
    })

    if (!booking) {
        return { refunded: false, reason: 'BOOKING_NOT_FOUND' }
    }

    const payment = booking.payment
    const hasRefundablePayment =
        payment?.status === 'COMPLETED' &&
        !payment.refundedAt &&
        REFUNDABLE_BOOKING_METHODS.has(payment.method)
    const hasPaidOnlineDepositWithoutPayment =
        !payment && booking.depositStatus === 'PAID_ONLINE' && !!booking.depositPaidAt

    if (!hasRefundablePayment && !hasPaidOnlineDepositWithoutPayment) {
        return { refunded: false, reason: 'NO_REFUNDABLE_PAYMENT' }
    }

    const amount = Math.round(payment?.amount || booking.depositAmount || 0)
    if (amount <= 0) {
        return { refunded: false, reason: 'INVALID_REFUND_AMOUNT' }
    }

    const userId = await findRefundUserId({
        userId: booking.userId,
        email: booking.customerEmail,
        phone: booking.customerPhone,
    })

    if (!userId) {
        return { refunded: false, reason: 'NO_USER_WALLET' }
    }

    const walletAccount = await ensureUserWalletAccount(userId)
    if (!walletAccount.success) {
        return { refunded: false, reason: walletAccount.reason, message: walletAccount.message }
    }

    const refundedAt = new Date()
    const result = await prisma.$transaction(async (tx) => {
        const walletResult = await applyWalletTransactionInTx(tx, {
            walletId: walletAccount.wallet.id,
            type: 'REFUND',
            amount,
            source: 'BOOKING',
            referenceType: 'booking',
            referenceId: booking.id,
            externalTransactionId: `REFUND-BOOKING-${booking.id}`,
            description: `Hoàn tiền cọc booking ${booking.bookingCode}`,
            note: input.note,
            createdById: input.createdById,
        })

        if (payment) {
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'REFUNDED',
                    refundedAt,
                },
            })
        }

        if (!booking.userId) {
            await tx.booking.update({
                where: { id: booking.id },
                data: { userId },
            })
        }

        return walletResult
    })

    revalidatePath('/profile/wallet')
    revalidatePath('/profile/bookings')
    revalidatePath('/admin/wallets')
    revalidatePath('/admin/bookings')

    return {
        refunded: true,
        alreadyProcessed: result.alreadyProcessed,
        amount,
        walletTransaction: result.transaction,
        newBalance: result.balanceAfter,
    }
}

export async function refundRegistrationOrderToWallet(input: {
    orderId: string
    note?: string
    createdById?: string
}) {
    const order = await prisma.registrationOrder.findUnique({
        where: { id: input.orderId },
        include: {
            subscriber: { select: { userId: true } },
        },
    })

    if (!order) {
        return { refunded: false, reason: 'ORDER_NOT_FOUND' }
    }

    const isPaid = !!order.paidAt || !!order.paymentRef || ['PAID', 'CARD_ASSIGNED', 'ACTIVATED'].includes(order.orderStatus)
    if (!isPaid) {
        return { refunded: false, reason: 'ORDER_NOT_PAID' }
    }

    if (order.paymentMethod && order.paymentMethod !== 'online') {
        return { refunded: false, reason: 'NON_ONLINE_PAYMENT' }
    }

    const amount = Math.round(order.amount || 0)
    if (amount <= 0) {
        return { refunded: false, reason: 'INVALID_REFUND_AMOUNT' }
    }

    const userId = await findRefundUserId({
        userId: order.userId || order.subscriber?.userId,
        email: order.email,
        phone: order.phone,
    })

    if (!userId) {
        return { refunded: false, reason: 'NO_USER_WALLET' }
    }

    const walletAccount = await ensureUserWalletAccount(userId)
    if (!walletAccount.success) {
        return { refunded: false, reason: walletAccount.reason, message: walletAccount.message }
    }

    const result = await prisma.$transaction((tx) => applyWalletTransactionInTx(tx, {
        walletId: walletAccount.wallet.id,
        type: 'REFUND',
        amount,
        source: 'MONTHLY_BEAVER',
        referenceType: 'registration_order',
        referenceId: order.id,
        externalTransactionId: `REFUND-MB-${order.id}`,
        description: `Hoàn tiền gói Monthly Beaver ${order.orderCode}`,
        note: input.note,
        createdById: input.createdById,
    }))

    revalidatePath('/profile/wallet')
    revalidatePath('/profile/monthly-beaver')
    revalidatePath('/admin/wallets')
    revalidatePath('/admin/subscriptions')

    return {
        refunded: true,
        alreadyProcessed: result.alreadyProcessed,
        amount,
        walletTransaction: result.transaction,
        newBalance: result.balanceAfter,
    }
}

export async function recordBankTransaction(input: {
    externalTransactionId: string
    bankAccount?: string | null
    amount: number
    transType?: string | null
    content?: string | null
    transactionTime?: Date | null
    status?: BankTransactionStatus
    rawPayload?: unknown
    note?: string | null
}) {
    const existing = await prisma.bankTransaction.findUnique({
        where: { externalTransactionId: input.externalTransactionId },
    })

    if (existing) {
        if (existing.status === 'MATCHED') return { bankTransaction: existing, duplicate: true }

        const bankTransaction = await prisma.bankTransaction.update({
            where: { id: existing.id },
            data: {
                status: existing.status === 'PENDING' ? 'DUPLICATE' : existing.status,
                note: input.note || existing.note,
            },
        })
        return { bankTransaction, duplicate: true }
    }

    const bankTransaction = await prisma.bankTransaction.create({
        data: {
            externalTransactionId: input.externalTransactionId,
            bankAccount: input.bankAccount || undefined,
            amount: input.amount,
            transType: input.transType || undefined,
            content: input.content || undefined,
            transactionTime: input.transactionTime || undefined,
            status: input.status || 'PENDING',
            rawPayload: input.rawPayload as any,
            note: input.note || undefined,
        },
    })

    return { bankTransaction, duplicate: false }
}

export function extractWalletCode(content: string) {
    const match = content.toUpperCase().match(/(?:^|\s)VI\s+([A-Z0-9]+)/)
    return match?.[1] || null
}

export async function processVietQRWalletTopup(input: {
    externalTransactionId: string
    bankAccount?: string | null
    amount: number
    transType?: string | null
    content?: string | null
    transactionTime?: Date | null
    rawPayload?: unknown
}) {
    const { bankTransaction, duplicate } = await recordBankTransaction({
        ...input,
        status: 'PENDING',
    })

    if (duplicate && bankTransaction.status === 'MATCHED') {
        return {
            success: true,
            alreadyProcessed: true,
            bankTransaction,
            message: 'Giao dịch đã được xử lý',
        }
    }

    if (input.transType && input.transType !== 'C') {
        const updated = await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: { status: 'IGNORED', note: 'Ignored non-credit transaction' },
        })
        return { success: false, bankTransaction: updated, message: 'Ignored non-credit transaction' }
    }

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
        const updated = await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: { status: 'ERROR', note: 'Invalid amount' },
        })
        return { success: false, bankTransaction: updated, message: 'Invalid amount' }
    }

    const walletCode = extractWalletCode(input.content || '')
    if (!walletCode) {
        const updated = await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: { status: 'ERROR', note: 'Không tìm thấy mã ví trong nội dung chuyển khoản' },
        })
        return { success: false, bankTransaction: updated, message: 'Không tìm thấy mã ví' }
    }

    const wallet = await prisma.wallet.findUnique({
        where: { walletCode },
        select: { id: true },
    })

    if (!wallet) {
        const updated = await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: { status: 'ERROR', note: `Không tìm thấy ví: ${walletCode}` },
        })
        return { success: false, bankTransaction: updated, message: 'Không tìm thấy ví' }
    }

    const walletResult = await applyWalletTransaction({
        walletId: wallet.id,
        type: 'TOPUP',
        amount: input.amount,
        source: 'VIETQR',
        referenceType: 'bank_transaction',
        referenceId: bankTransaction.id,
        externalTransactionId: input.externalTransactionId,
        description: `Nạp Ví Nerd qua VietQR: ${walletCode}`,
        rawPayload: input.rawPayload,
    })

    const updated = await prisma.bankTransaction.update({
        where: { id: bankTransaction.id },
        data: {
            status: walletResult.alreadyProcessed ? 'DUPLICATE' : 'MATCHED',
            matchedWalletId: wallet.id,
            matchedTransactionId: walletResult.transaction.id,
            note: walletResult.alreadyProcessed ? 'Duplicate topup transaction' : null,
        },
    })

    return {
        success: !walletResult.alreadyProcessed,
        alreadyProcessed: walletResult.alreadyProcessed,
        bankTransaction: updated,
        walletTransaction: walletResult.transaction,
        newBalance: walletResult.balanceAfter,
        message: walletResult.alreadyProcessed ? 'Giao dịch đã được xử lý' : 'Đã nạp tiền vào ví',
    }
}

export async function paySubscriberDebtWithWallet(input: {
    subscriberId: string
    amount?: number
    createdById?: string
    note?: string
}) {
    const result = await prisma.$transaction(async (tx) => {
        const subscriber = await tx.subscriber.findUnique({
            where: { id: input.subscriberId },
            select: {
                id: true,
                fullName: true,
                outstandingBalance: true,
                user: {
                    select: {
                        wallet: {
                            select: { id: true, balance: true, status: true },
                        },
                    },
                },
            },
        })

        if (!subscriber) throw new Error('Không tìm thấy hội viên')
        if (!subscriber.user?.wallet) throw new Error('Hội viên chưa có ví user')
        if (subscriber.user.wallet.status !== 'ACTIVE') throw new Error('Ví đang bị khóa')
        if (subscriber.outstandingBalance <= 0) throw new Error('Hội viên không có công nợ')

        const payAmount = Math.min(
            input.amount || subscriber.outstandingBalance,
            subscriber.outstandingBalance,
            subscriber.user.wallet.balance
        )

        if (payAmount <= 0) throw new Error('Số dư ví không đủ để thanh toán nợ')

        const balanceBefore = subscriber.user.wallet.balance
        const balanceAfter = balanceBefore - payAmount

        const transaction = await tx.walletTransaction.create({
            data: {
                walletId: subscriber.user.wallet.id,
                type: 'OVERAGE_PAYMENT',
                amount: -payAmount,
                balanceBefore,
                balanceAfter,
                source: 'MONTHLY_BEAVER',
                referenceType: 'subscriber',
                referenceId: subscriber.id,
                description: `Thanh toán nợ quá giờ Monthly Beaver cho ${subscriber.fullName}`,
                note: input.note,
                createdById: input.createdById,
            },
        })

        await tx.wallet.update({
            where: { id: subscriber.user.wallet.id },
            data: { balance: balanceAfter },
        })

        await tx.subscriber.update({
            where: { id: subscriber.id },
            data: { outstandingBalance: { decrement: payAmount } },
        })

        return {
            paidAmount: payAmount,
            remainingDebt: subscriber.outstandingBalance - payAmount,
            newWalletBalance: balanceAfter,
            walletTransaction: transaction,
        }
    })

    revalidatePath('/admin/wallets')
    revalidatePath('/admin/subscriptions')
    revalidatePath('/profile/monthly-beaver')

    return result
}
