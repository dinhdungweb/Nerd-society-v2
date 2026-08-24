import { prisma } from '@/lib/prisma'
import { businessDateOnly } from '@/lib/subscription/date-utils'

export async function verifySession(sessionId: string, verified: boolean, staffName: string) {
  const [session] = await prisma.$transaction([
    prisma.subscriptionSession.update({
      where: { id: sessionId },
      data: { staffVerified: verified },
      include: { subscriber: true, subscription: true },
    }),
    prisma.subscriptionAuditLog.create({
      data: {
        action: verified ? 'staff_verified' : 'share_rejected',
        entityType: 'session',
        entityId: sessionId,
        performedBy: staffName,
        details: { verified },
      },
    }),
  ])
  return {
    success: true,
    verified,
    message: verified ? 'Đã xác minh khách.' : 'Đã ghi nhận từ chối xác minh.',
    subscriberId: session.subscriberId,
    subscriberName: session.subscriber.fullName,
    subscriberPhoto: session.subscriber.photoUrl,
    planType: session.subscription?.planType,
    branch: session.branch,
    sessionId: session.id,
  }
}

export async function getWarnings(branch?: string) {
  const warnings: Array<{ type: string; severity: 'warning' | 'error' | 'info'; message: string; sessionId?: string }> = []
  const longSessions = await prisma.subscriptionSession.findMany({
    where: {
      checkOutTime: null,
      status: 'ACTIVE',
      ...(branch ? { branch } : {}),
      checkInTime: { lt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    },
    include: { subscriber: true },
  })
  for (const session of longSessions) {
    warnings.push({
      type: 'LONG_SESSION',
      severity: 'warning',
      message: `${session.subscriber.fullName} ngồi hơn 8h — cần kiểm tra`,
      sessionId: session.id,
    })
  }

  const nearLimit = await prisma.dailyUsage.findMany({
    where: { usageDate: businessDateOnly(), totalMin: { gte: 450 } },
    include: { subscriber: true },
  })
  for (const usage of nearLimit) {
    const quota = usage.quotaMin || 480
    warnings.push({
      type: 'NEAR_DAILY_LIMIT',
      severity: usage.totalMin >= quota ? 'error' : 'warning',
      message: `${usage.subscriber.fullName} đã dùng ${usage.totalMin}/${quota} phút hôm nay`,
    })
  }

  const until = businessDateOnly(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
  const expiring = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endDate: { lte: until } },
    include: { subscriber: true },
  })
  for (const subscription of expiring) {
    warnings.push({
      type: 'EXPIRING_SOON',
      severity: 'info',
      message: `${subscription.subscriber.fullName} — gói hết hạn ${subscription.endDate?.toLocaleDateString('vi-VN')}`,
    })
  }
  return warnings
}
