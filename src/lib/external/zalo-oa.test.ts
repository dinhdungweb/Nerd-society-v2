import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getExpiryReminderTargetDate, shouldNotifyOverageDebt } from '../subscription/zalo-notifications'
import { createZbsTrackingId, normalizeVietnamPhone, verifyZaloWebhookSignature, ZALO_TEMPLATE_TYPES } from './zalo-oa'

test('only the approved business events have ZBS template types', () => {
  assert.deepEqual([...ZALO_TEMPLATE_TYPES], ['SUBSCRIPTION_SUCCESS', 'OVERAGE_DEBT', 'BLOCK_DEBT', 'SUB_EXPIRING'])
})

test('overage debt notification requires a charged overage checkout', () => {
  assert.equal(
    shouldNotifyOverageDebt({
      subscriberId: 'subscriber-1',
      sessionId: 'session-1',
      overageMin: 15,
      amountCharged: 3750,
    }),
    true
  )
  assert.equal(
    shouldNotifyOverageDebt({
      subscriberId: 'subscriber-1',
      sessionId: 'session-1',
      overageMin: 0,
      amountCharged: 0,
    }),
    false
  )
})

test('expiry reminder target is exactly three business days later', () => {
  assert.equal(
    getExpiryReminderTargetDate(new Date('2026-08-27T00:00:00.000Z')).toISOString(),
    '2026-08-30T00:00:00.000Z'
  )
})

test('normalizeVietnamPhone converts local and international formats', () => {
  assert.equal(normalizeVietnamPhone('090 123 4567'), '84901234567')
  assert.equal(normalizeVietnamPhone('+84 901-234-567'), '84901234567')
  assert.equal(normalizeVietnamPhone('84901234567'), '84901234567')
})

test('normalizeVietnamPhone rejects unsupported values', () => {
  assert.throws(() => normalizeVietnamPhone('12345'), /Vietnam phone/)
  assert.throws(() => normalizeVietnamPhone('not-a-phone'), /Invalid recipient/)
})

test('createZbsTrackingId is deterministic, unique by seed, and Zalo-safe', () => {
  const first = createZbsTrackingId('BLOCK_DEBT', 'request-a')
  const repeated = createZbsTrackingId('BLOCK_DEBT', 'request-a')
  const second = createZbsTrackingId('BLOCK_DEBT', 'request-b')

  assert.equal(first, repeated)
  assert.notEqual(first, second)
  assert.match(first, /^[a-z0-9_]+$/)
  assert.ok(first.length <= 48)
})

test('verifyZaloWebhookSignature validates app id and SHA-256 signature', () => {
  const previousAppId = process.env.ZALO_APP_ID
  const previousSecret = process.env.ZALO_OA_SECRET_KEY
  process.env.ZALO_APP_ID = '123456'
  process.env.ZALO_OA_SECRET_KEY = 'oa-secret'

  try {
    const rawBody = '{"event_name":"user_received_message","app_id":"123456","timestamp":"1700000000000"}'
    const event = JSON.parse(rawBody)
    const digest = createHash('sha256').update(`123456${rawBody}1700000000000oa-secret`).digest('hex')

    assert.equal(verifyZaloWebhookSignature(rawBody, event, `mac=${digest}`), true)
    assert.equal(verifyZaloWebhookSignature(rawBody, event, 'mac=invalid'), false)
    assert.equal(verifyZaloWebhookSignature(rawBody, { ...event, app_id: 'other' }, `mac=${digest}`), false)
  } finally {
    if (previousAppId === undefined) delete process.env.ZALO_APP_ID
    else process.env.ZALO_APP_ID = previousAppId
    if (previousSecret === undefined) delete process.env.ZALO_OA_SECRET_KEY
    else process.env.ZALO_OA_SECRET_KEY = previousSecret
  }
})
