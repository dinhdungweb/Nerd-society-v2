import assert from 'node:assert/strict'

process.env.QR_SIGNING_SECRET = 'test-secret-with-more-than-thirty-two-bytes'

async function main() {
  const { buildMembershipQrPayload, verifyMembershipQrPayload, fingerprintQrPayload } = await import(
    '../src/lib/subscription/qr-credential'
  )
  const { calculateIncrementalDailyUsage } = await import('../src/lib/subscription/session-manager')
  const { splitMinutesByLocalDay } = await import('../src/lib/subscription/date-utils')

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
  console.log('QR check-in unit tests passed')
}

main()
