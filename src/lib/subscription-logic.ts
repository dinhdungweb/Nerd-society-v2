/**
 * Subscription Business Logic
 * Xử lý: kích hoạt, check-in, check-out, tính giờ, edge cases
 */

import { getBranchFromDevice } from '@/lib/mytime-api'
import { prisma } from '@/lib/prisma'
import {
  businessDateOnly,
  localDateOnly,
  parseAttendanceRecordDateTime,
  splitMinutesByLocalDay,
} from '@/lib/subscription/date-utils'
import {
  calculateDailyCapSessionUsage,
  calculateOverageCharge,
} from '@/lib/subscription/usage-billing'
import { $Enums } from '@prisma/client'

// Hằng số
const ROUND_UP_MINUTES = 15 // Làm tròn lên 15 phút
const AUTO_CHECKOUT_HOURS = 10 // Auto checkout sau 10h (spec: quên checkout → force close)
const DAILY_CAP_MIN = 480 // 8h = 480 phút — daily cap cho MONTHLY_LIMITED & UNLIMITED
const DAILY_WARNING_MIN = 450 // 7h30 = cảnh báo gần hết daily cap
const DOUBLE_TAP_SECONDS = 300 // 5 phút = chống double-tap
const PLAN_DURATION: Record<string, number> = {
  WEEKLY_LIMITED: 7,
  MONTHLY_LIMITED: 30,
  MONTHLY_UNLIMITED: 30,
}
const PLAN_HOURS_MIN: Record<string, number> = {
  WEEKLY_LIMITED: 15 * 60, // 15h = 900 min
  MONTHLY_LIMITED: 0, // Không giới hạn tổng giờ/tháng, chỉ có daily cap 8h
  MONTHLY_UNLIMITED: 0, // unlimited
}

// Các gói có daily cap 8h/ngày
const PLANS_WITH_DAILY_CAP = ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED']

/**
 * Làm tròn lên bội số 15 phút
 */
function roundUpMinutes(minutes: number): number {
  return Math.ceil(minutes / ROUND_UP_MINUTES) * ROUND_UP_MINUTES
}

function getAttendanceAuditDetails(record?: unknown) {
  if (!record || typeof record !== 'object') return {}
  const data = record as { AttTime?: string; EmployeeID?: string; MachineAlias?: string; sn?: string }
  const details: Record<string, string> = {}

  if (data.AttTime) details.attTime = data.AttTime
  if (data.EmployeeID) details.employeeId = data.EmployeeID
  if (data.MachineAlias) details.machineAlias = data.MachineAlias
  if (data.sn) details.sn = data.sn

  return details
}

async function incrementDailyUsageBySession(
  subscriberId: string,
  subscriptionId: string,
  start: Date,
  end: Date,
  durationMin: number
) {
  const segments = splitMinutesByLocalDay(start, end, durationMin)
  let overageMin = 0
  let includedMin = 0

  for (const segment of segments) {
    const usageBefore = await prisma.dailyUsage.findUnique({
      where: { subscriberId_usageDate: { subscriberId, usageDate: segment.usageDate } },
    })
    const billing = calculateDailyCapSessionUsage({
      durationMin: segment.minutes,
      usedMinBefore: usageBefore?.totalMin || 0,
      dailyCapMin: DAILY_CAP_MIN,
    })

    overageMin += billing.overageMin
    includedMin += billing.includedMin

    if (billing.includedMin > 0) {
      await prisma.dailyUsage.upsert({
        where: { subscriberId_usageDate: { subscriberId, usageDate: segment.usageDate } },
        create: {
          subscriberId,
          subscriptionId,
          usageDate: segment.usageDate,
          totalMin: billing.includedMin,
        },
        update: { totalMin: { increment: billing.includedMin } },
      })
    }
  }

  return {
    includedMin,
    overageMin,
    ...calculateOverageCharge(overageMin),
  }
}

/**
 * Xử lý 1 bản ghi attendance mới từ MyTime polling
 */
export async function processAttendanceRecord(record: {
  AttTime: string
  EmployeeID: string
  FullName: string
  MachineAlias: string
  sn: string
  AttDate?: string
}) {
  const attTime = parseAttendanceRecordDateTime(record)
  const attDate = localDateOnly(attTime)
  const branch = getBranchFromDevice(record.sn || record.MachineAlias)

  // 1. Tìm subscriber
  const subscriberByEmpId = await prisma.subscriber.findUnique({
    where: { mytimeEmpId: record.EmployeeID },
    include: {
      subscriptions: {
        where: { status: { in: ['PENDING_ACTIVATION', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  const subscriber =
    subscriberByEmpId ||
    (await prisma.subscriber.findUnique({
      where: { cardNo: record.EmployeeID },
      include: {
        subscriptions: {
          where: { status: { in: ['PENDING_ACTIVATION', 'ACTIVE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }))

  if (!subscriber) {
    return { type: 'UNKNOWN_CARD', message: 'THẺ CHƯA ĐĂNG KÝ', employeeId: record.EmployeeID }
  }

  const subscription = subscriber.subscriptions[0]
  if (!subscription) {
    return { type: 'NO_ACTIVE_SUB', message: 'GÓI HẾT HẠN', subscriber }
  }

  // 2. Chống double-tap: bỏ qua nếu < 5 phút
  const lastSession = await prisma.subscriptionSession.findFirst({
    where: { subscriberId: subscriber.id },
    orderBy: { createdAt: 'desc' },
  })
  if (lastSession) {
    const lastTime = lastSession.checkOutTime || lastSession.checkInTime
    const diffSec = (attTime.getTime() - lastTime.getTime()) / 1000
    if (diffSec < DOUBLE_TAP_SECONDS) {
      return { type: 'DOUBLE_TAP', message: 'Bỏ qua double-tap' }
    }
  }

  // 3. Kích hoạt gói (first tap)
  if (subscription.status === 'PENDING_ACTIVATION') {
    return await activateSubscription(subscriber.id, subscription.id, attTime, branch, record)
  }

  // 4. Kiểm tra gói hết hạn
  if (subscription.endDate && new Date(subscription.endDate) < attDate) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    })
    return { type: 'EXPIRED', message: 'GÓI HẾT HẠN', subscriber }
  }

  // 5. Check-in hoặc Check-out
  const openSession = await prisma.subscriptionSession.findFirst({
    where: {
      subscriberId: subscriber.id,
      checkOutTime: null,
      status: 'ACTIVE',
    },
  })

  if (openSession) {
    // Quẹt tại CS khác khi đang có session mở → check-out CS cũ + check-in CS mới
    if (openSession.branch !== branch) {
      await performCheckOut(openSession.id, subscription, attTime, record)
      return await performCheckIn(subscriber, subscription, attTime, branch, record)
    }
    // Check-out bình thường
    return await performCheckOut(openSession.id, subscription, attTime, record)
  } else {
    // Check-in
    return await performCheckIn(subscriber, subscription, attTime, branch, record)
  }
}

/**
 * Kích hoạt subscription (first tap)
 */
async function activateSubscription(
  subscriberId: string,
  subscriptionId: string,
  attTime: Date,
  branch: string,
  record: unknown
) {
  const today = localDateOnly(attTime)
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription) throw new Error('Subscription not found')

  const durationDays = PLAN_DURATION[subscription.planType] || 30
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + durationDays)

  // Cập nhật subscription
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      activationDate: attTime,
      startDate: today,
      endDate,
    },
  })

  // Tạo session đầu tiên
  const session = await prisma.subscriptionSession.create({
    data: {
      subscriberId,
      subscriptionId,
      branch,
      checkInTime: attTime,
      isFirstCheckin: true,
      source: 'card',
      mytimeRaw: record as object,
    },
  })

  // Cập nhật registration order
  await prisma.registrationOrder.updateMany({
    where: { subscriptionId, orderStatus: 'CARD_ASSIGNED' },
    data: { orderStatus: 'ACTIVATED' },
  })

  // Audit log
  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'first_checkin_activation',
      entityType: 'subscription',
      entityId: subscriptionId,
      performedBy: 'system',
      details: { branch, attTime: attTime.toISOString(), ...getAttendanceAuditDetails(record) },
    },
  })

  return {
    type: 'ACTIVATION',
    message: `🎉 KÍCH HOẠT LẦN ĐẦU`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: subscriberId } }),
    subscription: await prisma.subscription.findUnique({ where: { id: subscriptionId } }),
    session,
  }
}

/**
 * Check-in
 */
async function performCheckIn(
  subscriber: { id: string },
  subscription: {
    id: string
    planType: string
    totalHoursMin: number | null
    usedHoursMin: number
    carriedHoursMin: number
    dailyLimitMin: number | null
  } | null,
  attTime: Date,
  branch: string,
  record: unknown
) {
  // Nếu không có gói (dùng Wallet)
  if (!subscription) {
    const session = await prisma.subscriptionSession.create({
      data: {
        subscriberId: subscriber.id,
        subscriptionId: null,
        branch,
        checkInTime: attTime,
        source: 'card',
        mytimeRaw: record as object,
      },
    })

    return {
      type: 'CHECK_IN',
      message: `✅ CHECK-IN (WALLET)`,
      subscriber: await prisma.subscriber.findUnique({ where: { id: subscriber.id } }),
      subscription: null,
      session,
      remainingMin: null,
      needsVerification: false,
    }
  }

  // Kiểm tra giờ còn lại theo tổng tháng (WEEKLY_LIMITED)
  if (subscription.totalHoursMin && subscription.totalHoursMin > 0) {
    const total = subscription.totalHoursMin + subscription.carriedHoursMin
    const remaining = total - subscription.usedHoursMin
    if (remaining <= 0) {
      return { type: 'NO_HOURS', message: 'HẾT GIỜ', subscriber, remaining: 0 }
    }
  }

  // Kiểm tra daily cap 8h/ngày (MONTHLY_LIMITED & MONTHLY_UNLIMITED)
  if (PLANS_WITH_DAILY_CAP.includes(subscription.planType)) {
    const today = localDateOnly(attTime)
    const dailyUsage = await prisma.dailyUsage.findUnique({
      where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
    })
    if (dailyUsage && dailyUsage.totalMin >= DAILY_CAP_MIN) {
      return { type: 'DAILY_LIMIT', message: 'ĐÃ HẾT 8H HÔM NAY', subscriber }
    }
  }

  const session = await prisma.subscriptionSession.create({
    data: {
      subscriberId: subscriber.id,
      subscriptionId: subscription.id,
      branch,
      checkInTime: attTime,
      source: 'card',
      mytimeRaw: record as object,
    },
  })

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'check_in',
      entityType: 'session',
      entityId: session.id,
      performedBy: 'system',
      details: { branch, attTime: attTime.toISOString(), ...getAttendanceAuditDetails(record) },
    },
  })

  // Tính giờ còn lại: nếu có tổng giờ → trả remaining, nếu daily cap → trả null (UI hiển thị daily cap)
  const remaining =
    subscription.totalHoursMin && subscription.totalHoursMin > 0
      ? subscription.totalHoursMin + subscription.carriedHoursMin - subscription.usedHoursMin
      : null

  return {
    type: 'CHECK_IN',
    message: `✅ CHECK-IN`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: subscriber.id } }),
    subscription,
    session,
    remainingMin: remaining,
    needsVerification: subscription.planType === 'MONTHLY_UNLIMITED',
  }
}

/**
 * Check-out
 */
async function performCheckOut(
  sessionId: string,
  subscription: { id: string; planType: string; usedHoursMin: number } | null,
  attTime: Date,
  record?: unknown
) {
  const session = await prisma.subscriptionSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Session not found')

  const durationRaw = (attTime.getTime() - session.checkInTime.getTime()) / (1000 * 60)
  const durationMin = roundUpMinutes(Math.max(1, Math.round(durationRaw)))

  // Cập nhật session
  let overageMin = 0
  let amountCharged = 0

  if (subscription) {
    // Cập nhật used hours
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { usedHoursMin: { increment: durationMin } },
    })

    // Cập nhật daily usage (cho tất cả gói có daily cap)
    if (PLANS_WITH_DAILY_CAP.includes(subscription.planType)) {
      const billing = await incrementDailyUsageBySession(
        session.subscriberId,
        subscription.id,
        session.checkInTime,
        attTime,
        durationMin
      )
      overageMin = billing.overageMin
      amountCharged = billing.overageCharge

      if (amountCharged > 0) {
        const subscriber = await prisma.subscriber.findUnique({
          where: { id: session.subscriberId },
          include: { user: { select: { wallet: { select: { balance: true } } } } },
        })

        await prisma.subscriber.update({
          where: { id: session.subscriberId },
          data: { outstandingBalance: { increment: amountCharged } },
        })

        await prisma.transaction.create({
          data: {
            subscriberId: session.subscriberId,
            type: 'OVERAGE_CHARGE' as $Enums.TransactionType,
            amount: -amountCharged,
            balanceBefore: subscriber?.user?.wallet?.balance || 0,
            balanceAfter: subscriber?.user?.wallet?.balance || 0,
            reference: sessionId,
            description: `Phi qua gio (${overageMin}m)`,
          },
        })
      }
    }
  }

  await prisma.subscriptionSession.update({
    where: { id: sessionId },
    data: { checkOutTime: attTime, durationMin, overageMin, amountCharged, status: 'COMPLETED' },
  })

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'check_out',
      entityType: 'session',
      entityId: sessionId,
      performedBy: 'system',
      details: { durationMin, checkOutTime: attTime.toISOString(), ...getAttendanceAuditDetails(record) },
    },
  })

  const updatedSub = subscription ? await prisma.subscription.findUnique({ where: { id: subscription.id } }) : null

  return {
    type: 'CHECK_OUT',
    message: `CHECK-OUT`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: session.subscriberId } }),
    subscription: updatedSub,
    durationMin,
    remainingMin:
      updatedSub && updatedSub.totalHoursMin && updatedSub.totalHoursMin > 0
        ? updatedSub.totalHoursMin + updatedSub.carriedHoursMin - updatedSub.usedHoursMin
        : null,
  }
}

/**
 * Auto check-out (cho sessions quá lâu)
 */
export async function autoCheckOutStaleSessions() {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - AUTO_CHECKOUT_HOURS)

  const staleSessions = await prisma.subscriptionSession.findMany({
    where: { checkOutTime: null, status: 'ACTIVE', checkInTime: { lt: cutoff } },
    include: { subscription: true },
  })

  const results = []
  for (const session of staleSessions) {
    // Force close: cap duration ở 8h theo spec (check_out = check_in + 8h)
    const forceCheckOutTime = new Date(session.checkInTime.getTime() + DAILY_CAP_MIN * 60 * 1000)
    const result = await performCheckOut(session.id, session.subscription, forceCheckOutTime)
    results.push({ ...result, type: 'AUTO_CHECKOUT' })

    await prisma.subscriptionAuditLog.create({
      data: {
        action: 'auto_checkout',
        entityType: 'session',
        entityId: session.id,
        performedBy: 'system',
        details: { reason: `Session open for ${AUTO_CHECKOUT_HOURS}+ hours` },
      },
    })
  }

  return results
}

/**
 * Check-in thủ công (nhân viên nhập SĐT)
 */
export async function manualCheckIn(phone: string, branch: string, staffName: string) {
  const subscriber = await prisma.subscriber.findFirst({
    where: { phone },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!subscriber) return { type: 'NOT_FOUND', message: 'Không tìm thấy subscriber' }
  if (!subscriber.subscriptions[0]) return { type: 'NO_ACTIVE_SUB', message: 'Không có gói active' }

  const sub = subscriber.subscriptions[0]
  const result = await performCheckIn(subscriber, sub, new Date(), branch, { source: 'manual' })

  if (result.type === 'CHECK_IN' && result.session) {
    await prisma.subscriptionSession.update({
      where: { id: result.session.id },
      data: { source: 'manual' },
    })
    await prisma.subscriptionAuditLog.create({
      data: {
        action: 'manual_checkin',
        entityType: 'session',
        entityId: result.session.id,
        performedBy: staffName,
        details: { phone, branch },
      },
    })
  }

  return result
}

/**
 * Xác nhận khuôn mặt (staff verify) cho Unlimited
 */
export async function verifySession(sessionId: string, verified: boolean, staffName: string) {
  await prisma.subscriptionSession.update({
    where: { id: sessionId },
    data: { staffVerified: verified },
  })

  await prisma.subscriptionAuditLog.create({
    data: {
      action: verified ? 'staff_verified' : 'share_rejected',
      entityType: 'session',
      entityId: sessionId,
      performedBy: staffName,
      details: { verified },
    },
  })

  return { success: true, verified }
}

/**
 * Check các cảnh báo (gần hết giờ, sắp hết hạn...)
 */
export async function getWarnings() {
  const warnings = []

  // Sessions > 8h chưa checkout
  const longSessions = await prisma.subscriptionSession.findMany({
    where: {
      checkOutTime: null,
      status: 'ACTIVE',
      checkInTime: {
        lt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    },
    include: { subscriber: true },
  })
  for (const s of longSessions) {
    warnings.push({
      type: 'LONG_SESSION',
      severity: 'warning',
      message: `${s.subscriber.fullName} ngồi hơn 8h — kiểm tra check-out`,
      sessionId: s.id,
    })
  }

  // Unlimited gần 8h/ngày
  const today = businessDateOnly()
  const nearLimitUsages = await prisma.dailyUsage.findMany({
    where: {
      usageDate: today,
      totalMin: { gte: DAILY_WARNING_MIN },
    },
    include: { subscriber: true },
  })
  for (const u of nearLimitUsages) {
    warnings.push({
      type: 'NEAR_DAILY_LIMIT',
      severity: u.totalMin >= DAILY_CAP_MIN ? 'error' : 'warning',
      message: `${u.subscriber.fullName} đã dùng ${Math.round(u.totalMin / 60)}h/${DAILY_CAP_MIN / 60}h hôm nay`,
    })
  }

  // Subscriptions sắp hết hạn (3 ngày)
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const expiringSubs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: threeDaysFromNow },
    },
    include: { subscriber: true },
  })
  for (const s of expiringSubs) {
    warnings.push({
      type: 'EXPIRING_SOON',
      severity: 'info',
      message: `${s.subscriber.fullName} — gói hết hạn ${s.endDate?.toLocaleDateString('vi-VN')}`,
    })
  }

  return warnings
}
