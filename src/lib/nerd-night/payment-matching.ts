export type NerdNightPaymentIdentity = {
  registrationCode: string
  transferContent: string
}

export function extractNerdNightPaymentIdentity(content: string): NerdNightPaymentIdentity | null {
  const match = content.match(/\bNN[\s-]*(S\d+E\d+)[\s-]*([A-Z0-9]{6})\b/i)
  if (!match) return null

  const eventCode = match[1].toUpperCase()
  const suffix = match[2].toUpperCase()
  return {
    registrationCode: `NN-${eventCode}-${suffix}`,
    transferContent: `NN ${eventCode} ${suffix}`,
  }
}

export function normalizeBankAccount(value: string | null | undefined) {
  return (value || '').replace(/[\s.-]/g, '').toUpperCase()
}
