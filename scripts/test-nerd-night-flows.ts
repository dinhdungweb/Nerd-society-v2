import assert from 'node:assert/strict'
import {
  canNerdNightReceivePayment,
  canOpenNerdNightVoting,
  hasNerdNightPaymentEvidence,
  holdsNerdNightSeat,
  isNerdNightPaymentExpired,
} from '../src/lib/nerd-night/registration-state'

const now = new Date('2026-08-11T12:00:00.000Z')
const future = new Date('2026-08-11T13:00:00.000Z')
const past = new Date('2026-08-11T11:00:00.000Z')

assert.equal(hasNerdNightPaymentEvidence({ paymentStatus: 'PENDING' }), false)
assert.equal(hasNerdNightPaymentEvidence({ paymentStatus: 'PENDING', paymentTransactionId: 'vietqr-1' }), true)
assert.equal(hasNerdNightPaymentEvidence({ paymentStatus: 'UNPAID', paymentReceivedAmount: 99_000 }), true)
assert.equal(hasNerdNightPaymentEvidence({ paymentStatus: 'CONFIRMED' }), true)

assert.equal(holdsNerdNightSeat({ status: 'ACTIVE', paymentStatus: 'PENDING', paymentExpiresAt: future }, now), true)
assert.equal(holdsNerdNightSeat({ status: 'ACTIVE', paymentStatus: 'PENDING', paymentExpiresAt: past }, now), false)
assert.equal(holdsNerdNightSeat({ status: 'ACTIVE', paymentStatus: 'CONFIRMED', paymentExpiresAt: null }, now), true)
assert.equal(holdsNerdNightSeat({ status: 'CANCELLED', paymentStatus: 'CONFIRMED', paymentExpiresAt: null }, now), false)

assert.equal(isNerdNightPaymentExpired({ status: 'ACTIVE', paymentStatus: 'PENDING', paymentExpiresAt: past }, now), true)
assert.equal(isNerdNightPaymentExpired({ status: 'ACTIVE', paymentStatus: 'PENDING', paymentExpiresAt: null }, now), true)
assert.equal(isNerdNightPaymentExpired({ status: 'ACTIVE', paymentStatus: 'PENDING', paymentExpiresAt: past, paymentTransactionId: 'vietqr-1' }, now), false)
assert.equal(isNerdNightPaymentExpired({ status: 'CANCELLED', paymentStatus: 'PENDING', paymentExpiresAt: past }, now), false)

assert.equal(canNerdNightReceivePayment({ status: 'PUBLISHED', startsAt: future }, now), true)
assert.equal(canNerdNightReceivePayment({ status: 'CANCELLED', startsAt: future }, now), false)
assert.equal(canNerdNightReceivePayment({ status: 'PUBLISHED', startsAt: past }, now), false)

assert.equal(canOpenNerdNightVoting({ status: 'PUBLISHED', startsAt: past }, now), true)
assert.equal(canOpenNerdNightVoting({ status: 'PUBLISHED', startsAt: future }, now), false)
assert.equal(canOpenNerdNightVoting({ status: 'COMPLETED', startsAt: past }, now), false)

console.log('Nerd Night flow checks passed')
