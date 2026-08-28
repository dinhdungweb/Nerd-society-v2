import { normalizeBankAccount } from '@/lib/nerd-night/payment-matching'

export type RegistrationPaymentValidation =
  | { valid: true }
  | { valid: false; reason: 'AMOUNT_MISMATCH' | 'ACCOUNT_MISMATCH' | 'PAID_AFTER_EXPIRY'; note: string }

export function validateRegistrationPayment(input: {
  expectedAmount: number
  receivedAmount: number
  expectedAccount: string
  receivedAccount?: string | null
  expiresAt?: Date | null
  paidAt: Date
}): RegistrationPaymentValidation {
  if (input.receivedAmount !== input.expectedAmount) {
    return {
      valid: false,
      reason: 'AMOUNT_MISMATCH',
      note: `Monthly Beaver amount mismatch: expected ${input.expectedAmount}, received ${input.receivedAmount}`,
    }
  }

  const receivedAccount = normalizeBankAccount(input.receivedAccount)
  const expectedAccount = normalizeBankAccount(input.expectedAccount)
  if (receivedAccount && receivedAccount !== expectedAccount) {
    return {
      valid: false,
      reason: 'ACCOUNT_MISMATCH',
      note: `Monthly Beaver bank account mismatch: expected ${expectedAccount}, received ${receivedAccount}`,
    }
  }

  if (input.expiresAt && input.paidAt > input.expiresAt) {
    return {
      valid: false,
      reason: 'PAID_AFTER_EXPIRY',
      note: `Monthly Beaver payment arrived after expiry ${input.expiresAt.toISOString()}`,
    }
  }

  return { valid: true }
}
