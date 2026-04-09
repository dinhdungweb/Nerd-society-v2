/**
 * Subscription Business Logic
 * Xử lý: kích hoạt, check-in, check-out, tính giờ, edge cases
 */

import { prisma } from '@/lib/prisma';
import { getBranchFromDevice } from '@/lib/mytime-api';

// Hằng số
const ROUND_UP_MINUTES = 15;   // Làm tròn lên 15 phút
const AUTO_CHECKOUT_HOURS = 12; // Auto checkout sau 12h
const UNLIMITED_DAILY_LIMIT = 480; // 8h = 480 phút
const UNLIMITED_WARNING_MIN = 450; // 7h30 = cảnh báo
const DOUBLE_TAP_SECONDS = 300; // 5 phút = chống double-tap
const PLAN_DURATION: Record<string, number> = {
  WEEKLY_LIMITED: 7,
  MONTHLY_LIMITED: 30,
  MONTHLY_UNLIMITED: 30,
};
const PLAN_HOURS_MIN: Record<string, number> = {
  WEEKLY_LIMITED: 15 * 60,   // 15h = 900 min
  MONTHLY_LIMITED: 50 * 60,  // 50h = 3000 min
  MONTHLY_UNLIMITED: 0,     // unlimited
};

/**
 * Làm tròn lên bội số 15 phút
 */
function roundUpMinutes(minutes: number): number {
  return Math.ceil(minutes / ROUND_UP_MINUTES) * ROUND_UP_MINUTES;
}

/**
 * Xử lý 1 bản ghi attendance mới từ MyTime polling
 */
export async function processAttendanceRecord(record: {
  AttTime: string;
  EmployeeID: string;
  FullName: string;
  MachineAlias: string;
  sn: string;
}) {
  const attTime = new Date(record.AttTime);
  const branch = getBranchFromDevice(record.sn || record.MachineAlias);

  // 1. Tìm subscriber
  const subscriber = await prisma.subscriber.findFirst({
    where: { mytimeEmpId: record.EmployeeID },
    include: {
      subscriptions: {
        where: { status: { in: ['PENDING_ACTIVATION', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!subscriber) {
    return { type: 'UNKNOWN_CARD', message: 'THẺ CHƯA ĐĂNG KÝ', employeeId: record.EmployeeID };
  }

  const subscription = subscriber.subscriptions[0];
  if (!subscription) {
    return { type: 'NO_ACTIVE_SUB', message: 'GÓI HẾT HẠN', subscriber };
  }

  // 2. Chống double-tap: bỏ qua nếu < 5 phút
  const lastSession = await prisma.subscriptionSession.findFirst({
    where: { subscriberId: subscriber.id },
    orderBy: { createdAt: 'desc' },
  });
  if (lastSession) {
    const lastTime = lastSession.checkOutTime || lastSession.checkInTime;
    const diffSec = (attTime.getTime() - lastTime.getTime()) / 1000;
    if (diffSec < DOUBLE_TAP_SECONDS) {
      return { type: 'DOUBLE_TAP', message: 'Bỏ qua double-tap' };
    }
  }

  // 3. Kích hoạt gói (first tap)
  if (subscription.status === 'PENDING_ACTIVATION') {
    return await activateSubscription(subscriber.id, subscription.id, attTime, branch, record);
  }

  // 4. Kiểm tra gói hết hạn
  if (subscription.endDate && new Date(subscription.endDate) < new Date(attTime.toISOString().split('T')[0])) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    return { type: 'EXPIRED', message: 'GÓI HẾT HẠN', subscriber };
  }

  // 5. Check-in hoặc Check-out
  const openSession = await prisma.subscriptionSession.findFirst({
    where: {
      subscriberId: subscriber.id,
      checkOutTime: null,
    },
  });

  if (openSession) {
    // Quẹt tại CS khác khi đang có session mở → check-out CS cũ + check-in CS mới
    if (openSession.branch !== branch) {
      await performCheckOut(openSession.id, subscription, attTime);
      return await performCheckIn(subscriber, subscription, attTime, branch, record);
    }
    // Check-out bình thường
    return await performCheckOut(openSession.id, subscription, attTime);
  } else {
    // Check-in
    return await performCheckIn(subscriber, subscription, attTime, branch, record);
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
  record: unknown,
) {
  const today = new Date(attTime.toISOString().split('T')[0]);
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new Error('Subscription not found');

  const durationDays = PLAN_DURATION[subscription.planType] || 30;
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + durationDays);

  // Cập nhật subscription
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      activationDate: attTime,
      startDate: today,
      endDate,
    },
  });

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
  });

  // Cập nhật registration order
  await prisma.registrationOrder.updateMany({
    where: { subscriptionId, orderStatus: 'CARD_ASSIGNED' },
    data: { orderStatus: 'ACTIVATED' },
  });

  // Audit log
  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'first_checkin_activation',
      entityType: 'subscription',
      entityId: subscriptionId,
      performedBy: 'system',
      details: { branch, attTime: attTime.toISOString() },
    },
  });

  return {
    type: 'ACTIVATION',
    message: `🎉 KÍCH HOẠT LẦN ĐẦU`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: subscriberId } }),
    subscription: await prisma.subscription.findUnique({ where: { id: subscriptionId } }),
    session,
  };
}

/**
 * Check-in
 */
async function performCheckIn(
  subscriber: { id: string },
  subscription: { id: string; planType: string; totalHoursMin: number | null; usedHoursMin: number; carriedHoursMin: number; dailyLimitMin: number | null } | null,
  attTime: Date,
  branch: string,
  record: unknown,
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
    });

    return {
      type: 'CHECK_IN',
      message: `✅ CHECK-IN (WALLET)`,
      subscriber: await prisma.subscriber.findUnique({ where: { id: subscriber.id } }),
      subscription: null,
      session,
      remainingMin: null,
      needsVerification: false,
    };
  }

  // Kiểm tra giờ còn lại (Limited)
  if (subscription.planType !== 'MONTHLY_UNLIMITED') {
    const total = (subscription.totalHoursMin || 0) + subscription.carriedHoursMin;
    const remaining = total - subscription.usedHoursMin;
    if (remaining <= 0) {
      return { type: 'NO_HOURS', message: 'HẾT GIỜ', subscriber, remaining: 0 };
    }
  }

  // Kiểm tra daily limit (Unlimited)
  if (subscription.planType === 'MONTHLY_UNLIMITED') {
    const today = new Date(attTime.toISOString().split('T')[0]);
    const dailyUsage = await prisma.dailyUsage.findUnique({
      where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
    });
    if (dailyUsage && dailyUsage.totalMin >= UNLIMITED_DAILY_LIMIT) {
      return { type: 'DAILY_LIMIT', message: 'ĐÃ HẾT 8H HÔM NAY', subscriber };
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
  });

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'check_in',
      entityType: 'session',
      entityId: session.id,
      performedBy: 'system',
      details: { branch },
    },
  });

  const remaining = subscription.planType === 'MONTHLY_UNLIMITED'
    ? null
    : (subscription.totalHoursMin || 0) + subscription.carriedHoursMin - subscription.usedHoursMin;

  return {
    type: 'CHECK_IN',
    message: `✅ CHECK-IN`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: subscriber.id } }),
    subscription,
    session,
    remainingMin: remaining,
    needsVerification: subscription.planType === 'MONTHLY_UNLIMITED',
  };
}

/**
 * Check-out
 */
async function performCheckOut(
  sessionId: string,
  subscription: { id: string; planType: string; usedHoursMin: number } | null,
  attTime: Date,
) {
  const session = await prisma.subscriptionSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const durationRaw = (attTime.getTime() - session.checkInTime.getTime()) / (1000 * 60);
  const durationMin = roundUpMinutes(Math.max(1, Math.round(durationRaw)));

  // Cập nhật session
  await prisma.subscriptionSession.update({
    where: { id: sessionId },
    data: { checkOutTime: attTime, durationMin },
  });

  if (subscription) {
    // Cập nhật used hours
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { usedHoursMin: { increment: durationMin } },
    });

    // Cập nhật daily usage (cho Unlimited)
    if (subscription.planType === 'MONTHLY_UNLIMITED') {
      const today = new Date(attTime.toISOString().split('T')[0]);
      await prisma.dailyUsage.upsert({
        where: { subscriberId_usageDate: { subscriberId: session.subscriberId, usageDate: today } },
        create: {
          subscriberId: session.subscriberId,
          subscriptionId: subscription.id,
          usageDate: today,
          totalMin: durationMin,
        },
        update: { totalMin: { increment: durationMin } },
      });
    }
  }

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'check_out',
      entityType: 'session',
      entityId: sessionId,
      performedBy: 'system',
      details: { durationMin },
    },
  });

  const updatedSub = subscription ? await prisma.subscription.findUnique({ where: { id: subscription.id } }) : null;

  return {
    type: 'CHECK_OUT',
    message: `CHECK-OUT`,
    subscriber: await prisma.subscriber.findUnique({ where: { id: session.subscriberId } }),
    subscription: updatedSub,
    durationMin,
    remainingMin: updatedSub && updatedSub.totalHoursMin
      ? (updatedSub.totalHoursMin + updatedSub.carriedHoursMin - updatedSub.usedHoursMin)
      : null,
  };
}

/**
 * Auto check-out (cho sessions quá lâu)
 */
export async function autoCheckOutStaleSessions() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - AUTO_CHECKOUT_HOURS);

  const staleSessions = await prisma.subscriptionSession.findMany({
    where: { checkOutTime: null, checkInTime: { lt: cutoff } },
    include: { subscription: true },
  });

  const results = [];
  for (const session of staleSessions) {
    const result = await performCheckOut(session.id, session.subscription, new Date());
    results.push({ ...result, type: 'AUTO_CHECKOUT' });

    await prisma.subscriptionAuditLog.create({
      data: {
        action: 'auto_checkout',
        entityType: 'session',
        entityId: session.id,
        performedBy: 'system',
        details: { reason: `Session open for ${AUTO_CHECKOUT_HOURS}+ hours` },
      },
    });
  }

  return results;
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
  });

  if (!subscriber) return { type: 'NOT_FOUND', message: 'Không tìm thấy subscriber' };
  if (!subscriber.subscriptions[0]) return { type: 'NO_ACTIVE_SUB', message: 'Không có gói active' };

  const sub = subscriber.subscriptions[0];
  const result = await performCheckIn(subscriber, sub, new Date(), branch, { source: 'manual' });

  if (result.type === 'CHECK_IN' && result.session) {
    await prisma.subscriptionSession.update({
      where: { id: result.session.id },
      data: { source: 'manual' },
    });
    await prisma.subscriptionAuditLog.create({
      data: {
        action: 'manual_checkin',
        entityType: 'session',
        entityId: result.session.id,
        performedBy: staffName,
        details: { phone, branch },
      },
    });
  }

  return result;
}

/**
 * Xác nhận khuôn mặt (staff verify) cho Unlimited
 */
export async function verifySession(sessionId: string, verified: boolean, staffName: string) {
  await prisma.subscriptionSession.update({
    where: { id: sessionId },
    data: { staffVerified: verified },
  });

  await prisma.subscriptionAuditLog.create({
    data: {
      action: verified ? 'staff_verified' : 'share_rejected',
      entityType: 'session',
      entityId: sessionId,
      performedBy: staffName,
      details: { verified },
    },
  });

  return { success: true, verified };
}

/**
 * Check các cảnh báo (gần hết giờ, sắp hết hạn...)
 */
export async function getWarnings() {
  const warnings = [];

  // Sessions > 8h chưa checkout
  const longSessions = await prisma.subscriptionSession.findMany({
    where: {
      checkOutTime: null,
      checkInTime: {
        lt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    },
    include: { subscriber: true },
  });
  for (const s of longSessions) {
    warnings.push({
      type: 'LONG_SESSION',
      severity: 'warning',
      message: `${s.subscriber.fullName} ngồi hơn 8h — kiểm tra check-out`,
      sessionId: s.id,
    });
  }

  // Unlimited gần 8h/ngày
  const today = new Date(new Date().toISOString().split('T')[0]);
  const nearLimitUsages = await prisma.dailyUsage.findMany({
    where: {
      usageDate: today,
      totalMin: { gte: UNLIMITED_WARNING_MIN },
    },
    include: { subscriber: true },
  });
  for (const u of nearLimitUsages) {
    warnings.push({
      type: 'NEAR_DAILY_LIMIT',
      severity: u.totalMin >= UNLIMITED_DAILY_LIMIT ? 'error' : 'warning',
      message: `${u.subscriber.fullName} đã dùng ${Math.round(u.totalMin / 60)}h/${UNLIMITED_DAILY_LIMIT / 60}h hôm nay`,
    });
  }

  // Subscriptions sắp hết hạn (3 ngày)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const expiringSubs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: threeDaysFromNow },
    },
    include: { subscriber: true },
  });
  for (const s of expiringSubs) {
    warnings.push({
      type: 'EXPIRING_SOON',
      severity: 'info',
      message: `${s.subscriber.fullName} — gói hết hạn ${s.endDate?.toLocaleDateString('vi-VN')}`,
    });
  }

  return warnings;
}
