import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import {
  createRegistrationOrderWithCode,
  settleRegistrationOrderInTx,
} from '../src/lib/subscription/order-lifecycle'

const databaseName = (() => {
  try {
    return new URL(process.env.DATABASE_URL || '').pathname.toLowerCase()
  } catch {
    return ''
  }
})()

if (process.env.ALLOW_TEST_DATABASE_MUTATIONS !== 'true' && !/(^|[_/-])test([_/-]|$)/.test(databaseName)) {
  throw new Error(
    'Integration test bị chặn: hãy dùng database test hoặc đặt ALLOW_TEST_DATABASE_MUTATIONS=true.'
  )
}

const prefix = `mb_settlement_${Date.now()}_${randomUUID().slice(0, 8)}`
const userIds: string[] = []
const orderIds: string[] = []
const subscriberIds: string[] = []

function addUtcDays(value: Date, days: number) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

async function createTestUser(label: string) {
  const user = await prisma.user.create({
    data: {
      id: `${prefix}_${label}_user`,
      name: `Monthly Beaver ${label}`,
      email: `${prefix}_${label}@example.test`,
      phone: `09${Date.now().toString().slice(-8)}${label === 'new' ? '1' : '2'}`,
      password: 'not-used',
      role: 'CUSTOMER',
      visitPurpose: [],
    },
  })
  userIds.push(user.id)
  return user
}

async function createPendingOrder(input: {
  userId: string
  fullName: string
  phone: string
  subscriberId?: string
}) {
  const order = await createRegistrationOrderWithCode({
    userId: input.userId,
    subscriberId: input.subscriberId,
    fullName: input.fullName,
    phone: input.phone,
    email: `${prefix}@example.test`,
    branchPrimary: 'HTM',
    planType: 'WEEKLY_LIMITED',
    selfieUrl: '/test/monthly-beaver.jpg',
    orderStatus: 'PENDING_PAYMENT',
    paymentMethod: 'VIETQR',
    amount: 450_000,
    expiresAt: addUtcDays(new Date(), 1),
  })
  orderIds.push(order.id)
  return order
}

async function settle(orderId: string, paidAt: Date, paymentRef: string) {
  return prisma.$transaction((tx) =>
    settleRegistrationOrderInTx(tx, {
      orderId,
      paidAt,
      paymentRef,
      paymentMethod: 'VIETQR',
      performedBy: 'integration-test',
      auditAction: 'integration_test_payment',
    })
  )
}

async function testNewCustomerAutoActivation() {
  const user = await createTestUser('new')
  const order = await createPendingOrder({
    userId: user.id,
    fullName: user.name,
    phone: user.phone!,
  })
  const paidAt = new Date()
  const first = await settle(order.id, paidAt, `${prefix}_new_payment`)

  assert.equal(first.outcome, 'SETTLED')
  assert.equal(first.activationKind, 'REGISTERED')
  assert.equal(first.order.orderStatus, 'ACTIVATED')
  assert.ok(first.order.subscriberId)
  assert.ok(first.order.subscriptionId)
  subscriberIds.push(first.order.subscriberId)

  const [subscriber, subscription, credential] = await Promise.all([
    prisma.subscriber.findUniqueOrThrow({ where: { id: first.order.subscriberId } }),
    prisma.subscription.findUniqueOrThrow({ where: { id: first.order.subscriptionId } }),
    prisma.membershipQrCredential.findUniqueOrThrow({
      where: { subscriberId: first.order.subscriberId },
    }),
  ])

  assert.equal(subscriber.userId, user.id)
  assert.equal(subscriber.status, 'ACTIVE')
  assert.equal(subscription.status, 'ACTIVE')
  assert.equal(subscription.planType, 'WEEKLY_LIMITED')
  assert.equal(subscription.totalHoursMin, 15 * 60)
  assert.ok(subscription.startDate)
  assert.ok(subscription.endDate)
  assert.equal(
    Math.round((subscription.endDate!.getTime() - subscription.startDate!.getTime()) / 86_400_000),
    6
  )
  assert.equal(credential.status, 'ACTIVE')
  assert.equal(credential.version, 1)

  const retry = await settle(order.id, paidAt, `${prefix}_duplicate_payment`)
  assert.equal(retry.outcome, 'ALREADY_SETTLED')
  assert.equal(retry.activationKind, null)
  assert.equal(await prisma.subscription.count({ where: { subscriberId: subscriber.id } }), 1)
  assert.equal(await prisma.membershipQrCredential.count({ where: { subscriberId: subscriber.id } }), 1)
}

async function testRenewalKeepsRevokedQrLocked() {
  const user = await createTestUser('renewal')
  const subscriber = await prisma.subscriber.create({
    data: {
      id: `${prefix}_renewal_subscriber`,
      userId: user.id,
      fullName: user.name,
      phone: user.phone!,
      email: user.email,
      branchPrimary: 'HTM',
      status: 'ACTIVE',
    },
  })
  subscriberIds.push(subscriber.id)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const originalEndDate = addUtcDays(today, 10)
  const subscription = await prisma.subscription.create({
    data: {
      id: `${prefix}_renewal_subscription`,
      subscriberId: subscriber.id,
      planType: 'WEEKLY_LIMITED',
      pricePaid: 450_000,
      status: 'ACTIVE',
      activationDate: new Date(),
      startDate: today,
      endDate: originalEndDate,
      totalHoursMin: 15 * 60,
      usedHoursMin: 30,
    },
  })
  const credential = await prisma.membershipQrCredential.create({
    data: {
      subscriberId: subscriber.id,
      publicId: randomUUID(),
      version: 3,
      status: 'REVOKED',
      rotatedAt: new Date(),
    },
  })
  const order = await createPendingOrder({
    userId: user.id,
    fullName: user.name,
    phone: user.phone!,
    subscriberId: subscriber.id,
  })

  const result = await settle(order.id, new Date(), `${prefix}_renewal_payment`)
  assert.equal(result.outcome, 'SETTLED')
  assert.equal(result.activationKind, 'RENEWED')
  assert.equal(result.order.orderStatus, 'ACTIVATED')
  assert.equal(result.order.subscriptionId, subscription.id)

  const [renewed, credentialAfter] = await Promise.all([
    prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } }),
    prisma.membershipQrCredential.findUniqueOrThrow({ where: { id: credential.id } }),
  ])
  assert.equal(renewed.endDate?.toISOString(), addUtcDays(originalEndDate, 7).toISOString())
  assert.equal(renewed.totalHoursMin, 30 * 60)
  assert.equal(credentialAfter.status, 'REVOKED')
  assert.equal(credentialAfter.version, 3)
  assert.equal(credentialAfter.publicId, credential.publicId)
}

async function cleanup() {
  if (orderIds.length) {
    await prisma.subscriptionAuditLog.deleteMany({ where: { entityId: { in: orderIds } } })
    await prisma.registrationOrder.deleteMany({ where: { id: { in: orderIds } } })
  }
  if (subscriberIds.length) {
    await prisma.membershipScan.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.dailyUsage.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.subscriptionSession.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.transaction.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.subscription.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.membershipQrCredential.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
    await prisma.subscriber.deleteMany({ where: { id: { in: subscriberIds } } })
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
}

async function main() {
  try {
    await testNewCustomerAutoActivation()
    await testRenewalKeepsRevokedQrLocked()
    console.log('PASS: thanh toán tự kích hoạt gói và cấp QR; QR bị thu hồi vẫn giữ khóa khi gia hạn.')
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
