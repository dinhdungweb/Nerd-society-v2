import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { buildMembershipQrPayload } from '../src/lib/subscription/qr-credential'
import { processMembershipQrScan } from '../src/lib/subscription/membership-scan'
import { checkoutSubscriptionSessionInTx } from '../src/lib/subscription/session-manager'

process.env.QR_SIGNING_SECRET = 'integration-test-secret-with-at-least-32-bytes'

const databaseName = (() => {
  try {
    return new URL(process.env.DATABASE_URL || '').pathname.toLowerCase()
  } catch {
    return ''
  }
})()
if (process.env.ALLOW_TEST_DATABASE_MUTATIONS !== 'true' && !/(^|[_/-])test([_/-]|$)/.test(databaseName)) {
  throw new Error('Integration test bị chặn: hãy dùng database test hoặc đặt ALLOW_TEST_DATABASE_MUTATIONS=true.')
}

type TestResult = { name: string; ok: boolean; detail?: string; ms: number }
type TestMember = Awaited<ReturnType<typeof createMember>>

const prefix = `qrtest_${Date.now()}_${randomUUID().slice(0, 6)}_`
const results: TestResult[] = []
let sequence = 0

function next(label: string) {
  sequence += 1
  return `${prefix}${label}_${sequence}`
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function almostMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000 + 10_000)
}

async function createMember(
  label: string,
  options: {
    subscription?: 'active' | 'pending' | 'expired' | 'none'
    dailyLimitMin?: number | null
    totalHoursMin?: number | null
    usedHoursMin?: number
    debt?: number
    walletBalance?: number | null
    credentialStatus?: 'ACTIVE' | 'REVOKED'
    subscriberStatus?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  } = {}
) {
  const id = next(label)
  let user = null
  let wallet = null
  if (options.walletBalance !== undefined && options.walletBalance !== null) {
    user = await prisma.user.create({
      data: {
        id: `${id}_user`,
        email: `${id}@example.test`,
        password: 'not-used',
        name: `QR Test ${label}`,
        role: 'CUSTOMER',
        visitPurpose: [],
      },
    })
    wallet = await prisma.wallet.create({
      data: {
        id: `${id}_wallet`,
        userId: user.id,
        walletCode: `${id}_wallet_code`,
        balance: options.walletBalance,
        status: 'ACTIVE',
      },
    })
  }

  const subscriber = await prisma.subscriber.create({
    data: {
      id,
      fullName: `QR Test ${label}`,
      phone: `09${String(sequence).padStart(8, '0')}${Date.now().toString().slice(-3)}`,
      userId: user?.id,
      outstandingBalance: options.debt || 0,
      branchPrimary: 'HTM',
      status: options.subscriberStatus || 'ACTIVE',
    },
  })

  let subscription = null
  const subState = options.subscription || 'none'
  if (subState !== 'none') {
    subscription = await prisma.subscription.create({
      data: {
        id: `${id}_sub`,
        subscriberId: subscriber.id,
        planType: 'MONTHLY_UNLIMITED',
        pricePaid: 1_200_000,
        status: subState === 'pending' ? 'PENDING_ACTIVATION' : 'ACTIVE',
        startDate: subState === 'pending' ? null : daysFromNow(-5),
        endDate:
          subState === 'expired' ? daysFromNow(-1) : subState === 'pending' ? null : daysFromNow(20),
        dailyLimitMin: options.dailyLimitMin === undefined ? 480 : options.dailyLimitMin,
        totalHoursMin: options.totalHoursMin === undefined ? null : options.totalHoursMin,
        usedHoursMin: options.usedHoursMin || 0,
      },
    })
  }

  const credential = await prisma.membershipQrCredential.create({
    data: {
      id: `${id}_credential`,
      subscriberId: subscriber.id,
      publicId: `${id}_public`,
      status: options.credentialStatus || 'ACTIVE',
    },
  })

  return {
    subscriber,
    subscription,
    credential,
    user,
    wallet,
    payload: buildMembershipQrPayload(credential),
  }
}

async function run(name: string, fn: () => Promise<string | void>) {
  const started = Date.now()
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail || undefined, ms: Date.now() - started })
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.stack || error.message : String(error),
      ms: Date.now() - started,
    })
  }
}

async function cleanup() {
  const subscribers = await prisma.subscriber.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  })
  const subscriberIds = subscribers.map((item) => item.id)
  const sessions = await prisma.subscriptionSession.findMany({
    where: { subscriberId: { in: subscriberIds } },
    select: { id: true },
  })
  const sessionIds = sessions.map((item) => item.id)
  const wallets = await prisma.wallet.findMany({
    where: { userId: { startsWith: prefix } },
    select: { id: true },
  })
  const walletIds = wallets.map((item) => item.id)

  await prisma.membershipScan.deleteMany({
    where: {
      OR: [{ performedById: `${prefix}performer` }, { subscriberId: { in: subscriberIds } }],
    },
  })
  if (sessionIds.length) {
    await prisma.subscriptionAuditLog.deleteMany({ where: { entityId: { in: sessionIds } } })
  }
  if (walletIds.length) {
    await prisma.walletTransaction.deleteMany({ where: { walletId: { in: walletIds } } })
  }
  await prisma.transaction.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.dailyUsage.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.registrationOrder.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.subscriptionSession.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.subscription.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.membershipQrCredential.deleteMany({ where: { subscriberId: { in: subscriberIds } } })
  await prisma.subscriber.deleteMany({ where: { id: { in: subscriberIds } } })
  await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } })
}

async function main() {
  const htm = await prisma.location.findUniqueOrThrow({ where: { code: 'HTM' } })
  const ts = await prisma.location.findUniqueOrThrow({ where: { code: 'TS' } })
  const performer = await prisma.user.create({
    data: {
      id: `${prefix}performer`,
      email: `${prefix}performer@example.test`,
      password: 'not-used',
      name: 'QR Integration Test',
      role: 'ADMIN',
      visitPurpose: [],
    },
  })

  const scan = (member: TestMember, location: typeof htm, requestId = randomUUID()) =>
    processMembershipQrScan({
      requestId,
      payload: member.payload,
      locationId: location.id,
      locationCode: location.code,
      performedById: performer.id,
      performedByName: performer.name,
    })

  const ageScans = (member: TestMember) =>
    prisma.membershipScan.updateMany({
      where: { credentialId: member.credential.id },
      data: { scannedAt: new Date(Date.now() - 20_000) },
    })

  await run('QR giả bị từ chối và không lưu payload thô', async () => {
    const raw = `INVALID-${randomUUID()}`
    const requestId = randomUUID()
    const result = await processMembershipQrScan({
      requestId,
      payload: raw,
      locationId: htm.id,
      locationCode: htm.code,
      performedById: performer.id,
      performedByName: performer.name,
    })
    assert.equal(result.code, 'INVALID_QR')
    const saved = await prisma.membershipScan.findUniqueOrThrow({ where: { requestId } })
    assert.equal(saved.payloadFingerprint?.length, 64)
    assert.equal(JSON.stringify(saved.result).includes(raw), false)
  })

  await run('QR bị thu hồi bị từ chối', async () => {
    const member = await createMember('revoked', { credentialStatus: 'REVOKED' })
    const result = await scan(member, htm)
    assert.equal(result.code, 'REVOKED_QR')
    assert.equal(result.subscriberName, member.subscriber.fullName)
  })

  await run('QR phiên bản cũ sau rotation bị từ chối', async () => {
    const member = await createMember('rotated')
    await prisma.membershipQrCredential.update({
      where: { id: member.credential.id },
      data: { version: 2, rotatedAt: new Date() },
    })
    const result = await scan(member, htm)
    assert.equal(result.code, 'REVOKED_QR')
  })

  await run('Check-in, idempotency, quét lặp và check-out toggle', async () => {
    const member = await createMember('toggle', { subscription: 'active' })
    const requestId = randomUUID()
    const first = await scan(member, htm, requestId)
    assert.equal(first.code, 'CHECK_IN_SUCCESS')
    assert.ok(first.sessionId)
    const retry = await scan(member, htm, requestId)
    assert.equal(retry.code, 'CHECK_IN_SUCCESS')
    assert.equal(retry.sessionId, first.sessionId)
    const duplicate = await scan(member, htm)
    assert.equal(duplicate.code, 'DUPLICATE_IGNORED')
    await ageScans(member)
    const checkout = await scan(member, htm)
    assert.equal(checkout.code, 'CHECK_OUT_SUCCESS')
    const session = await prisma.subscriptionSession.findUniqueOrThrow({ where: { id: first.sessionId } })
    assert.equal(session.status, 'COMPLETED')
    assert.ok(session.checkOutTime)
  })

  await run('Session mở khác cơ sở bị chặn', async () => {
    const member = await createMember('cross_branch', { subscription: 'active' })
    const first = await scan(member, htm)
    assert.equal(first.code, 'CHECK_IN_SUCCESS')
    await ageScans(member)
    const blocked = await scan(member, ts)
    assert.equal(blocked.code, 'BLOCK_CROSS_BRANCH')
    assert.equal(blocked.openSessionBranch, 'HTM')
    const openCount = await prisma.subscriptionSession.count({
      where: { subscriberId: member.subscriber.id, status: 'ACTIVE', checkOutTime: null },
    })
    assert.equal(openCount, 1)
  })

  await run('Công nợ chặn check-in', async () => {
    const member = await createMember('debt', { subscription: 'active', debt: 1_000 })
    const blocked = await scan(member, htm)
    assert.equal(blocked.code, 'BLOCK_DEBT')
    assert.equal(await prisma.subscriptionSession.count({ where: { subscriberId: member.subscriber.id } }), 0)
  })

  await run('Hội viên bị khóa/hết hiệu lực bị chặn dù có gói hoặc Ví Nerd', async () => {
    const suspended = await createMember('suspended_member', {
      subscription: 'active',
      subscriberStatus: 'SUSPENDED',
    })
    const expired = await createMember('expired_member', {
      walletBalance: 100_000,
      subscriberStatus: 'EXPIRED',
    })
    assert.equal((await scan(suspended, htm)).code, 'BLOCK_MEMBER_STATUS')
    assert.equal((await scan(expired, htm)).code, 'BLOCK_MEMBER_STATUS')
    assert.equal(
      await prisma.subscriptionSession.count({
        where: { subscriberId: { in: [suspended.subscriber.id, expired.subscriber.id] } },
      }),
      0
    )
  })

  await run('Gói hết hạn bị chặn và chuyển EXPIRED', async () => {
    const member = await createMember('expired', { subscription: 'expired' })
    const blocked = await scan(member, htm)
    assert.equal(blocked.code, 'BLOCK_EXPIRED')
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: member.subscription!.id } })
    assert.equal(subscription.status, 'EXPIRED')
  })

  await run('Hết quota ngày bị chặn', async () => {
    const member = await createMember('quota', { subscription: 'active', dailyLimitMin: 480 })
    await prisma.dailyUsage.create({
      data: {
        id: `${member.subscriber.id}_usage`,
        subscriberId: member.subscriber.id,
        subscriptionId: member.subscription!.id,
        usageDate: daysFromNow(0),
        totalMin: 480,
        quotaMin: 480,
      },
    })
    const blocked = await scan(member, htm)
    assert.equal(blocked.code, 'BLOCK_DAILY_LIMIT')
    assert.equal(blocked.remainingMin, 0)
  })

  await run('Ví thấp bị chặn', async () => {
    const member = await createMember('low_wallet', { walletBalance: 3_000 })
    const blocked = await scan(member, htm)
    assert.equal(blocked.code, 'BLOCK_LOW_BALANCE')
  })

  await run('Không gói và không ví bị chặn', async () => {
    const member = await createMember('no_account')
    const blocked = await scan(member, htm)
    assert.equal(blocked.code, 'NO_ELIGIBLE_ACCOUNT')
  })

  await run('Check-in không kích hoạt gói đang chờ cấp QR', async () => {
    const member = await createMember('activation', { subscription: 'pending' })
    const result = await scan(member, htm)
    assert.equal(result.code, 'NO_ELIGIBLE_ACCOUNT')
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: member.subscription!.id } })
    assert.equal(subscription.status, 'PENDING_ACTIVATION')
    assert.equal(subscription.activationDate, null)
  })

  await run('Checkout session legacy dù đang có nợ', async () => {
    const member = await createMember('legacy_checkout', { subscription: 'active', debt: 5_000 })
    const session = await prisma.subscriptionSession.create({
      data: {
        id: `${member.subscriber.id}_session`,
        subscriberId: member.subscriber.id,
        subscriptionId: member.subscription!.id,
        branch: 'HTM',
        checkInTime: almostMinutesAgo(20),
        source: 'legacy_card',
        status: 'ACTIVE',
      },
    })
    const result = await scan(member, htm)
    assert.equal(result.code, 'CHECK_OUT_SUCCESS')
    const saved = await prisma.subscriptionSession.findUniqueOrThrow({ where: { id: session.id } })
    assert.equal(saved.source, 'legacy_card')
    assert.equal(saved.status, 'COMPLETED')
  })

  await run('Ví Nerd checkout và trừ tiền theo block hiện hành', async () => {
    const member = await createMember('wallet_billing', { walletBalance: 10_000 })
    const checkin = await scan(member, htm)
    assert.equal(checkin.code, 'CHECK_IN_SUCCESS')
    await prisma.subscriptionSession.update({
      where: { id: checkin.sessionId! },
      data: { checkInTime: almostMinutesAgo(20) },
    })
    await ageScans(member)
    const checkout = await scan(member, htm)
    assert.equal(checkout.code, 'CHECK_OUT_SUCCESS')
    assert.equal(checkout.durationMin, 20)
    assert.equal(checkout.amountCharged, 7_500)
    assert.equal(checkout.walletBalance, 2_500)
  })

  await run('Phụ phí subscription đúng 250đ/phút', async () => {
    const member = await createMember('overage', { subscription: 'active', dailyLimitMin: 480 })
    await prisma.dailyUsage.create({
      data: {
        id: `${member.subscriber.id}_usage`,
        subscriberId: member.subscriber.id,
        subscriptionId: member.subscription!.id,
        usageDate: daysFromNow(0),
        totalMin: 470,
        quotaMin: 480,
      },
    })
    await prisma.subscriptionSession.create({
      data: {
        id: `${member.subscriber.id}_session`,
        subscriberId: member.subscriber.id,
        subscriptionId: member.subscription!.id,
        branch: 'HTM',
        checkInTime: almostMinutesAgo(30),
        source: 'qr',
        status: 'ACTIVE',
      },
    })
    const checkout = await scan(member, htm)
    assert.equal(checkout.code, 'CHECK_OUT_SUCCESS')
    assert.equal(checkout.durationMin, 30)
    assert.equal(checkout.overageMin, 20)
    assert.equal(checkout.amountCharged, 5_000)
    const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { subscriberId: member.subscriber.id } })
    assert.equal(usage.totalMin, 500)
    assert.equal(usage.overageMin, 20)
  })

  await run('Hai scan đồng thời chỉ tạo một session', async () => {
    const member = await createMember('concurrent', { subscription: 'active' })
    const pair = await Promise.all([scan(member, htm), scan(member, htm)])
    assert.equal(pair.filter((item) => item.code === 'CHECK_IN_SUCCESS').length, 1)
    assert.equal(pair.filter((item) => item.code === 'DUPLICATE_IGNORED').length, 1)
    assert.equal(
      await prisma.subscriptionSession.count({
        where: { subscriberId: member.subscriber.id, status: 'ACTIVE', checkOutTime: null },
      }),
      1
    )
    return pair.map((item) => item.code).join(', ')
  })

  await run('Hai cơ sở scan đồng thời chỉ một request thay đổi session', async () => {
    const member = await createMember('concurrent_branches', { subscription: 'active' })
    const pair = await Promise.all([scan(member, htm), scan(member, ts)])
    assert.equal(pair.filter((item) => item.code === 'CHECK_IN_SUCCESS').length, 1)
    assert.equal(
      await prisma.subscriptionSession.count({
        where: { subscriberId: member.subscriber.id, status: 'ACTIVE', checkOutTime: null },
      }),
      1
    )
    return pair.map((item) => `${item.locationCode}:${item.code}`).join(', ')
  })

  await run('Transaction checkout rollback khi bước sau thất bại', async () => {
    const member = await createMember('rollback', { subscription: 'active' })
    const session = await prisma.subscriptionSession.create({
      data: {
        id: `${member.subscriber.id}_session`,
        subscriberId: member.subscriber.id,
        subscriptionId: member.subscription!.id,
        branch: 'HTM',
        checkInTime: almostMinutesAgo(30),
        source: 'qr',
        status: 'ACTIVE',
      },
    })
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await checkoutSubscriptionSessionInTx(tx, session.id, {
          source: 'qr',
          performedBy: performer.name,
        })
        throw new Error('forced billing failure')
      })
    )
    const saved = await prisma.subscriptionSession.findUniqueOrThrow({ where: { id: session.id } })
    assert.equal(saved.status, 'ACTIVE')
    assert.equal(saved.checkOutTime, null)
    assert.equal(await prisma.dailyUsage.count({ where: { subscriberId: member.subscriber.id } }), 0)
  })
}

async function execute() {
  try {
    await main()
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  const report = {
    total: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
  console.log(JSON.stringify(report, null, 2))
  if (report.failed) process.exitCode = 1
}

execute().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
