import { businessDateOnly } from '@/lib/subscription/date-utils'

const DAY_MS = 24 * 60 * 60 * 1000

export const RENEWAL_WINDOW_DAYS = 3

type RenewableSubscription = {
  status: string
  endDate: Date | null
}

export type RenewalEligibility = {
  eligible: boolean
  daysUntilExpiry: number | null
  availableFrom: Date | null
  reason: 'NO_CURRENT_SUBSCRIPTION' | 'NOT_ACTIVATED' | 'MISSING_END_DATE' | 'TOO_EARLY' | 'ELIGIBLE'
}

export function getRenewalEligibility(
  subscription: RenewableSubscription | null | undefined,
  now: Date = new Date()
): RenewalEligibility {
  if (!subscription) {
    return {
      eligible: true,
      daysUntilExpiry: null,
      availableFrom: null,
      reason: 'NO_CURRENT_SUBSCRIPTION',
    }
  }

  if (subscription.status === 'PENDING_ACTIVATION') {
    return {
      eligible: false,
      daysUntilExpiry: null,
      availableFrom: null,
      reason: 'NOT_ACTIVATED',
    }
  }

  if (!subscription.endDate) {
    return {
      eligible: false,
      daysUntilExpiry: null,
      availableFrom: null,
      reason: 'MISSING_END_DATE',
    }
  }

  const today = businessDateOnly(now)
  const endDate = businessDateOnly(subscription.endDate)
  const daysUntilExpiry = Math.round((endDate.getTime() - today.getTime()) / DAY_MS)
  const availableFrom = new Date(endDate)
  availableFrom.setUTCDate(availableFrom.getUTCDate() - RENEWAL_WINDOW_DAYS)

  return {
    eligible: daysUntilExpiry <= RENEWAL_WINDOW_DAYS,
    daysUntilExpiry,
    availableFrom,
    reason: daysUntilExpiry <= RENEWAL_WINDOW_DAYS ? 'ELIGIBLE' : 'TOO_EARLY',
  }
}
