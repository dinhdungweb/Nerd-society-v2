import { prisma } from '@/lib/prisma'
import { localDateOnly, splitMinutesByLocalDay } from '@/lib/subscription/date-utils'
import {
    DEFAULT_RATE_PER_HOUR,
    calculateDailyCapSessionUsage,
    calculateOverageCharge,
    getSubscriptionDailyCapMin,
    roundUpToIncrement,
} from '@/lib/subscription/usage-billing'
import { applyWalletTransaction } from '@/lib/wallet-ledger'
import { $Enums } from '@prisma/client'
import { differenceInMinutes } from 'date-fns'

const MIN_WALLET_BALANCE = DEFAULT_RATE_PER_HOUR / 4

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

            const dailyCapMin = getSubscriptionDailyCapMin(activeSub)
            let remainingMin: number | undefined
            if (dailyCapMin) {
                const today = localDateOnly(now)
                const usageToday = await prisma.dailyUsage.findUnique({
                    where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
                })

                const usedMin = usageToday?.totalMin || 0
                remainingMin = Math.max(0, dailyCapMin - usedMin)
                if (remainingMin <= 0) {
                    return {
                        success: false,
                        message: 'Ban da su dung het 8h mien phi hom nay. Vui long quay lai vao ngay mai hoac dung vi.',
                        errorType: 'BLOCK_CAP_REACHED',
                    }
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
                message:
                    remainingMin === undefined
                        ? `Chao ${subscriber.fullName}!`
                        : `Chao ${subscriber.fullName}! Hom nay ban con ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m.`,
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
                include: {
                    subscription: { select: { dailyLimitMin: true, planType: true } },
                },
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
    const roundedMin = roundUpToIncrement(durationMin)
    let message = `Tam biet ${subscriber.fullName}! Phien ngoi cua ban keo dai ${Math.floor(durationMin / 60)}h ${durationMin % 60}m.`
    let overageMin = 0
    let amountCharged = 0

    if (session.subscriptionId) {
        const dailyCapMin = getSubscriptionDailyCapMin(session.subscription)

        if (dailyCapMin) {
            const segments = splitMinutesByLocalDay(session.checkInTime, now, durationMin)

            for (const segment of segments) {
                const usageBefore = await prisma.dailyUsage.findUnique({
                    where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: segment.usageDate } },
                })
                const billing = calculateDailyCapSessionUsage({
                    durationMin: segment.minutes,
                    usedMinBefore: usageBefore?.totalMin || 0,
                    dailyCapMin,
                })
                overageMin += billing.overageMin

                if (billing.includedMin > 0) {
                    await prisma.dailyUsage.upsert({
                        where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: segment.usageDate } },
                        create: {
                            subscriberId: subscriber.id,
                            subscriptionId: session.subscriptionId,
                            usageDate: segment.usageDate,
                            totalMin: billing.includedMin,
                        },
                        update: { totalMin: { increment: billing.includedMin } },
                    })
                }
            }

            amountCharged = calculateOverageCharge(overageMin).overageCharge
        }

        await prisma.subscription.update({
            where: { id: session.subscriptionId },
            data: { usedHoursMin: { increment: durationMin } },
        })

        if (amountCharged > 0) {
            await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { outstandingBalance: { increment: amountCharged } },
            })

            await prisma.transaction.create({
                data: {
                    subscriberId: subscriber.id,
                    type: 'OVERAGE_CHARGE' as $Enums.TransactionType,
                    amount: -amountCharged,
                    balanceBefore: subscriber.user?.wallet?.balance || 0,
                    balanceAfter: subscriber.user?.wallet?.balance || 0,
                    reference: session.id,
                    description: `Phi qua gio (${overageMin}m)`,
                },
            })

            message += ` Phi qua gio: ${amountCharged.toLocaleString()}d.`
        }
    } else {
        const amount = Math.round((roundedMin / 60) * DEFAULT_RATE_PER_HOUR)
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
            overageMin,
            amountCharged,
            status: 'COMPLETED' as $Enums.SessionStatus,
        },
    })

    return { success: true, message, subscriberName: subscriber.fullName }
}
