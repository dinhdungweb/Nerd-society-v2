import { localDateOnly } from './date-utils'

export const DEFAULT_DAILY_CAP_MIN = 480
export const DEFAULT_RATE_PER_HOUR = 15000
export const DAILY_CAP_PLANS = ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED']

export function roundUpToIncrement(minutes: number, increment = 15) {
  return Math.ceil(minutes / increment) * increment
}

export function getSubscriptionDailyCapMin(subscription?: {
  dailyLimitMin?: number | null
  planType?: string | null
} | null) {
  if (!subscription) return null
  if (subscription.dailyLimitMin && subscription.dailyLimitMin > 0) return subscription.dailyLimitMin
  if (subscription.planType && DAILY_CAP_PLANS.includes(subscription.planType)) return DEFAULT_DAILY_CAP_MIN
  return null
}

export function getSessionUsageDate(checkInTime: Date) {
  return localDateOnly(checkInTime)
}

export function getUsageDateKey(usageDate: Date) {
  return usageDate.toISOString().slice(0, 10)
}

export function calculateOverageCharge(overageMin: number, ratePerHour = DEFAULT_RATE_PER_HOUR) {
  const roundedOverageMin = roundUpToIncrement(Math.max(0, overageMin))
  const overageCharge = Math.round((roundedOverageMin / 60) * ratePerHour)

  return { roundedOverageMin, overageCharge }
}

export function calculateDailyCapSessionUsage(input: {
  durationMin: number
  usedMinBefore: number
  dailyCapMin?: number | null
  ratePerHour?: number
}) {
  const dailyCapMin = input.dailyCapMin || DEFAULT_DAILY_CAP_MIN
  const capRemaining = Math.max(0, dailyCapMin - input.usedMinBefore)
  const includedMin = Math.min(input.durationMin, capRemaining)
  const overageMin = Math.max(0, input.durationMin - includedMin)
  const { roundedOverageMin, overageCharge } = calculateOverageCharge(
    overageMin,
    input.ratePerHour || DEFAULT_RATE_PER_HOUR
  )

  return {
    includedMin,
    overageMin,
    roundedOverageMin,
    overageCharge,
  }
}
