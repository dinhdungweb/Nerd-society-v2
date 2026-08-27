import { createZbsTrackingId, sendZaloNotification } from '@/lib/external/zalo-oa'
import { prisma } from '@/lib/prisma'
import { businessDateOnly, formatBusinessDate } from '@/lib/subscription/date-utils'

const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Gói Tuần Limited',
  MONTHLY_LIMITED: 'Gói Tháng Limited',
  MONTHLY_UNLIMITED: 'Gói Tháng Unlimited',
}

function planLabel(planType: string) {
  return PLAN_LABELS[planType] || planType
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function shouldNotifyOverageDebt(input: {
  subscriberId?: string
  sessionId?: string
  overageMin?: number
  amountCharged?: number
}) {
  return Boolean(
    input.subscriberId &&
      input.sessionId &&
      input.overageMin &&
      input.overageMin > 0 &&
      input.amountCharged &&
      input.amountCharged > 0
  )
}

export function getExpiryReminderTargetDate(today: Date = businessDateOnly()) {
  const targetDate = new Date(today)
  targetDate.setUTCDate(targetDate.getUTCDate() + 3)
  return targetDate
}

export async function notifySubscriptionSuccess(orderId: string, action: 'REGISTERED' | 'RENEWED') {
  const order = await prisma.registrationOrder.findUnique({
    where: { id: orderId },
    include: { subscriber: true, subscription: true },
  })
  if (!order?.subscriber?.phone || !order.subscription?.endDate) return null

  const type = 'SUBSCRIPTION_SUCCESS' as const
  return sendZaloNotification(
    order.subscriber.phone,
    type,
    {
      customer_name: order.subscriber.fullName,
      action: action === 'RENEWED' ? 'Gia hạn' : 'Đăng ký mới',
      plan_name: planLabel(order.subscription.planType),
      branch: order.subscriber.branchPrimary || order.branchPrimary,
      expiry_date: formatDate(order.subscription.endDate),
    },
    {
      trackingId: createZbsTrackingId(type, `subscription-success:${order.id}:${order.subscription.id}:${action}`),
    }
  )
}

export async function notifyOverageDebt(input: {
  subscriberId?: string
  subscriberName?: string
  branch?: string
  sessionId?: string
  overageMin?: number
  amountCharged?: number
}) {
  if (!shouldNotifyOverageDebt(input)) return null
  const subscriberId = input.subscriberId!
  const sessionId = input.sessionId!
  const overageMin = input.overageMin!
  const amountCharged = input.amountCharged!

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    select: { phone: true, fullName: true, outstandingBalance: true },
  })
  if (!subscriber?.phone) return null

  const type = 'OVERAGE_DEBT' as const
  return sendZaloNotification(
    subscriber.phone,
    type,
    {
      customer_name: input.subscriberName || subscriber.fullName,
      branch: input.branch || '',
      overage_minutes: String(overageMin),
      amount_due: String(amountCharged),
      total_debt: String(subscriber.outstandingBalance),
    },
    { trackingId: createZbsTrackingId(type, `overage-debt:${sessionId}`) }
  )
}

export async function notifyBlockedByDebt(input: {
  subscriberId?: string
  subscriberName?: string
  branch?: string
  outstandingBalance?: number
  eventKey?: string
}) {
  if (!input.subscriberId || !input.outstandingBalance || input.outstandingBalance <= 0) return null

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: input.subscriberId },
    select: { phone: true, fullName: true },
  })
  if (!subscriber?.phone) return null

  const type = 'BLOCK_DEBT' as const
  const eventKey = input.eventKey || `${input.subscriberId}:${formatBusinessDate()}`
  return sendZaloNotification(
    subscriber.phone,
    type,
    {
      customer_name: input.subscriberName || subscriber.fullName,
      branch: input.branch || '',
      amount_due: String(input.outstandingBalance),
    },
    { trackingId: createZbsTrackingId(type, `block-debt:${eventKey}`) }
  )
}

export async function notifyExpiringSubscriptions(today: Date = businessDateOnly()) {
  const targetDate = getExpiryReminderTargetDate(today)

  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endDate: targetDate },
    include: { subscriber: true },
  })

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const subscription of subscriptions) {
    if (!subscription.endDate || !subscription.subscriber.phone) {
      skipped += 1
      continue
    }

    const type = 'SUB_EXPIRING' as const
    try {
      const result = await sendZaloNotification(
        subscription.subscriber.phone,
        type,
        {
          customer_name: subscription.subscriber.fullName,
          plan_name: planLabel(subscription.planType),
          expiry_date: formatDate(subscription.endDate),
          days_remaining: '3',
        },
        {
          trackingId: createZbsTrackingId(
            type,
            `subscription-expiring:${subscription.id}:${subscription.endDate.toISOString()}`
          ),
        }
      )
      if (result.skipped) skipped += 1
      else sent += 1
    } catch (error) {
      failed += 1
      console.error(
        `[Subscription Zalo] Unable to notify expiring subscription ${subscription.id}:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  return { candidates: subscriptions.length, sent, skipped, failed }
}
