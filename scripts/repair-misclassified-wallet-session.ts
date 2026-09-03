import type { Prisma, Subscription } from '@prisma/client'
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { splitMinutesByLocalDay } from '../src/lib/subscription/date-utils'
import { ensureMembershipAccessInTx } from '../src/lib/subscription/membership-access'
import { calculateIncrementalDailyUsage } from '../src/lib/subscription/session-manager'
import { getSubscriptionDailyCapMin } from '../src/lib/subscription/usage-billing'
import { applyWalletTransactionInTx } from '../src/lib/wallet-ledger'

const apply = process.argv.includes('--apply') || process.env.npm_config_apply === 'true'

function argument(name: string) {
  const prefix = `--${name}=`
  return (
    process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ||
    process.env[`npm_config_${name.replace(/-/g, '_')}`]
  )
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('84') && digits.length > 9 ? `0${digits.slice(2)}` : digits
}

function phoneCandidates(value: string) {
  const normalized = normalizePhone(value)
  return Array.from(
    new Set([
      normalized,
      normalized.startsWith('0') ? `84${normalized.slice(1)}` : normalized,
      normalized.startsWith('0') ? `+84${normalized.slice(1)}` : normalized,
    ])
  )
}

function localDateRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('--date phải có định dạng YYYY-MM-DD')
  }
  const start = new Date(`${date}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 86_400_000)
  if (Number.isNaN(start.getTime())) throw new Error('--date không hợp lệ')
  return { start, end }
}

async function calculateCorrectUsage(
  tx: Prisma.TransactionClient,
  subscriberId: string,
  subscription: Subscription,
  checkInTime: Date,
  checkOutTime: Date,
  durationMin: number
) {
  const dailyCapMin = getSubscriptionDailyCapMin(subscription)
  const segments = splitMinutesByLocalDay(checkInTime, checkOutTime, durationMin)
  const usage = []
  let expectedOverageMin = 0
  let expectedCharge = 0

  for (const segment of segments) {
    const before = await tx.dailyUsage.findUnique({
      where: { subscriberId_usageDate: { subscriberId, usageDate: segment.usageDate } },
    })
    const calculated = dailyCapMin
      ? calculateIncrementalDailyUsage({
          totalMinBefore: before?.totalMin || 0,
          segmentMin: segment.minutes,
          quotaMin: dailyCapMin,
        })
      : {
          totalMin: (before?.totalMin || 0) + segment.minutes,
          overageMin: before?.overageMin || 0,
          incrementalOverageMin: 0,
          incrementalCharge: 0,
        }
    expectedOverageMin += calculated.incrementalOverageMin
    expectedCharge += calculated.incrementalCharge
    usage.push({ segment, before, calculated, dailyCapMin })
  }

  return { usage, expectedOverageMin, expectedCharge }
}

async function main() {
  const phone = argument('phone')
  const date = argument('date')
  const requestedSessionId = argument('session-id')
  if (!phone || (!date && !requestedSessionId)) {
    throw new Error('Cách dùng: npx tsx scripts/repair-misclassified-wallet-session.ts --phone=0983314788 --date=2026-08-29 [--apply]')
  }
  if (apply && process.env.REPAIR_MISCLASSIFIED_SESSION_APPLY !== 'YES') {
    throw new Error('Để chạy --apply, đặt REPAIR_MISCLASSIFIED_SESSION_APPLY=YES sau khi backup DB và duyệt dry-run.')
  }

  const subscriber = await prisma.subscriber.findFirst({
    where: { phone: { in: phoneCandidates(phone) } },
    include: {
      user: { select: { wallet: true } },
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
        orderBy: { createdAt: 'desc' },
        include: { registrationOrders: { orderBy: { createdAt: 'desc' } } },
      },
    },
  })
  if (!subscriber) throw new Error(`Không tìm thấy hội viên có SĐT ${phone}`)

  const range = date ? localDateRange(date) : null
  const sessions = await prisma.subscriptionSession.findMany({
    where: {
      subscriberId: subscriber.id,
      ...(requestedSessionId
        ? { id: requestedSessionId }
        : {
            subscriptionId: null,
            status: 'COMPLETED',
            amountCharged: { gt: 0 },
          }),
      ...(range ? { checkInTime: { gte: range.start, lt: range.end } } : {}),
    },
    orderBy: { checkInTime: 'asc' },
  })
  if (sessions.length !== 1) {
    throw new Error(
      `Cần đúng 1 phiên phù hợp, hiện tìm thấy ${sessions.length}. Hãy truyền --session-id để chọn chính xác.`
    )
  }

  const session = sessions[0]
  const priorRepair = await prisma.subscriptionAuditLog.findFirst({
    where: { action: 'repair_wallet_session_misclassification', entityId: session.id },
  })
  if (priorRepair) {
    console.log(JSON.stringify({
      mode: apply ? 'APPLY' : 'DRY_RUN',
      alreadyRepaired: true,
      subscriberId: subscriber.id,
      sessionId: session.id,
      auditId: priorRepair.id,
    }, null, 2))
    return
  }
  if (!session.checkOutTime || !session.durationMin) throw new Error('Phiên thiếu check-out hoặc thời lượng')
  const subscription = subscriber.subscriptions.find((item) => item.status === 'ACTIVE') || subscriber.subscriptions[0]
  if (!subscription) throw new Error('Không tìm thấy gói ACTIVE hoặc PENDING_ACTIVATION để gắn lại phiên')

  const walletCharges = subscriber.user?.wallet
    ? await prisma.walletTransaction.findMany({
        where: {
          walletId: subscriber.user.wallet.id,
          type: 'SESSION_CHARGE',
          referenceType: 'subscription_session',
          referenceId: session.id,
          amount: { lt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const paidFromWallet = walletCharges.reduce((sum, item) => sum + Math.abs(item.amount), 0)
  const originalDebt = Math.max(0, session.amountCharged - paidFromWallet)
  const debtPaymentsAfterSession = subscriber.user?.wallet
    ? await prisma.walletTransaction.findMany({
        where: {
          walletId: subscriber.user.wallet.id,
          type: 'OVERAGE_PAYMENT',
          referenceType: 'subscriber',
          referenceId: subscriber.id,
          amount: { lt: 0 },
          createdAt: { gte: session.checkOutTime! },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const paidErroneousDebtFromWallet = Math.min(
    originalDebt,
    debtPaymentsAfterSession.reduce((sum, item) => sum + Math.abs(item.amount), 0)
  )
  const remainingErroneousDebt = originalDebt - paidErroneousDebtFromWallet
  const erroneousDebtToRemove = Math.min(subscriber.outstandingBalance, remainingErroneousDebt)
  const unaccountedDebtReduction = remainingErroneousDebt - erroneousDebtToRemove
  const correct = await prisma.$transaction((tx) =>
    calculateCorrectUsage(
      tx,
      subscriber.id,
      subscription,
      session.checkInTime,
      session.checkOutTime!,
      session.durationMin!
    )
  )
  const debtAfterRepair = subscriber.outstandingBalance - erroneousDebtToRemove + correct.expectedCharge
  const refundToWallet = paidFromWallet + paidErroneousDebtFromWallet

  const preview = {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    subscriber: {
      id: subscriber.id,
      fullName: subscriber.fullName,
      phone: subscriber.phone,
      outstandingBalanceBefore: subscriber.outstandingBalance,
      outstandingBalanceAfter: debtAfterRepair,
    },
    session: {
      id: session.id,
      checkInTime: session.checkInTime,
      checkOutTime: session.checkOutTime,
      durationMin: session.durationMin,
      amountChargedBefore: session.amountCharged,
      amountChargedAfter: correct.expectedCharge,
      overageMinAfter: correct.expectedOverageMin,
    },
    subscription: {
      id: subscription.id,
      planType: subscription.planType,
      statusBefore: subscription.status,
    },
    refundToWallet,
    originalWalletChargeToRefund: paidFromWallet,
    paidErroneousDebtToRefund: paidErroneousDebtFromWallet,
    erroneousDebtToRemove,
    unaccountedDebtReduction,
    debtPaymentTransactions: debtPaymentsAfterSession.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      amount: item.amount,
    })),
    usageByDate: correct.usage.map((item) => ({
      usageDate: item.segment.usageDate,
      minutes: item.segment.minutes,
      usedBefore: item.before?.totalMin || 0,
      incrementalOverageMin: item.calculated.incrementalOverageMin,
      incrementalCharge: item.calculated.incrementalCharge,
    })),
  }
  console.log(JSON.stringify(preview, null, 2))
  if (!apply) return
  if (session.amountCharged <= correct.expectedCharge) {
    throw new Error('Phiên không có khoản tính sai để hoàn; dừng để tránh tạo giao dịch 0đ hoặc hoàn thừa.')
  }
  if (debtAfterRepair < 0) {
    throw new Error('Công nợ hiện tại thấp hơn phần nợ cần xóa; dừng để tránh hoàn trùng.')
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscriber.id}))`
    const priorRepair = await tx.subscriptionAuditLog.findFirst({
      where: { action: 'repair_wallet_session_misclassification', entityId: session.id },
    })
    if (priorRepair) return { alreadyRepaired: true, auditId: priorRepair.id }

    const liveSession = await tx.subscriptionSession.findUniqueOrThrow({ where: { id: session.id } })
    if (liveSession.subscriptionId || liveSession.amountCharged !== session.amountCharged) {
      throw new Error('Phiên đã thay đổi sau dry-run; vui lòng chạy lại đối soát.')
    }
    const liveSubscriber = await tx.subscriber.findUniqueOrThrow({
      where: { id: subscriber.id },
      include: { user: { select: { wallet: true } } },
    })
    const liveWalletCharges = liveSubscriber.user?.wallet
      ? await tx.walletTransaction.findMany({
          where: {
            walletId: liveSubscriber.user.wallet.id,
            type: 'SESSION_CHARGE',
            referenceType: 'subscription_session',
            referenceId: liveSession.id,
            amount: { lt: 0 },
          },
        })
      : []
    const livePaidFromWallet = liveWalletCharges.reduce((sum, item) => sum + Math.abs(item.amount), 0)
    if (livePaidFromWallet !== paidFromWallet) {
      throw new Error('Giao dịch gốc đã thay đổi sau dry-run; vui lòng chạy lại đối soát.')
    }
    const liveDebtPaymentsAfterSession = liveSubscriber.user?.wallet
      ? await tx.walletTransaction.findMany({
          where: {
            walletId: liveSubscriber.user.wallet.id,
            type: 'OVERAGE_PAYMENT',
            referenceType: 'subscriber',
            referenceId: liveSubscriber.id,
            amount: { lt: 0 },
            createdAt: { gte: liveSession.checkOutTime! },
          },
        })
      : []
    const livePaidErroneousDebtFromWallet = Math.min(
      liveSession.amountCharged - livePaidFromWallet,
      liveDebtPaymentsAfterSession.reduce((sum, item) => sum + Math.abs(item.amount), 0)
    )
    if (livePaidErroneousDebtFromWallet !== paidErroneousDebtFromWallet) {
      throw new Error('Lịch sử thanh toán công nợ đã thay đổi sau dry-run; vui lòng chạy lại đối soát.')
    }
    const access = await ensureMembershipAccessInTx(tx, subscriber.id, 'repair-misclassified-session')
    if (!access.subscription || access.subscription.status !== 'ACTIVE') {
      throw new Error('Không thể xác minh và kích hoạt gói đã thanh toán; không sửa dữ liệu tài chính.')
    }
    const liveCorrect = await calculateCorrectUsage(
      tx,
      subscriber.id,
      access.subscription,
      liveSession.checkInTime,
      liveSession.checkOutTime!,
      liveSession.durationMin!
    )
    if (
      liveCorrect.expectedCharge !== correct.expectedCharge ||
      liveCorrect.expectedOverageMin !== correct.expectedOverageMin
    ) {
      throw new Error('Dữ liệu sử dụng đã thay đổi sau dry-run; vui lòng chạy lại đối soát.')
    }

    const liveOriginalDebt = Math.max(0, liveSession.amountCharged - livePaidFromWallet)
    const liveRemainingErroneousDebt = liveOriginalDebt - livePaidErroneousDebtFromWallet
    const liveErroneousDebtToRemove = Math.min(
      liveSubscriber.outstandingBalance,
      liveRemainingErroneousDebt
    )
    const liveDebtAfterRepair =
      liveSubscriber.outstandingBalance - liveErroneousDebtToRemove + liveCorrect.expectedCharge
    if (liveDebtAfterRepair < 0) {
      throw new Error('Công nợ hiện tại thấp hơn phần nợ cần xóa; dừng để tránh hoàn trùng.')
    }

    const liveRefundToWallet = livePaidFromWallet + livePaidErroneousDebtFromWallet
    let walletBalanceAfter = liveSubscriber.user?.wallet?.balance || 0
    if (liveSubscriber.user?.wallet && liveRefundToWallet > 0) {
      const refund = await applyWalletTransactionInTx(tx, {
        walletId: liveSubscriber.user.wallet.id,
        type: 'REFUND',
        amount: liveRefundToWallet,
        source: 'SYSTEM',
        referenceType: 'subscription_session',
        referenceId: liveSession.id,
        externalTransactionId: `REFUND-MISCLASSIFIED-SESSION-${liveSession.id}`,
        description: `Hoàn phí phiên bị phân loại sai (${liveSession.durationMin} phút)`,
        note: 'Phiên thuộc gói Monthly Beaver nhưng đã bị tính như Ví Nerd',
      })
      walletBalanceAfter = refund.balanceAfter
    }

    for (const item of liveCorrect.usage) {
      await tx.dailyUsage.upsert({
        where: {
          subscriberId_usageDate: {
            subscriberId: subscriber.id,
            usageDate: item.segment.usageDate,
          },
        },
        create: {
          subscriberId: subscriber.id,
          subscriptionId: access.subscription.id,
          usageDate: item.segment.usageDate,
          totalMin: item.segment.minutes,
          quotaMin: item.dailyCapMin,
          overageMin: item.calculated.incrementalOverageMin,
          amountCharged: item.calculated.incrementalCharge,
        },
        update: {
          totalMin: { increment: item.segment.minutes },
          overageMin: { increment: item.calculated.incrementalOverageMin },
          amountCharged: { increment: item.calculated.incrementalCharge },
        },
      })
    }
    await tx.subscription.update({
      where: { id: access.subscription.id },
      data: { usedHoursMin: { increment: liveSession.durationMin! } },
    })
    await tx.subscriber.update({
      where: { id: subscriber.id },
      data: { outstandingBalance: liveDebtAfterRepair },
    })
    await tx.subscriptionSession.update({
      where: { id: liveSession.id },
      data: {
        subscriptionId: access.subscription.id,
        amountCharged: liveCorrect.expectedCharge,
        overageMin: liveCorrect.expectedOverageMin,
        notes: [liveSession.notes, 'Repaired wallet/subscription misclassification'].filter(Boolean).join('\n'),
      },
    })
    await tx.transaction.create({
      data: {
        subscriberId: subscriber.id,
        type: 'REFUND',
        amount: session.amountCharged - liveCorrect.expectedCharge,
        balanceBefore: liveSubscriber.user?.wallet?.balance || 0,
        balanceAfter: walletBalanceAfter,
        reference: liveSession.id,
        description: 'Hoàn phí phiên bị phân loại sai sang gói Monthly Beaver',
      },
    })
    const audit = await tx.subscriptionAuditLog.create({
      data: {
        action: 'repair_wallet_session_misclassification',
        entityType: 'subscription_session',
        entityId: liveSession.id,
        performedBy: 'repair-misclassified-session',
        details: {
          subscriberId: subscriber.id,
          subscriptionId: access.subscription.id,
          originalAmountCharged: session.amountCharged,
          correctedAmountCharged: liveCorrect.expectedCharge,
          walletRefund: liveRefundToWallet,
          originalWalletChargeRefund: livePaidFromWallet,
          paidErroneousDebtRefund: livePaidErroneousDebtFromWallet,
          debtRemoved: liveErroneousDebtToRemove,
          unaccountedDebtReduction: liveRemainingErroneousDebt - liveErroneousDebtToRemove,
          debtPaymentTransactionIds: liveDebtPaymentsAfterSession.map((item) => item.id),
          outstandingBalanceAfter: liveDebtAfterRepair,
        },
      },
    })
    return { alreadyRepaired: false, auditId: audit.id }
  })

  console.log(JSON.stringify({ success: true, ...result }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
