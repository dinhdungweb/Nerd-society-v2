import assert from 'node:assert/strict'
import {
  canNerdNightReceivePayment,
  canOpenNerdNightVoting,
  getNerdNightWalletPaymentExternalId,
  hasNerdNightPaymentEvidence,
  holdsNerdNightSeat,
  isNerdNightPaymentExpired,
  isNerdNightWalletPayment,
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

const firstWalletPaymentId = getNerdNightWalletPaymentExternalId({ id: 'registration-1', paymentExpiresAt: future, createdAt: past })
const secondWalletPaymentId = getNerdNightWalletPaymentExternalId({ id: 'registration-1', paymentExpiresAt: new Date('2026-08-11T14:00:00.000Z'), createdAt: past })
assert.notEqual(firstWalletPaymentId, secondWalletPaymentId)
assert.equal(isNerdNightWalletPayment(firstWalletPaymentId), true)
assert.equal(isNerdNightWalletPayment('vietqr-transaction'), false)

console.log('Nerd Night flow checks passed')
