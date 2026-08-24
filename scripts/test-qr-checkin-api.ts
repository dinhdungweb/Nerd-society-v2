import 'dotenv/config'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

const baseUrl = process.env.QR_TEST_BASE_URL || 'http://localhost:3000'
const prefix = `qrapitest_${Date.now()}_${randomUUID().slice(0, 6)}_`
const staffId = `${prefix}staff`
const adminId = `${prefix}admin`
const customerId = `${prefix}customer`
const subscriberId = `${prefix}subscriber`
const sessionIds: string[] = []

function payloadForServer(publicId: string, version: number) {
  const secret = process.env.QR_SIGNING_SECRET || 'development-only-qr-secret-change-me'
  const signature = createHmac('sha256', secret)
    .update(`NS1.${publicId}.${version}`)
    .digest('base64url')
  return `NS1.${publicId}.${version}.${signature}`
}

function responseCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() || (headers.get('set-cookie') ? [headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';', 1)[0])
}

async function login(email: string, password: string) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  assert.equal(csrfResponse.status, 200)
  const csrf = await csrfResponse.json()
  const csrfCookies = responseCookies(csrfResponse)
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies.join('; '),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: baseUrl,
      json: 'true',
    }),
  })
  assert.ok(response.status === 200 || response.status === 302)
  const sessionCookies = responseCookies(response)
  const allCookies = [...csrfCookies, ...sessionCookies]
  assert.ok(allCookies.some((cookie) => cookie.includes('session-token')))
  return allCookies.join('; ')
}

async function cleanup() {
  const sessions = await prisma.subscriptionSession.findMany({
    where: { subscriberId },
    select: { id: true },
  })
  sessionIds.push(...sessions.map((session) => session.id))
  await prisma.membershipScan.deleteMany({ where: { performedById: staffId } })
  await prisma.subscriptionAuditLog.deleteMany({
    where: { OR: [{ entityId: subscriberId }, { entityId: { in: sessionIds } }] },
  })
  await prisma.dailyUsage.deleteMany({ where: { subscriberId } })
  await prisma.transaction.deleteMany({ where: { subscriberId } })
  await prisma.subscriptionSession.deleteMany({ where: { subscriberId } })
  await prisma.subscription.deleteMany({ where: { subscriberId } })
  await prisma.membershipQrCredential.deleteMany({ where: { subscriberId } })
  await prisma.subscriber.deleteMany({ where: { id: subscriberId } })
  await prisma.user.deleteMany({ where: { id: { in: [staffId, adminId, customerId] } } })
}

async function main() {
  const htm = await prisma.location.findUniqueOrThrow({ where: { code: 'HTM' } })
  const ts = await prisma.location.findUniqueOrThrow({ where: { code: 'TS' } })
  const password = `QR-test-${randomUUID()}`
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.createMany({
    data: [
      {
        id: staffId,
        email: `${staffId}@example.test`,
        password: passwordHash,
        name: 'QR API Staff',
        role: 'STAFF',
        assignedLocationId: htm.id,
        visitPurpose: [],
      },
      {
        id: customerId,
        email: `${customerId}@example.test`,
        password: passwordHash,
        name: 'QR API Customer',
        role: 'CUSTOMER',
        visitPurpose: [],
      },
      {
        id: adminId,
        email: `${adminId}@example.test`,
        password: passwordHash,
        name: 'QR API Admin',
        role: 'ADMIN',
        visitPurpose: [],
      },
    ],
  })
  const staffCookie = await login(`${staffId}@example.test`, password)
  const customerCookie = await login(`${customerId}@example.test`, password)
  const adminCookie = await login(`${adminId}@example.test`, password)

  const anonymous = await fetch(`${baseUrl}/api/staff/subscriptions/scan`)
  assert.equal(anonymous.status, 401)

  const customer = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    headers: { Cookie: customerCookie },
  })
  assert.equal(customer.status, 401)

  const station = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    headers: { Cookie: staffCookie },
  })
  assert.equal(station.status, 200)
  const stationData = await station.json()
  assert.deepEqual(
    stationData.locations.map((location: { code: string }) => location.code),
    ['HTM']
  )

  const spoofedLocation = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: randomUUID(),
      payload: `NS1.fake.1.fake`,
      locationId: ts.id,
    }),
  })
  assert.equal(spoofedLocation.status, 403)

  const invalidRequestId = randomUUID()
  const invalidQr = `INVALID-${randomUUID()}`
  const invalid = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: invalidRequestId, payload: invalidQr, locationId: htm.id }),
  })
  assert.equal(invalid.status, 200)
  assert.equal((await invalid.json()).code, 'INVALID_QR')
  const invalidSaved = await prisma.membershipScan.findUniqueOrThrow({ where: { requestId: invalidRequestId } })
  assert.equal(JSON.stringify(invalidSaved.result).includes(invalidQr), false)

  await prisma.subscriber.create({
    data: {
      id: subscriberId,
      fullName: 'QR API Member',
      phone: `${prefix}phone`,
      branchPrimary: 'HTM',
      userId: customerId,
    },
  })
  await prisma.subscription.create({
    data: {
      id: `${subscriberId}_subscription`,
      subscriberId,
      planType: 'MONTHLY_UNLIMITED',
      pricePaid: 1_200_000,
      status: 'ACTIVE',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      dailyLimitMin: 480,
    },
  })
  const credential = await prisma.membershipQrCredential.create({
    data: {
      id: `${subscriberId}_credential`,
      subscriberId,
      publicId: `${subscriberId}_public`,
    },
  })
  const originalPayload = payloadForServer(credential.publicId, credential.version)

  const profileQr = await fetch(`${baseUrl}/api/profile/membership-qr`, {
    headers: { Cookie: customerCookie },
  })
  assert.equal(profileQr.status, 200)
  assert.equal((await profileQr.json()).payload, originalPayload)

  const staffCannotManageQr = await fetch(
    `${baseUrl}/api/admin/subscriptions/subscribers/${subscriberId}/qr`,
    { headers: { Cookie: staffCookie } }
  )
  assert.equal(staffCannotManageQr.status, 404)

  const adminQr = await fetch(`${baseUrl}/api/admin/subscriptions/subscribers/${subscriberId}/qr`, {
    headers: { Cookie: adminCookie },
  })
  assert.equal(adminQr.status, 200)
  assert.equal((await adminQr.json()).payload, originalPayload)

  const requestId = randomUUID()
  const validBody = JSON.stringify({
    requestId,
    payload: originalPayload,
    locationId: htm.id,
  })
  const valid = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: validBody,
  })
  assert.equal(valid.status, 200)
  const validData = await valid.json()
  assert.equal(validData.code, 'CHECK_IN_SUCCESS')
  assert.equal(validData.subscriberName, 'QR API Member')
  sessionIds.push(validData.sessionId)

  const retry = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: validBody,
  })
  assert.equal(retry.status, 200)
  const retryData = await retry.json()
  assert.equal(retryData.code, 'CHECK_IN_SUCCESS')
  assert.equal(retryData.sessionId, validData.sessionId)

  const rotated = await fetch(`${baseUrl}/api/admin/subscriptions/subscribers/${subscriberId}/qr`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
  })
  assert.equal(rotated.status, 200)
  const rotatedData = await rotated.json()
  assert.equal(rotatedData.credential.version, 2)
  assert.notEqual(rotatedData.payload, originalPayload)

  const oldQr = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: randomUUID(), payload: originalPayload, locationId: htm.id }),
  })
  assert.equal(oldQr.status, 200)
  assert.equal((await oldQr.json()).code, 'REVOKED_QR')

  await prisma.membershipScan.updateMany({
    where: { subscriberId },
    data: { scannedAt: new Date(Date.now() - 20_000) },
  })
  const newQr = await fetch(`${baseUrl}/api/staff/subscriptions/scan`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: randomUUID(), payload: rotatedData.payload, locationId: htm.id }),
  })
  assert.equal(newQr.status, 200)
  assert.equal((await newQr.json()).code, 'CHECK_OUT_SUCCESS')

  const manualCheckin = await fetch(`${baseUrl}/api/staff/dashboard`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'manual_checkin', phone: `${prefix}phone`, branch: 'HTM' }),
  })
  assert.equal(manualCheckin.status, 200)
  const manualCheckinData = await manualCheckin.json()
  assert.equal(manualCheckinData.success, true)
  sessionIds.push(manualCheckinData.sessionId)

  const verify = await fetch(`${baseUrl}/api/staff/dashboard`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', sessionId: manualCheckinData.sessionId, verified: true }),
  })
  assert.equal(verify.status, 200)
  assert.equal((await verify.json()).verified, true)

  const manualCheckout = await fetch(`${baseUrl}/api/staff/dashboard`, {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'manual_checkout', sessionId: manualCheckinData.sessionId }),
  })
  assert.equal(manualCheckout.status, 200)
  assert.equal((await manualCheckout.json()).success, true)

  console.log(
    JSON.stringify(
      {
        passed: 16,
        cases: [
          'anonymous rejected',
          'customer rejected',
          'STAFF receives assigned location only',
          'STAFF location spoof rejected',
          'invalid QR handled without raw payload',
          'valid QR check-in through HTTP API',
          'HTTP retry with same requestId is idempotent',
          'customer can fetch linked membership QR',
          'STAFF cannot manage subscriber QR',
          'ADMIN can fetch subscriber QR',
          'ADMIN can rotate subscriber QR',
          'old QR is rejected immediately after rotation',
          'new QR can check out the existing session',
          'manual phone check-in remains available',
          'staff verification remains available',
          'manual checkout remains available',
        ],
      },
      null,
      2
    )
  )
}

async function execute() {
  try {
    await main()
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }
}

execute().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
