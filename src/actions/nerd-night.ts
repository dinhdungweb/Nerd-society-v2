'use server'

import { authOptions } from '@/lib/auth'
import {
  NERD_NIGHT_INTERESTS,
  NERD_NIGHT_PAYMENT_HOLD_MINUTES,
  formatNerdNightEpisode,
} from '@/lib/nerd-night/constants'
import { prisma } from '@/lib/prisma'
import {
  canNerdNightReceivePayment,
  canOpenNerdNightVoting,
  getNerdNightWalletPaymentExternalId,
  hasNerdNightPaymentEvidence,
  isNerdNightPaymentExpired,
} from '@/lib/nerd-night/registration-state'
import { generateOfficialQR, getVietQRConfig } from '@/lib/vietqr'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { applyWalletTransactionInTx } from '@/lib/wallet-ledger'
import { Prisma } from '@prisma/client'
import { addMinutes } from 'date-fns'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const registrationSchema = z
  .object({
    eventId: z.string().min(1),
    attendeeName: z.string().trim().min(2, 'Vui lòng nhập tên').max(100),
    attendeePhone: z.string().trim().min(8, 'Số điện thoại chưa hợp lệ').max(20),
    wantsToShare: z.boolean(),
    topicTitle: z.string().trim().max(160).optional(),
    topicBackup1: z.string().trim().max(160).optional(),
    topicBackup2: z.string().trim().max(160).optional(),
    topicDescription: z.string().trim().max(800).optional(),
    hasSlides: z.boolean(),
    interests: z.array(z.enum(NERD_NIGHT_INTERESTS)).min(1, 'Vui lòng chọn ít nhất một lĩnh vực quan tâm').max(3),
  })
  .refine((value) => !value.wantsToShare || Boolean(value.topicTitle), {
    message: 'Bạn chọn chia sẻ thì cần điền chủ đề chính',
    path: ['topicTitle'],
  })

const reviewSchema = z.object({
  eventId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).optional(),
})

type ActionResult<T = undefined> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string }

async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return session
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

async function withSerializableRetry<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      lastError = error
      if (!isRetryableTransactionError(error) || attempt === 2) throw error
    }
  }

  throw lastError
}

function getPaymentConfig() {
  const config = getVietQRConfig()
  if (!config.bankCode || !config.accountNumber || !config.accountName) return null
  return config
}

function makeRegistrationIdentity(season: number, episode: number) {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
  const eventCode = formatNerdNightEpisode(season, episode)
  return {
    registrationCode: `NN-${eventCode}-${suffix}`,
    transferContent: `NN ${eventCode} ${suffix}`,
  }
}

export async function registerForNerdNight(
  rawInput: z.input<typeof registrationSchema>,
): Promise<
  ActionResult<{
    registrationId: string
    speakerAccepted: boolean
    paymentExpiresAt: string
  }>
> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập để đăng ký Nerd Night' }

  const parsed = registrationSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Thông tin chưa hợp lệ' }
  }

  try {
    const result = await withSerializableRetry(async (tx) => {
      const now = new Date()
      const stalePendingBefore = addMinutes(now, -NERD_NIGHT_PAYMENT_HOLD_MINUTES)

      await tx.nerdNightRegistration.updateMany({
        where: {
          eventId: parsed.data.eventId,
          status: 'ACTIVE',
          OR: [
            { paymentStatus: 'UNPAID', paymentExpiresAt: { lt: now } },
            {
              paymentStatus: 'PENDING',
              paymentTransactionId: null,
              paymentReceivedAmount: null,
              OR: [
                { paymentExpiresAt: { lt: now } },
                { paymentExpiresAt: null, paymentReportedAt: { lt: stalePendingBefore } },
                { paymentExpiresAt: null, paymentReportedAt: null },
              ],
            },
          ],
        },
        data: { status: 'EXPIRED' },
      })

      const event = await tx.nerdNightEvent.findUnique({
        where: { id: parsed.data.eventId },
      })

      if (!event || event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE')
      if (!event.registrationOpen || event.startsAt <= now) throw new Error('REGISTRATION_CLOSED')

      const existing = await tx.nerdNightRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
      })
      if (existing?.status === 'ACTIVE') throw new Error('ALREADY_REGISTERED')
      if (
        existing &&
        existing.refundStatus !== 'COMPLETED' &&
        hasNerdNightPaymentEvidence(existing)
      ) {
        throw new Error('REFUND_PENDING')
      }

      const [activeCount, speakerCount, listenerCount] = await Promise.all([
        tx.nerdNightRegistration.count({
          where: { eventId: event.id, status: 'ACTIVE' },
        }),
        tx.nerdNightRegistration.count({
          where: {
            eventId: event.id,
            status: 'ACTIVE',
            wantsToShare: true,
          },
        }),
        tx.nerdNightRegistration.count({
          where: {
            eventId: event.id,
            status: 'ACTIVE',
            wantsToShare: false,
          },
        }),
      ])

      if (activeCount >= event.capacity) throw new Error('EVENT_FULL')

      const listenerCapacity = event.capacity - event.speakerCapacity
      const speakerAccepted = parsed.data.wantsToShare
      if (speakerAccepted) {
        if (!event.speakerRegistrationOpen) throw new Error('SPEAKER_REGISTRATION_CLOSED')
        if (speakerCount >= event.speakerCapacity) throw new Error('SPEAKER_FULL')
      } else if (listenerCount >= listenerCapacity) {
        throw new Error('LISTENER_FULL')
      }

      const config = getPaymentConfig()
      if (!config) throw new Error('PAYMENT_NOT_CONFIGURED')

      const paymentExpiresAt = addMinutes(now, NERD_NIGHT_PAYMENT_HOLD_MINUTES)
      const identity = existing
        ? {
            registrationCode: existing.registrationCode,
            transferContent: existing.transferContent,
          }
        : makeRegistrationIdentity(event.season, event.episode)

      const data = {
        attendeeName: parsed.data.attendeeName,
        attendeePhone: parsed.data.attendeePhone,
        status: 'ACTIVE' as const,
        wantsToShare: speakerAccepted,
        topicTitle: speakerAccepted ? parsed.data.topicTitle || null : null,
        topicBackup1: speakerAccepted ? parsed.data.topicBackup1 || null : null,
        topicBackup2: speakerAccepted ? parsed.data.topicBackup2 || null : null,
        topicDescription: speakerAccepted ? parsed.data.topicDescription || null : null,
        hasSlides: speakerAccepted && parsed.data.hasSlides,
        interests: parsed.data.interests,
        speakerStatus: speakerAccepted ? ('PENDING' as const) : ('NONE' as const),
        amount: event.price,
        paymentBankCode: config.bankCode,
        paymentAccountNumber: config.accountNumber,
        paymentAccountName: config.accountName,
        paymentQrUrl: null,
        paymentStatus: 'UNPAID' as const,
        paymentReportedAt: null,
        paymentConfirmedAt: null,
        paymentConfirmedById: null,
        paymentTransactionId: null,
        paymentReceivedAmount: null,
        paymentExpiresAt,
        cancelledAt: null,
        cancellationReason: null,
        refundStatus: 'NOT_REQUIRED' as const,
      }

      const registration = existing
        ? await tx.nerdNightRegistration.update({ where: { id: existing.id }, data: { ...data, ...identity } })
        : await tx.nerdNightRegistration.create({
            data: {
              ...data,
              ...identity,
              eventId: event.id,
              userId: session.user.id,
            },
          })

      return { registration, speakerAccepted, eventSlug: event.slug }
    })

    try {
      const paymentQrUrl = await generateOfficialQR({
        amount: result.registration.amount,
        description: result.registration.transferContent,
        bankCode: result.registration.paymentBankCode,
        accountNumber: result.registration.paymentAccountNumber,
        accountName: result.registration.paymentAccountName,
      })
      await prisma.nerdNightRegistration.update({
        where: { id: result.registration.id },
        data: { paymentQrUrl },
      })
    } catch (error) {
      console.error('[NerdNight] Could not save official VietQR:', error)
    }

    revalidatePath('/nerd-night')
    revalidatePath(`/nerd-night/${result.eventSlug}`)
    revalidatePath('/profile/nerd-night')

    return {
      success: true,
      data: {
        registrationId: result.registration.id,
        speakerAccepted: result.speakerAccepted,
        paymentExpiresAt: result.registration.paymentExpiresAt!.toISOString(),
      },
      message: undefined,
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const messages: Record<string, string> = {
      EVENT_NOT_AVAILABLE: 'Không tìm thấy đêm Nerd Night này',
      REGISTRATION_CLOSED: 'Đêm này đã đóng đăng ký',
      EVENT_FULL: 'Rất tiếc, đêm này vừa đủ người',
      LISTENER_FULL: 'Suất người nghe đã đủ. Bạn chỉ có thể đăng ký nếu còn suất speaker.',
      SPEAKER_FULL: 'Suất speaker vừa đủ. Vui lòng chọn đăng ký với vai trò người nghe nếu còn chỗ.',
      SPEAKER_REGISTRATION_CLOSED: 'Đêm này hiện không mở đăng ký speaker',
      ALREADY_REGISTERED: 'Bạn đã đăng ký đêm này rồi',
      REFUND_PENDING: 'Đăng ký trước đang có khoản tiền cần xử lý. Vui lòng chờ hoàn tiền trước khi đăng ký lại.',
      PAYMENT_NOT_CONFIGURED: 'Nerd Night chưa cấu hình tài khoản nhận thanh toán',
    }

    if (messages[code]) return { success: false, error: messages[code] }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Bạn đã đăng ký đêm này rồi' }
    }
    console.error('[NerdNight] register failed:', error)
    return { success: false, error: 'Chưa thể đăng ký lúc này, vui lòng thử lại' }
  }
}

export async function reportNerdNightPayment(registrationId: string): Promise<ActionResult> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { slug: true, status: true, startsAt: true } } },
  })

  if (!registration || registration.userId !== session.user.id) {
    return { success: false, error: 'Không tìm thấy đăng ký của bạn' }
  }
  if (registration.status !== 'ACTIVE') return { success: false, error: 'Đăng ký không còn hiệu lực' }
  if (!canNerdNightReceivePayment(registration.event)) {
    return { success: false, error: 'Đêm này không còn nhận thanh toán' }
  }
  if (registration.paymentStatus === 'CONFIRMED') return { success: true }
  if (registration.paymentStatus !== 'UNPAID') {
    return { success: false, error: 'Giao dịch đã được báo và đang chờ xác nhận' }
  }
  if (
    registration.paymentStatus === 'UNPAID' &&
    registration.paymentExpiresAt &&
    registration.paymentExpiresAt <= new Date()
  ) {
    await prisma.nerdNightRegistration.update({
      where: { id: registration.id },
      data: { status: 'EXPIRED' },
    })
    revalidatePath(`/nerd-night/${registration.event.slug}`)
    return { success: false, error: 'Thời gian giữ chỗ đã hết. Vui lòng đăng ký lại.' }
  }

  await prisma.nerdNightRegistration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: 'PENDING',
      paymentReportedAt: new Date(),
      paymentExpiresAt: addMinutes(new Date(), NERD_NIGHT_PAYMENT_HOLD_MINUTES),
    },
  })

  revalidatePath(`/nerd-night/${registration.event.slug}`)
  revalidatePath('/profile/nerd-night')
  revalidatePath('/admin/nerd-night')
  return { success: true }
}

export async function payNerdNightWithWallet(
  registrationId: string,
): Promise<ActionResult<{ currentBalance: number }>> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập để thanh toán bằng Ví Nerd' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { slug: true, status: true, startsAt: true } } },
  })
  if (!registration || registration.userId !== session.user.id) {
    return { success: false, error: 'Không tìm thấy đăng ký của bạn' }
  }

  const walletAccount = await ensureUserWalletAccount(session.user.id)
  if (!walletAccount.success) return { success: false, error: walletAccount.message }

  if (registration.paymentStatus === 'CONFIRMED') {
    return {
      success: true,
      data: { currentBalance: walletAccount.wallet.balance },
      message: 'Vé đã được thanh toán',
    }
  }
  if (registration.status !== 'ACTIVE') {
    return { success: false, error: 'Đăng ký không còn hiệu lực' }
  }
  if (!canNerdNightReceivePayment(registration.event)) {
    return { success: false, error: 'Đêm này không còn nhận thanh toán' }
  }
  if (isNerdNightPaymentExpired(registration)) {
    await prisma.nerdNightRegistration.update({
      where: { id: registration.id },
      data: { status: 'EXPIRED' },
    })
    revalidatePath(`/nerd-night/${registration.event.slug}`)
    return { success: false, error: 'Thời gian giữ chỗ đã hết. Vui lòng đăng ký lại.' }
  }
  if (hasNerdNightPaymentEvidence(registration)) {
    return { success: false, error: 'Đăng ký đã có giao dịch đang được xử lý' }
  }

  const amount = Math.round(registration.amount)
  if (amount < 0) return { success: false, error: 'Số tiền thanh toán không hợp lệ' }
  if (walletAccount.wallet.balance < amount) {
    return {
      success: false,
      error: `Số dư Ví Nerd không đủ. Cần ${amount.toLocaleString('vi-VN')}đ, hiện có ${walletAccount.wallet.balance.toLocaleString('vi-VN')}đ.`,
    }
  }

  try {
    const result = await withSerializableRetry(async (tx) => {
      const current = await tx.nerdNightRegistration.findUnique({
        where: { id: registration.id },
        include: { event: { select: { slug: true, status: true, startsAt: true } } },
      })
      if (!current || current.userId !== session.user.id) throw new Error('REGISTRATION_NOT_FOUND')

      if (current.paymentStatus === 'CONFIRMED') {
        const wallet = await tx.wallet.findUnique({ where: { id: walletAccount.wallet.id }, select: { balance: true } })
        return { currentBalance: wallet?.balance ?? walletAccount.wallet.balance }
      }
      if (current.status !== 'ACTIVE') throw new Error('REGISTRATION_INACTIVE')
      if (!canNerdNightReceivePayment(current.event)) throw new Error('PAYMENT_CLOSED')
      if (isNerdNightPaymentExpired(current)) throw new Error('PAYMENT_EXPIRED')
      if (hasNerdNightPaymentEvidence(current)) throw new Error('PAYMENT_ALREADY_RECORDED')

      const paidAt = new Date()
      let currentBalance = walletAccount.wallet.balance
      let paymentTransactionId: string | null = null

      if (current.amount > 0) {
        const externalTransactionId = getNerdNightWalletPaymentExternalId(current)
        const walletResult = await applyWalletTransactionInTx(tx, {
          walletId: walletAccount.wallet.id,
          type: 'DEBIT',
          amount: -current.amount,
          source: 'SYSTEM',
          referenceType: 'nerd_night_registration',
          referenceId: current.id,
          externalTransactionId,
          description: `Thanh toán Nerd Night ${current.registrationCode}`,
        })
        currentBalance = walletResult.balanceAfter
        paymentTransactionId = externalTransactionId
      }

      await tx.nerdNightRegistration.update({
        where: { id: current.id },
        data: {
          paymentStatus: 'CONFIRMED',
          paymentReportedAt: paidAt,
          paymentConfirmedAt: paidAt,
          paymentConfirmedById: null,
          paymentTransactionId,
          paymentReceivedAmount: current.amount,
          paymentExpiresAt: null,
          refundStatus: 'NOT_REQUIRED',
        },
      })

      return { currentBalance }
    })

    revalidatePath('/nerd-night')
    revalidatePath(`/nerd-night/${registration.event.slug}`)
    revalidatePath('/profile/nerd-night')
    revalidatePath('/profile/wallet')
    revalidatePath('/admin/nerd-night')
    revalidatePath(`/admin/nerd-night/${registration.eventId}`)
    return {
      success: true,
      data: result,
      message: amount === 0 ? 'Đã xác nhận vé miễn phí' : 'Thanh toán bằng Ví Nerd thành công',
    }
  } catch (error) {
    const latest = await prisma.nerdNightRegistration.findUnique({
      where: { id: registration.id },
      select: { paymentStatus: true },
    })
    if (latest?.paymentStatus === 'CONFIRMED') {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletAccount.wallet.id },
        select: { balance: true },
      })
      return {
        success: true,
        data: { currentBalance: wallet?.balance ?? walletAccount.wallet.balance },
        message: 'Vé đã được thanh toán',
      }
    }

    const code = error instanceof Error ? error.message : ''
    const messages: Record<string, string> = {
      REGISTRATION_NOT_FOUND: 'Không tìm thấy đăng ký của bạn',
      REGISTRATION_INACTIVE: 'Đăng ký không còn hiệu lực',
      PAYMENT_CLOSED: 'Đêm này không còn nhận thanh toán',
      PAYMENT_EXPIRED: 'Thời gian giữ chỗ đã hết. Vui lòng đăng ký lại.',
      PAYMENT_ALREADY_RECORDED: 'Đăng ký đã có giao dịch đang được xử lý',
      'Số dư ví không đủ': 'Số dư Ví Nerd không đủ để thanh toán vé này',
    }
    if (messages[code]) return { success: false, error: messages[code] }
    console.error('[NerdNight] wallet payment failed:', error)
    return { success: false, error: 'Không thể thanh toán bằng Ví Nerd lúc này' }
  }
}

export async function cancelNerdNightRegistration(registrationId: string): Promise<ActionResult> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { slug: true, startsAt: true, status: true } } },
  })

  if (!registration || registration.userId !== session.user.id) {
    return { success: false, error: 'Không tìm thấy đăng ký của bạn' }
  }
  if (registration.status !== 'ACTIVE') return { success: true }
  if (registration.paymentStatus === 'CONFIRMED') {
    return { success: false, error: 'Vé đã xác nhận; vui lòng liên hệ Nerd Society để được hỗ trợ' }
  }
  if (!canNerdNightReceivePayment(registration.event)) {
    return { success: false, error: 'Không thể tự hủy đăng ký sau khi đêm đã bắt đầu hoặc kết thúc' }
  }
  const hasPaymentEvidence = hasNerdNightPaymentEvidence(registration)

  await prisma.nerdNightRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Người tham dự tự huỷ',
      refundStatus: hasPaymentEvidence ? 'PENDING' : 'NOT_REQUIRED',
    },
  })

  revalidatePath(`/nerd-night/${registration.event.slug}`)
  revalidatePath('/nerd-night')
  revalidatePath('/profile/nerd-night')
  return {
    success: true,
    message:
      hasPaymentEvidence
        ? 'Đã huỷ chỗ. Nerd Society sẽ liên hệ để xử lý khoản chuyển tiền của bạn.'
        : 'Đã huỷ đăng ký.',
  }
}

export async function submitNerdNightReview(
  rawInput: z.input<typeof reviewSchema>,
): Promise<ActionResult> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập' }

  const parsed = reviewSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: 'Đánh giá chưa hợp lệ' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: {
      eventId_userId: { eventId: parsed.data.eventId, userId: session.user.id },
    },
    include: { event: { select: { status: true, slug: true } } },
  })

  if (
    !registration ||
    registration.status !== 'ACTIVE' ||
    registration.paymentStatus !== 'CONFIRMED' ||
    registration.event.status !== 'COMPLETED'
  ) {
    return { success: false, error: 'Feedback chỉ mở cho người đã được xác nhận tham dự' }
  }

  await prisma.nerdNightReview.upsert({
    where: { eventId_userId: { eventId: parsed.data.eventId, userId: session.user.id } },
    update: { rating: parsed.data.rating, comment: parsed.data.comment || null },
    create: {
      eventId: parsed.data.eventId,
      userId: session.user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
  })

  revalidatePath(`/nerd-night/${registration.event.slug}`)
  return { success: true }
}

export async function voteForNerdNightSpeaker(
  eventId: string,
  speakerRegistrationId: string,
): Promise<ActionResult> {
  const session = await requireUser()
  if (!session) return { success: false, error: 'Vui lòng đăng nhập' }

  try {
    await withSerializableRetry(async (tx) => {
      const event = await tx.nerdNightEvent.findUnique({ where: { id: eventId } })
      if (
        !event ||
        !canOpenNerdNightVoting(event) ||
        event.votingStatus !== 'OPEN'
      ) {
        throw new Error('VOTING_CLOSED')
      }

      const [voterRegistration, speaker] = await Promise.all([
        tx.nerdNightRegistration.findUnique({
          where: { eventId_userId: { eventId, userId: session.user.id } },
        }),
        tx.nerdNightRegistration.findUnique({ where: { id: speakerRegistrationId } }),
      ])

      if (
        !voterRegistration ||
        voterRegistration.status !== 'ACTIVE' ||
        voterRegistration.paymentStatus !== 'CONFIRMED'
      ) {
        throw new Error('NOT_ELIGIBLE')
      }
      if (
        !speaker ||
        speaker.eventId !== eventId ||
        speaker.status !== 'ACTIVE' ||
        speaker.paymentStatus !== 'CONFIRMED' ||
        speaker.speakerStatus !== 'APPROVED'
      ) {
        throw new Error('INVALID_SPEAKER')
      }

      await tx.nerdNightVote.create({
        data: { eventId, voterId: session.user.id, speakerRegistrationId },
      })
    })

    revalidatePath('/nerd-night')
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Bạn đã vote cho đêm này rồi' }
    }
    const code = error instanceof Error ? error.message : ''
    if (code === 'VOTING_CLOSED') return { success: false, error: 'Vote chưa mở hoặc đã đóng' }
    if (code === 'NOT_ELIGIBLE') return { success: false, error: 'Chỉ vé đã xác nhận mới được vote' }
    if (code === 'INVALID_SPEAKER') return { success: false, error: 'Speaker không hợp lệ' }
    console.error('[NerdNight] vote failed:', error)
    return { success: false, error: 'Chưa thể gửi vote' }
  }
}
