import { prisma } from '@/lib/prisma'
import { localDateOnly, splitMinutesByLocalDay } from '@/lib/subscription/date-utils'
import { applyWalletTransaction } from '@/lib/wallet-ledger'
import { $Enums } from '@prisma/client'
import { differenceInMinutes } from 'date-fns'

const RATE_PER_HOUR = 15000
const DAILY_CAP_MIN = 480
const MIN_WALLET_BALANCE = RATE_PER_HOUR / 4

export type CheckInResult = {
    success: boolean
    message: string
    subscriberName?: string
    remainingMin?: number
    walletBalance?: number
    outstandingBalance?: number
    errorType?: 'BLOCK_DEBT' | 'BLOCK_EXPIRED' | 'BLOCK_LOW_BALANCE' | 'BLOCK_CAP_REACHED' | 'NOT_FOUND'
}

export async function handleCheckIn(cardNo: string, branch: string, customTime?: Date): Promise<CheckInResult> {
    const now = customTime || new Date()
    const subscriber = await prisma.subscriber.findUnique({
        where: { cardNo },
        include: {
            subscriptions: {
                where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] as $Enums.SubscriptionStatus[] } },
                orderBy: { createdAt: 'desc' },
            },
            user: {
                select: {
                    wallet: { select: { id: true, balance: true } },
                },
            },
        },
    })

    if (!subscriber) {
        return { success: false, message: 'Khong tim thay thong tin the nay.', errorType: 'NOT_FOUND' }
    }

    if (subscriber.outstandingBalance > 0) {
        return {
            success: false,
            message: `Vui long thanh toan ${subscriber.outstandingBalance.toLocaleString()}d phi qua gio de tiep tuc.`,
            outstandingBalance: subscriber.outstandingBalance,
            errorType: 'BLOCK_DEBT',
        }
    }

    const activeSub = subscriber.subscriptions[0]
    if (activeSub) {
        if (activeSub.status === 'ACTIVE' && activeSub.endDate && activeSub.endDate < now) {
            await prisma.subscription.update({
                where: { id: activeSub.id },
                data: { status: 'EXPIRED' },
            })
        } else {
            if (activeSub.status === 'PENDING_ACTIVATION') {
                const endDate = new Date(now)
                endDate.setDate(endDate.getDate() + 30)

                await prisma.subscription.update({
                    where: { id: activeSub.id },
                    data: {
                        status: 'ACTIVE',
                        activationDate: now,
                        startDate: now,
                        endDate,
                    },
                })
            }

            const today = localDateOnly(now)
            const usageToday = await prisma.dailyUsage.findUnique({
                where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
            })

            const usedMin = usageToday?.totalMin || 0
            const remainingMin = Math.max(0, DAILY_CAP_MIN - usedMin)
            if (remainingMin <= 0) {
                return {
                    success: false,
                    message: 'Ban da su dung het 8h mien phi hom nay. Vui long quay lai vao ngay mai hoac dung vi.',
                    errorType: 'BLOCK_CAP_REACHED',
                }
            }

            await prisma.subscriptionSession.create({
                data: {
                    subscriberId: subscriber.id,
                    subscriptionId: activeSub.id,
                    branch,
                    checkInTime: now,
                    status: 'ACTIVE' as $Enums.SessionStatus,
                    source: 'card',
                },
            })

            return {
                success: true,
                message: `Chao ${subscriber.fullName}! Hom nay ban con ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m.`,
                subscriberName: subscriber.fullName,
                remainingMin,
            }
        }
    }

    const walletBalance = subscriber.user?.wallet?.balance || 0
    if (walletBalance < MIN_WALLET_BALANCE) {
        return {
            success: false,
            message: `So du vi (${walletBalance.toLocaleString()}d) khong du. Vui long nap them.`,
            walletBalance,
            errorType: 'BLOCK_LOW_BALANCE',
        }
    }

    await prisma.subscriptionSession.create({
        data: {
            subscriberId: subscriber.id,
            branch,
            checkInTime: now,
            status: 'ACTIVE' as $Enums.SessionStatus,
            source: 'card',
        },
    })

    return {
        success: true,
        message: `Chao ${subscriber.fullName}! So du vi: ${walletBalance.toLocaleString()}d.`,
        subscriberName: subscriber.fullName,
        walletBalance,
    }
}

export async function handleCheckOut(cardNo: string, customTime?: Date): Promise<CheckInResult> {
    const now = customTime || new Date()
    const subscriber = await prisma.subscriber.findUnique({
        where: { cardNo },
        include: {
            sessions: {
                where: { status: 'ACTIVE' as $Enums.SessionStatus, checkOutTime: null },
                orderBy: { checkInTime: 'desc' },
                take: 1,
            },
            user: {
                select: {
                    wallet: { select: { id: true, balance: true } },
                },
            },
        },
    })

    if (!subscriber || !subscriber.sessions[0]) {
        return { success: false, message: 'Khong tim thay phien check-in dang hoat dong.', errorType: 'NOT_FOUND' }
    }

    const session = subscriber.sessions[0]
    const durationMin = Math.max(1, differenceInMinutes(now, session.checkInTime))
    const roundedMin = Math.ceil(durationMin / 15) * 15
    let message = `Tam biet ${subscriber.fullName}! Phien ngoi cua ban keo dai ${Math.floor(durationMin / 60)}h ${durationMin % 60}m.`

    if (session.subscriptionId) {
        const usageSegments = splitMinutesByLocalDay(session.checkInTime, now, durationMin)
        let overageMin = 0

        for (const segment of usageSegments) {
            const usage = await prisma.dailyUsage.upsert({
                where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: segment.usageDate } },
                create: {
                    subscriberId: subscriber.id,
                    subscriptionId: session.subscriptionId,
                    usageDate: segment.usageDate,
                    totalMin: segment.minutes,
                },
                update: { totalMin: { increment: segment.minutes } },
            })

            const usedMinBefore = usage.totalMin - segment.minutes
            const capRemaining = Math.max(0, DAILY_CAP_MIN - usedMinBefore)
            overageMin += Math.max(0, segment.minutes - capRemaining)
        }

        await prisma.subscription.update({
            where: { id: session.subscriptionId },
            data: { usedHoursMin: { increment: durationMin } },
        })

        if (overageMin > 0) {
            const roundedOverage = Math.ceil(overageMin / 15) * 15
            const overageCharge = Math.round((roundedOverage / 60) * RATE_PER_HOUR)

            await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { outstandingBalance: { increment: overageCharge } },
            })

            await prisma.transaction.create({
                data: {
                    subscriberId: subscriber.id,
                    type: 'OVERAGE_CHARGE' as $Enums.TransactionType,
                    amount: -overageCharge,
                    balanceBefore: subscriber.user?.wallet?.balance || 0,
                    balanceAfter: subscriber.user?.wallet?.balance || 0,
                    reference: session.id,
                    description: `Phi qua gio (${overageMin}m)`,
                },
            })

            message += ` Phi qua gio: ${overageCharge.toLocaleString()}d.`
        }
    } else {
        const amount = Math.round((roundedMin / 60) * RATE_PER_HOUR)
        const wallet = subscriber.user?.wallet
        const walletBalance = wallet?.balance || 0
        const paidAmount = Math.min(walletBalance, amount)
        const debtAmount = Math.max(0, amount - paidAmount)

        if (wallet && paidAmount > 0) {
            await applyWalletTransaction({
                walletId: wallet.id,
                type: 'SESSION_CHARGE',
                amount: -paidAmount,
                source: 'MONTHLY_BEAVER',
                referenceType: 'subscription_session',
                referenceId: session.id,
                description: `Phi su dung Wallet (${durationMin}m)`,
            })
        }

        if (debtAmount > 0) {
            await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { outstandingBalance: { increment: debtAmount } },
            })
        }

        await prisma.transaction.create({
            data: {
                subscriberId: subscriber.id,
                type: 'SESSION_CHARGE' as $Enums.TransactionType,
                amount: -amount,
                balanceBefore: walletBalance,
                balanceAfter: walletBalance - paidAmount,
                reference: session.id,
                description: `Phi su dung Wallet (${durationMin}m)`,
            },
        })

        if (debtAmount > 0) {
            message += ` Tru vi ${paidAmount.toLocaleString()}d va ghi no ${debtAmount.toLocaleString()}d.`
        } else {
            message += ` Da tru ${paidAmount.toLocaleString()}d. So du: ${(walletBalance - paidAmount).toLocaleString()}d.`
        }
    }

    await prisma.subscriptionSession.update({
        where: { id: session.id },
        data: {
            checkOutTime: now,
            durationMin,
            status: 'COMPLETED' as $Enums.SessionStatus,
        },
    })

    return { success: true, message, subscriberName: subscriber.fullName }
}
