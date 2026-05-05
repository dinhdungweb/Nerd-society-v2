import { authOptions } from '@/lib/auth'
import { sendBookingEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { bookingId } = await req.json()
        if (!bookingId) {
            return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
        }

        const [booking, user] = await Promise.all([
            prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    payment: true,
                    user: true,
                    location: true,
                    room: true,
                },
            }),
            prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, email: true, phone: true },
            }),
        ])

        if (!booking || !user) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
        }

        if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
            return NextResponse.json({ error: 'Không thể thanh toán booking này bằng ví' }, { status: 400 })
        }

        const canOwnBooking =
            booking.userId === user.id ||
            (!booking.userId && (
                booking.customerEmail?.toLowerCase() === user.email.toLowerCase() ||
                (!!user.phone && booking.customerPhone === user.phone)
            ))

        if (!canOwnBooking) {
            return NextResponse.json({ error: 'Bạn không có quyền thanh toán booking này' }, { status: 403 })
        }

        const walletAccount = await ensureUserWalletAccount(user.id)
        if (!walletAccount.success) {
            return NextResponse.json({ error: walletAccount.message }, { status: 400 })
        }

        if (walletAccount.wallet.balance < booking.depositAmount) {
            return NextResponse.json({
                error: `Số dư Ví Nerd không đủ. Cần ${booking.depositAmount.toLocaleString()}đ, hiện có ${walletAccount.wallet.balance.toLocaleString()}đ.`,
            }, { status: 400 })
        }

        const paidAt = new Date()
        const transactionReference = `WALLET-${booking.bookingCode}`
        const walletTransaction = await prisma.$transaction(async (tx) => {
            const existingTransaction = await tx.walletTransaction.findUnique({
                where: { externalTransactionId: transactionReference },
            })

            let transaction = existingTransaction
            let balanceAfter = existingTransaction?.balanceAfter

            if (!transaction) {
                const wallet = await tx.wallet.findUnique({
                    where: { id: walletAccount.wallet.id },
                    select: { id: true, balance: true, status: true },
                })

                if (!wallet) throw new Error('Không tìm thấy ví')
                if (wallet.status !== 'ACTIVE') throw new Error('Ví đang bị khóa')
                if (wallet.balance < booking.depositAmount) throw new Error('Số dư ví không đủ')

                const balanceBefore = wallet.balance
                balanceAfter = balanceBefore - booking.depositAmount

                await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: balanceAfter },
                })

                transaction = await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'BOOKING_PAYMENT',
                        amount: -booking.depositAmount,
                        balanceBefore,
                        balanceAfter,
                        source: 'BOOKING',
                        referenceType: 'booking',
                        referenceId: booking.id,
                        externalTransactionId: transactionReference,
                        description: `Thanh toán cọc đặt lịch ${booking.bookingCode}`,
                    },
                })
            }

            await tx.payment.upsert({
                where: { bookingId },
                create: {
                    bookingId,
                    amount: booking.depositAmount,
                    method: 'WALLET',
                    status: 'COMPLETED',
                    transactionId: transaction.id,
                    paidAt,
                },
                update: {
                    amount: booking.depositAmount,
                    method: 'WALLET',
                    status: 'COMPLETED',
                    transactionId: transaction.id,
                    paidAt,
                },
            })

            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    userId: booking.userId || user.id,
                    status: 'CONFIRMED',
                    depositStatus: 'PAID_ONLINE',
                    depositPaidAt: paidAt,
                    paymentStartedAt: booking.paymentStartedAt || paidAt,
                },
            })

            return { transaction, balanceAfter: balanceAfter ?? transaction.balanceAfter }
        })

        const updatedBooking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                user: true,
                location: true,
                room: true,
                payment: true,
            },
        })

        if (updatedBooking) {
            await sendBookingEmail(updatedBooking)
        }

        return NextResponse.json({
            success: true,
            message: 'Thanh toán bằng Ví Nerd thành công',
            currentBalance: walletTransaction.balanceAfter,
        })
    } catch (error: any) {
        console.error('[WalletPayment] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
