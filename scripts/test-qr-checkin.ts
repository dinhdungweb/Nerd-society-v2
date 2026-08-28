import assert from 'node:assert/strict'

process.env.QR_SIGNING_SECRET = 'test-secret-with-more-than-thirty-two-bytes'

async function main() {
  const { buildMembershipQrPayload, verifyMembershipQrPayload, fingerprintQrPayload } = await import(
    '../src/lib/subscription/qr-credential'
  )
  const { calculateIncrementalDailyUsage } = await import('../src/lib/subscription/session-manager')
  const { splitMinutesByLocalDay } = await import('../src/lib/subscription/date-utils')
  const { getPlanEndDate, nextRegistrationOrderCode } = await import('../src/lib/subscription/order-lifecycle')
  const { validateRegistrationPayment } = await import('../src/lib/subscription/payment-validation')

  const payload = buildMembershipQrPayload({ publicId: 'member-public-id', version: 3 })
  assert.deepEqual(verifyMembershipQrPayload(payload), { publicId: 'member-public-id', version: 3 })
  assert.equal(verifyMembershipQrPayload(payload.replace('.3.', '.4.')), null)
  assert.equal(verifyMembershipQrPayload(`${payload}x`), null)
  assert.equal(fingerprintQrPayload(payload).length, 64)

  assert.deepEqual(
    calculateIncrementalDailyUsage({ totalMinBefore: 470, segmentMin: 30, quotaMin: 480 }),
    { totalMin: 500, overageMin: 20, incrementalOverageMin: 20, incrementalCharge: 5000 }
  )
  assert.deepEqual(
    calculateIncrementalDailyUsage({ totalMinBefore: 500, segmentMin: 10, quotaMin: 480 }),
    { totalMin: 510, overageMin: 30, incrementalOverageMin: 10, incrementalCharge: 2500 }
  )

  const segments = splitMinutesByLocalDay(
    new Date('2026-08-18T21:00:00+07:00'),
    new Date('2026-08-19T09:00:00+07:00'),
    720
  )
  assert.deepEqual(segments.map((segment) => segment.minutes), [180, 540])

  const startDate = new Date('2026-08-28T00:00:00.000Z')
  assert.equal(getPlanEndDate(startDate, 'WEEKLY_LIMITED').toISOString(), '2026-09-03T00:00:00.000Z')
  assert.equal(getPlanEndDate(startDate, 'MONTHLY_LIMITED').toISOString(), '2026-09-26T00:00:00.000Z')
  assert.equal(nextRegistrationOrderCode(startDate), 'MB-20260828-001')
  assert.equal(nextRegistrationOrderCode(startDate, 'MB-20260828-041'), 'MB-20260828-042')
  assert.throws(() => nextRegistrationOrderCode(startDate, 'MB-20260828-999'), /999/)

  assert.deepEqual(
    validateRegistrationPayment({
      expectedAmount: 500_000,
      receivedAmount: 500_000,
      expectedAccount: '123 456',
      receivedAccount: '123456',
      expiresAt: new Date('2026-08-28T12:00:00.000Z'),
      paidAt: new Date('2026-08-28T11:59:59.000Z'),
    }),
    { valid: true }
  )
  assert.equal(
    validateRegistrationPayment({
      expectedAmount: 500_000,
      receivedAmount: 500_001,
      expectedAccount: '123456',
      paidAt: startDate,
    }).valid,
    false
  )
  assert.equal(
    validateRegistrationPayment({
      expectedAmount: 500_000,
      receivedAmount: 500_000,
      expectedAccount: '123456',
      receivedAccount: '654321',
      paidAt: startDate,
    }).valid,
    false
  )
  assert.equal(
    validateRegistrationPayment({
      expectedAmount: 500_000,
      receivedAmount: 500_000,
      expectedAccount: '123456',
      expiresAt: new Date('2026-08-27T23:59:59.000Z'),
      paidAt: startDate,
    }).valid,
    false
  )
  console.log('QR check-in unit tests passed')
}

main()
