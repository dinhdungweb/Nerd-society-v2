import { prisma } from '@/lib/prisma'
import { businessDateOnly, splitMinutesByLocalDay } from '@/lib/subscription/date-utils'
import {
  DEFAULT_RATE_PER_HOUR,
  getSubscriptionDailyCapMin,
  roundUpToIncrement,
} from '@/lib/subscription/usage-billing'
import { applyWalletTransactionInTx } from '@/lib/wallet-ledger'
import { Prisma } from '@prisma/client'

const MIN_WALLET_BALANCE = DEFAULT_RATE_PER_HOUR / 4
const OVERAGE_RATE_PER_MINUTE = 250
const AUTO_CLOSE_AFTER_MS = 10 * 60 * 60 * 1000
export type CheckInErrorType =
  | 'BLOCK_DEBT'
  | 'BLOCK_EXPIRED'
  | 'BLOCK_LOW_BALANCE'
  | 'BLOCK_CAP_REACHED'
  | 'NOT_FOUND'
  | 'NO_ELIGIBLE_ACCOUNT'

export type CheckInResult = {
  success: boolean
  message: string
  subscriberId?: string
  subscriberName?: string
  subscriberPhoto?: string | null
  planType?: string
  branch?: string
  sessionId?: string
  quotaMin?: number
  remainingMin?: number
  walletBalance?: number
  outstandingBalance?: number
  durationMin?: number
  overageMin?: number
  amountCharged?: number
  isFirstCheckin?: boolean
  errorType?: CheckInErrorType
}

type CheckoutSessionOptions = {
  checkOutTime?: Date
  source?: string
  performedBy?: string
}

type CheckInOptions = {
  checkInTime?: Date
  source?: string
  performedBy?: string
}

export function calculateIncrementalDailyUsage(input: {
  totalMinBefore: number
  segmentMin: number
  quotaMin: number
}) {
  const totalMin = input.totalMinBefore + input.segmentMin
  const overageBefore = Math.max(0, input.totalMinBefore - input.quotaMin)
  const overageMin = Math.max(0, totalMin - input.quotaMin)
  const incrementalOverageMin = overageMin - overageBefore
  return {
    totalMin,
    overageMin,
    incrementalOverageMin,
    incrementalCharge: incrementalOverageMin * OVERAGE_RATE_PER_MINUTE,
  }
}

export async function checkInSubscriberInTx(
  tx: Prisma.TransactionClient,
  subscriberId: string,
  branch: string,
  options: CheckInOptions = {}
): Promise<CheckInResult> {
  const now = options.checkInTime || new Date()
  const today = businessDateOnly(now)
  const subscriber = await tx.subscriber.findUnique({
    where: { id: subscriberId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      },
      user: { select: { wallet: { select: { id: true, balance: true, status: true } } } },
    },
  })

  if (!subscriber) {
    return { success: false, message: 'Không tìm thấy hội viên.', errorType: 'NOT_FOUND' }
  }

  const existingSession = await tx.subscriptionSession.findFirst({
    where: { subscriberId, checkOutTime: null, status: 'ACTIVE' },
    select: { id: true, branch: true },
  })
  if (existingSession) {
    return {
      success: false,
      message: `Khách đang có session mở tại ${existingSession.branch}.`,
      subscriberId: subscriber.id,
      subscriberName: subscriber.fullName,
      subscriberPhoto: subscriber.photoUrl,
      branch: existingSession.branch,
      sessionId: existingSession.id,
      errorType: 'NO_ELIGIBLE_ACCOUNT',
    }
  }

  const identity = {
    subscriberId: subscriber.id,
    subscriberName: subscriber.fullName,
    subscriberPhoto: subscriber.photoUrl,
    branch,
  }

  if (subscriber.outstandingBalance > 0) {
    return {
      success: false,
      message: `Vui lòng thanh toán ${subscriber.outstandingBalance.toLocaleString('vi-VN')}đ trước khi check-in.`,
      outstandingBalance: subscriber.outstandingBalance,
      errorType: 'BLOCK_DEBT',
      ...identity,
    }
  }

  const subscription = subscriber.subscriptions[0]
  if (subscription) {
    if (subscription.status === 'ACTIVE' && subscription.endDate && subscription.endDate < today) {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } })
      return {
        success: false,
        message: 'Gói thành viên đã hết hạn.',
        errorType: 'BLOCK_EXPIRED',
        planType: subscription.planType,
        ...identity,
      }
    }

    const totalQuotaMin = subscription.totalHoursMin && subscription.totalHoursMin > 0
      ? subscription.totalHoursMin + subscription.carriedHoursMin
      : null
    const dailyCapMin = getSubscriptionDailyCapMin(subscription)
    const quotaMin = totalQuotaMin || dailyCapMin || undefined
    let remainingMin: number | undefined
    if (totalQuotaMin) {
      remainingMin = Math.max(0, totalQuotaMin - subscription.usedHoursMin)
      if (remainingMin <= 0) {
        return {
          success: false,
          message: 'Đã sử dụng hết quota của gói.',
          errorType: 'BLOCK_CAP_REACHED',
          planType: subscription.planType,
          quotaMin,
          remainingMin: 0,
          ...identity,
        }
      }
    } else if (dailyCapMin) {
      const usage = await tx.dailyUsage.findUnique({
        where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
      })
      remainingMin = Math.max(0, dailyCapMin - (usage?.totalMin || 0))
      if (remainingMin <= 0) {
        return {
          success: false,
          message: 'Đã sử dụng hết quota hôm nay.',
          errorType: 'BLOCK_CAP_REACHED',
          planType: subscription.planType,
          quotaMin,
          remainingMin: 0,
          ...identity,
        }
      }
    }

    const session = await tx.subscriptionSession.create({
      data: {
        subscriberId: subscriber.id,
        subscriptionId: subscription.id,
        branch,
        checkInTime: now,
        isFirstCheckin: false,
        source: options.source || 'qr',
        status: 'ACTIVE',
      },
    })

    await tx.subscriptionAuditLog.create({
      data: {
        action: 'check_in',
        entityType: 'subscription_session',
        entityId: session.id,
        performedBy: options.performedBy || 'system',
        details: { source: options.source || 'qr', branch, checkInTime: now.toISOString() },
      },
    })

    return {
      success: true,
      message: remainingMin === undefined
        ? `Chào ${subscriber.fullName}!`
        : `Check-in thành công. Còn ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m hôm nay.`,
      planType: subscription.planType,
      sessionId: session.id,
      quotaMin,
      remainingMin,
      isFirstCheckin: false,
      ...identity,
    }
  }

  const wallet = subscriber.user?.wallet
  const walletBalance = wallet?.balance || 0
  if (!wallet || wallet.status !== 'ACTIVE' || walletBalance < MIN_WALLET_BALANCE) {
    return {
      success: false,
      message: wallet ? 'Số dư Ví Nerd không đủ để check-in.' : 'Không có gói hoặc Ví Nerd hợp lệ.',
      walletBalance,
      errorType: wallet ? 'BLOCK_LOW_BALANCE' : 'NO_ELIGIBLE_ACCOUNT',
      ...identity,
    }
  }

  const session = await tx.subscriptionSession.create({
    data: {
      subscriberId: subscriber.id,
      branch,
      checkInTime: now,
      source: options.source || 'qr',
      status: 'ACTIVE',
    },
  })
  await tx.subscriptionAuditLog.create({
    data: {
      action: 'check_in',
      entityType: 'subscription_session',
      entityId: session.id,
      performedBy: options.performedBy || 'system',
      details: { source: options.source || 'qr', branch, checkInTime: now.toISOString(), wallet: true },
    },
  })

  return {
    success: true,
    message: `Check-in thành công. Số dư Ví Nerd: ${walletBalance.toLocaleString('vi-VN')}đ.`,
    sessionId: session.id,
    walletBalance,
    ...identity,
  }
}

export async function checkoutSubscriptionSessionInTx(
  tx: Prisma.TransactionClient,
  sessionId: string,
  options: CheckoutSessionOptions = {}
): Promise<CheckInResult> {
  const now = options.checkOutTime || new Date()
  const session = await tx.subscriptionSession.findUnique({
    where: { id: sessionId },
    include: {
      subscriber: { include: { user: { select: { wallet: { select: { id: true, balance: true } } } } } },
      subscription: true,
    },
  })
  if (!session || session.checkOutTime || session.status !== 'ACTIVE') {
    return { success: false, message: 'Session không hợp lệ hoặc đã check-out.', errorType: 'NOT_FOUND' }
  }

  const durationMin = Math.max(1, Math.ceil((now.getTime() - session.checkInTime.getTime()) / 60_000))
  let overageMin = 0
  let amountCharged = 0
  let quotaMin: number | undefined
  let remainingMin: number | undefined
  let walletBalanceAfter: number | undefined

  if (session.subscriptionId && session.subscription) {
    const totalQuotaMin = session.subscription.totalHoursMin && session.subscription.totalHoursMin > 0
      ? session.subscription.totalHoursMin + session.subscription.carriedHoursMin
      : null
    const dailyCapMin = getSubscriptionDailyCapMin(session.subscription)
    quotaMin = totalQuotaMin || dailyCapMin || undefined
    const segments = splitMinutesByLocalDay(session.checkInTime, now, durationMin)
    for (const segment of segments) {
      const before = await tx.dailyUsage.findUnique({
        where: { subscriberId_usageDate: { subscriberId: session.subscriberId, usageDate: segment.usageDate } },
      })
      const previousTotal = before?.totalMin || 0
      const calculated = dailyCapMin
        ? calculateIncrementalDailyUsage({
            totalMinBefore: previousTotal,
            segmentMin: segment.minutes,
            quotaMin: dailyCapMin,
          })
        : {
            totalMin: previousTotal + segment.minutes,
            overageMin: before?.overageMin || 0,
            incrementalOverageMin: 0,
            incrementalCharge: 0,
          }
      const incrementalOverage = calculated.incrementalOverageMin
      const incrementalCharge = calculated.incrementalCharge
      overageMin += incrementalOverage
      amountCharged += incrementalCharge

      await tx.dailyUsage.upsert({
        where: { subscriberId_usageDate: { subscriberId: session.subscriberId, usageDate: segment.usageDate } },
        create: {
          subscriberId: session.subscriberId,
          subscriptionId: session.subscriptionId,
          usageDate: segment.usageDate,
          totalMin: segment.minutes,
          quotaMin: dailyCapMin || null,
          overageMin: incrementalOverage,
          amountCharged: incrementalCharge,
        },
        update: {
          totalMin: { increment: segment.minutes },
          overageMin: { increment: incrementalOverage },
          amountCharged: { increment: incrementalCharge },
        },
      })
      if (dailyCapMin && segment.usageDate.getTime() === businessDateOnly(now).getTime()) {
        remainingMin = Math.max(0, dailyCapMin - calculated.totalMin)
      }
    }
    if (totalQuotaMin) {
      remainingMin = Math.max(0, totalQuotaMin - session.subscription.usedHoursMin - durationMin)
    }

    await tx.subscription.update({
      where: { id: session.subscriptionId },
      data: { usedHoursMin: { increment: durationMin } },
    })

    if (amountCharged > 0) {
      await tx.subscriber.update({
        where: { id: session.subscriberId },
        data: { outstandingBalance: { increment: amountCharged } },
      })
      await tx.transaction.create({
        data: {
          subscriberId: session.subscriberId,
          type: 'OVERAGE_CHARGE',
          amount: -amountCharged,
          balanceBefore: session.subscriber.user?.wallet?.balance || 0,
          balanceAfter: session.subscriber.user?.wallet?.balance || 0,
          reference: session.id,
          description: `Phí quá giờ (${overageMin} phút)`,
        },
      })
    }
  } else {
    const roundedMin = roundUpToIncrement(durationMin)
    const amount = Math.round((roundedMin / 60) * DEFAULT_RATE_PER_HOUR)
    const wallet = session.subscriber.user?.wallet
    const walletBalance = wallet?.balance || 0
    const paidAmount = Math.min(walletBalance, amount)
    const debtAmount = Math.max(0, amount - paidAmount)

    if (wallet && paidAmount > 0) {
      await applyWalletTransactionInTx(tx, {
        walletId: wallet.id,
        type: 'SESSION_CHARGE',
        amount: -paidAmount,
        source: 'MONTHLY_BEAVER',
        referenceType: 'subscription_session',
        referenceId: session.id,
        description: `Phí sử dụng Ví Nerd (${durationMin} phút)`,
      })
    }
    if (debtAmount > 0) {
      await tx.subscriber.update({
        where: { id: session.subscriberId },
        data: { outstandingBalance: { increment: debtAmount } },
      })
    }
    await tx.transaction.create({
      data: {
        subscriberId: session.subscriberId,
        type: 'SESSION_CHARGE',
        amount: -amount,
        balanceBefore: walletBalance,
        balanceAfter: walletBalance - paidAmount,
        reference: session.id,
        description: `Phí sử dụng Ví Nerd (${durationMin} phút)`,
      },
    })
    amountCharged = amount
    walletBalanceAfter = walletBalance - paidAmount
  }

  await tx.subscriptionSession.update({
    where: { id: session.id },
    data: { checkOutTime: now, durationMin, overageMin, amountCharged, status: 'COMPLETED' },
  })
  await tx.subscriptionAuditLog.create({
    data: {
      action: 'check_out',
      entityType: 'subscription_session',
      entityId: session.id,
      performedBy: options.performedBy || 'system',
      details: {
        checkoutSource: options.source || 'system',
        originalSource: session.source,
        checkOutTime: now.toISOString(),
        durationMin,
        overageMin,
        amountCharged,
      },
    },
  })

  return {
    success: true,
    message: amountCharged > 0
      ? `Check-out thành công. Thời gian ${durationMin} phút, phát sinh ${amountCharged.toLocaleString('vi-VN')}đ.`
      : `Check-out thành công. Thời gian ${durationMin} phút.`,
    subscriberId: session.subscriberId,
    subscriberName: session.subscriber.fullName,
    subscriberPhoto: session.subscriber.photoUrl,
    planType: session.subscription?.planType,
    branch: session.branch,
    sessionId: session.id,
    durationMin,
    quotaMin,
    remainingMin,
    walletBalance: walletBalanceAfter,
    overageMin,
    amountCharged,
  }
}

export function checkInSubscriber(
  subscriberId: string,
  branch: string,
  options: CheckInOptions = {}
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscriberId}))`
    return checkInSubscriberInTx(tx, subscriberId, branch, options)
  })
}

export function checkoutSubscriptionSession(sessionId: string, options: CheckoutSessionOptions = {}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.subscriptionSession.findUnique({
      where: { id: sessionId },
      select: { subscriberId: true },
    })
    if (!session) {
      return { success: false, message: 'Session không tồn tại.', errorType: 'NOT_FOUND' as const }
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.subscriberId}))`
    return checkoutSubscriptionSessionInTx(tx, sessionId, options)
  })
}

export async function autoCheckOutStaleSessions() {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AFTER_MS)
  const sessions = await prisma.subscriptionSession.findMany({
    where: { checkOutTime: null, status: 'ACTIVE', checkInTime: { lt: cutoff } },
  })
  const results = []
  for (const session of sessions) {
    const checkOutTime = new Date(session.checkInTime.getTime() + AUTO_CLOSE_AFTER_MS)
    results.push(
      await checkoutSubscriptionSession(session.id, {
        checkOutTime,
        source: 'system_auto',
        performedBy: 'system',
      })
    )
  }
  return results
}
