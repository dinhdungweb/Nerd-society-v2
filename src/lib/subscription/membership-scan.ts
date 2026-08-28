import { prisma } from '@/lib/prisma'
import {
  checkInSubscriberInTx,
  checkoutSubscriptionSessionInTx,
  type CheckInResult,
} from '@/lib/subscription/session-manager'
import {
  fingerprintQrPayload,
  verifyMembershipQrPayload,
} from '@/lib/subscription/qr-credential'
import { businessDateOnly } from '@/lib/subscription/date-utils'
import { getSubscriptionDailyCapMin } from '@/lib/subscription/usage-billing'
import { MembershipScanOutcome, Prisma } from '@prisma/client'

const DUPLICATE_WINDOW_MS = 10_000

export type MembershipScanResult = CheckInResult & {
  code: MembershipScanOutcome
  requestId: string
  locationId: string
  locationCode: string
  duplicate?: boolean
  openSessionBranch?: string
  openSessionCheckInTime?: string
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function failureCode(result: CheckInResult): MembershipScanOutcome {
  switch (result.errorType) {
    case 'BLOCK_MEMBER_STATUS':
      return 'BLOCK_MEMBER_STATUS'
    case 'BLOCK_DEBT':
      return 'BLOCK_DEBT'
    case 'BLOCK_EXPIRED':
      return 'BLOCK_EXPIRED'
    case 'BLOCK_CAP_REACHED':
      return 'BLOCK_DAILY_LIMIT'
    case 'BLOCK_LOW_BALANCE':
      return 'BLOCK_LOW_BALANCE'
    default:
      return 'NO_ELIGIBLE_ACCOUNT'
  }
}

async function readIdempotentResult(requestId: string) {
  const existing = await prisma.membershipScan.findUnique({ where: { requestId } })
  return existing?.result as MembershipScanResult | undefined
}

async function persistTerminalResult(
  data: Prisma.MembershipScanCreateArgs['data'],
  result: MembershipScanResult
) {
  try {
    await prisma.membershipScan.create({ data })
    return result
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await readIdempotentResult(result.requestId)
      if (existing) return existing
    }
    throw error
  }
}

export async function processMembershipQrScan(input: {
  requestId: string
  payload: string
  locationId: string
  locationCode: string
  performedById: string
  performedByName: string
  retryCount?: number
}): Promise<MembershipScanResult> {
  const idempotent = await readIdempotentResult(input.requestId)
  if (idempotent) return idempotent

  const startedAt = Date.now()
  const parsed = verifyMembershipQrPayload(input.payload)
  if (!parsed) {
    const result: MembershipScanResult = {
      code: 'INVALID_QR',
      requestId: input.requestId,
      locationId: input.locationId,
      locationCode: input.locationCode,
      success: false,
      message: 'QR không hợp lệ.',
    }
    return persistTerminalResult(
      {
        requestId: input.requestId,
        locationId: input.locationId,
        performedById: input.performedById,
        outcome: result.code,
        payloadFingerprint: fingerprintQrPayload(input.payload),
        latencyMs: Date.now() - startedAt,
        result: jsonSafe(result) as Prisma.InputJsonValue,
      },
      result
    )
  }

  const credential = await prisma.membershipQrCredential.findUnique({
    where: { publicId: parsed.publicId },
    include: { subscriber: true },
  })
  if (!credential) {
    const result: MembershipScanResult = {
      code: 'INVALID_QR',
      requestId: input.requestId,
      locationId: input.locationId,
      locationCode: input.locationCode,
      success: false,
      message: 'QR không tồn tại.',
    }
    return persistTerminalResult(
      {
        requestId: input.requestId,
        locationId: input.locationId,
        performedById: input.performedById,
        outcome: result.code,
        payloadFingerprint: fingerprintQrPayload(input.payload),
        latencyMs: Date.now() - startedAt,
        result: jsonSafe(result) as Prisma.InputJsonValue,
      },
      result
    )
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Advisory locks return PostgreSQL `void`. `$queryRaw` attempts to
        // deserialize that value, which Prisma does not support; `$executeRaw`
        // executes the SELECT without decoding its result set.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${credential.subscriberId}))`

        const existing = await tx.membershipScan.findUnique({ where: { requestId: input.requestId } })
        if (existing) return existing.result as MembershipScanResult

        const liveCredential = await tx.membershipQrCredential.findUnique({
          where: { id: credential.id },
          include: { subscriber: true },
        })
        if (!liveCredential) throw new Error('Credential disappeared during scan')

        if (liveCredential.status !== 'ACTIVE' || liveCredential.version !== parsed.version) {
          const result: MembershipScanResult = {
            code: 'REVOKED_QR',
            requestId: input.requestId,
            locationId: input.locationId,
            locationCode: input.locationCode,
            success: false,
            message: 'QR đã bị thu hồi hoặc được cấp lại.',
            subscriberId: liveCredential.subscriberId,
            subscriberName: liveCredential.subscriber.fullName,
            subscriberPhoto: liveCredential.subscriber.photoUrl,
          }
          await tx.membershipScan.create({
            data: {
              requestId: input.requestId,
              credentialId: liveCredential.id,
              subscriberId: liveCredential.subscriberId,
              locationId: input.locationId,
              performedById: input.performedById,
              outcome: result.code,
              latencyMs: Date.now() - startedAt,
              result: jsonSafe(result) as Prisma.InputJsonValue,
            },
          })
          return result
        }

        const recentScan = await tx.membershipScan.findFirst({
          where: {
            credentialId: liveCredential.id,
            scannedAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
            outcome: { in: ['CHECK_IN_SUCCESS', 'CHECK_OUT_SUCCESS', 'DUPLICATE_IGNORED'] },
          },
          orderBy: { scannedAt: 'desc' },
        })
        if (recentScan) {
          const previous = recentScan.result as MembershipScanResult
          const result: MembershipScanResult = {
            ...previous,
            code: 'DUPLICATE_IGNORED',
            requestId: input.requestId,
            duplicate: true,
            message: 'Đã bỏ qua lần quét lặp.',
          }
          await tx.membershipScan.create({
            data: {
              requestId: input.requestId,
              credentialId: liveCredential.id,
              subscriberId: liveCredential.subscriberId,
              locationId: input.locationId,
              performedById: input.performedById,
              sessionId: previous.sessionId,
              outcome: result.code,
              latencyMs: Date.now() - startedAt,
              result: jsonSafe(result) as Prisma.InputJsonValue,
            },
          })
          return result
        }

        const openSession = await tx.subscriptionSession.findFirst({
          where: { subscriberId: liveCredential.subscriberId, checkOutTime: null, status: 'ACTIVE' },
          orderBy: { checkInTime: 'desc' },
          include: {
            subscription: true,
            subscriber: { include: { user: { select: { wallet: { select: { balance: true } } } } } },
          },
        })

        let businessResult: CheckInResult
        let code: MembershipScanOutcome
        if (openSession && openSession.branch !== input.locationCode) {
          const totalQuotaMin = openSession.subscription?.totalHoursMin && openSession.subscription.totalHoursMin > 0
            ? openSession.subscription.totalHoursMin + openSession.subscription.carriedHoursMin
            : null
          const dailyQuotaMin = getSubscriptionDailyCapMin(openSession.subscription)
          const quotaMin = totalQuotaMin || dailyQuotaMin || undefined
          let remainingMin = totalQuotaMin
            ? Math.max(0, totalQuotaMin - (openSession.subscription?.usedHoursMin || 0))
            : undefined
          if (dailyQuotaMin) {
            const usage = await tx.dailyUsage.findUnique({
              where: {
                subscriberId_usageDate: {
                  subscriberId: liveCredential.subscriberId,
                  usageDate: businessDateOnly(),
                },
              },
            })
            remainingMin = Math.max(0, dailyQuotaMin - (usage?.totalMin || 0))
          }
          const result: MembershipScanResult = {
            code: 'BLOCK_CROSS_BRANCH',
            requestId: input.requestId,
            locationId: input.locationId,
            locationCode: input.locationCode,
            success: false,
            message: `Khách đang có session mở tại ${openSession.branch}.`,
            subscriberId: liveCredential.subscriberId,
            subscriberName: liveCredential.subscriber.fullName,
            subscriberPhoto: liveCredential.subscriber.photoUrl,
            planType: openSession.subscription?.planType,
            quotaMin,
            remainingMin,
            walletBalance: openSession.subscriber.user?.wallet?.balance,
            outstandingBalance: openSession.subscriber.outstandingBalance,
            sessionId: openSession.id,
            openSessionBranch: openSession.branch,
            openSessionCheckInTime: openSession.checkInTime.toISOString(),
          }
          await tx.membershipScan.create({
            data: {
              requestId: input.requestId,
              credentialId: liveCredential.id,
              subscriberId: liveCredential.subscriberId,
              locationId: input.locationId,
              performedById: input.performedById,
              sessionId: openSession.id,
              outcome: result.code,
              latencyMs: Date.now() - startedAt,
              result: jsonSafe(result) as Prisma.InputJsonValue,
            },
          })
          return result
        }

        if (openSession) {
          businessResult = await checkoutSubscriptionSessionInTx(tx, openSession.id, {
            source: 'qr',
            performedBy: input.performedByName,
          })
          code = businessResult.success ? 'CHECK_OUT_SUCCESS' : failureCode(businessResult)
        } else {
          businessResult = await checkInSubscriberInTx(
            tx,
            liveCredential.subscriberId,
            input.locationCode,
            { source: 'qr', performedBy: input.performedByName }
          )
          code = businessResult.success ? 'CHECK_IN_SUCCESS' : failureCode(businessResult)
        }

        const result: MembershipScanResult = {
          ...businessResult,
          code,
          requestId: input.requestId,
          locationId: input.locationId,
          locationCode: input.locationCode,
        }
        await tx.membershipScan.create({
          data: {
            requestId: input.requestId,
            credentialId: liveCredential.id,
            subscriberId: liveCredential.subscriberId,
            locationId: input.locationId,
            performedById: input.performedById,
            sessionId: businessResult.sessionId,
            outcome: code,
            latencyMs: Date.now() - startedAt,
            result: jsonSafe(result) as Prisma.InputJsonValue,
          },
        })
        if (businessResult.success) {
          await tx.membershipQrCredential.update({
            where: { id: liveCredential.id },
            data: { lastUsedAt: new Date() },
          })
        }
        return result
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const existing = await readIdempotentResult(input.requestId)
        if (existing) return existing
      }
      if (error.code === 'P2034' && (input.retryCount || 0) < 3) {
        return processMembershipQrScan({ ...input, retryCount: (input.retryCount || 0) + 1 })
      }
    }
    throw error
  }
}
