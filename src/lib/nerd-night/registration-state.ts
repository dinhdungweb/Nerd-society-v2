type PaymentEvidenceInput = {
  paymentStatus: string
  paymentTransactionId?: string | null
  paymentReceivedAmount?: number | null
}

type SeatStateInput = PaymentEvidenceInput & {
  status: string
  paymentExpiresAt: Date | string | null
}

type EventWindowInput = {
  status: string
  startsAt: Date | string
}

export function hasNerdNightPaymentEvidence(input: PaymentEvidenceInput) {
  return input.paymentStatus === 'CONFIRMED'
    || Boolean(input.paymentTransactionId)
    || (input.paymentReceivedAmount || 0) > 0
}

export function isNerdNightPaymentExpired(input: SeatStateInput, now = new Date()) {
  return input.status === 'ACTIVE'
    && input.paymentStatus !== 'CONFIRMED'
    && !hasNerdNightPaymentEvidence(input)
    && (!input.paymentExpiresAt || new Date(input.paymentExpiresAt) <= now)
}

export function holdsNerdNightSeat(input: SeatStateInput, now = new Date()) {
  return input.status === 'ACTIVE' && (
    hasNerdNightPaymentEvidence(input)
    || Boolean(input.paymentExpiresAt && new Date(input.paymentExpiresAt) > now)
  )
}

export function canNerdNightReceivePayment(event: EventWindowInput, paidAt = new Date()) {
  return event.status === 'PUBLISHED' && paidAt < new Date(event.startsAt)
}

export function canOpenNerdNightVoting(event: EventWindowInput, now = new Date()) {
  return event.status === 'PUBLISHED' && new Date(event.startsAt) <= now
}

export function getNerdNightWalletPaymentExternalId(registration: {
  id: string
  paymentExpiresAt: Date | string | null
  createdAt: Date | string
}) {
  const paymentAttempt = registration.paymentExpiresAt
    ? new Date(registration.paymentExpiresAt).getTime()
    : new Date(registration.createdAt).getTime()
  return `WALLET-NERD-NIGHT-${registration.id}-${paymentAttempt}`
}

export function isNerdNightWalletPayment(transactionId: string | null | undefined) {
  return Boolean(transactionId?.startsWith('WALLET-NERD-NIGHT-'))
}
