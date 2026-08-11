'use server'

import { audit } from '@/lib/audit'
import { checkApiPermission } from '@/lib/apiPermissions'
import {
  isNerdNightThemeCode,
  NERD_NIGHT_DEFAULT_THEORY_EXAMPLES,
  NERD_NIGHT_DEFAULT_TOPIC_PROMPT,
  NERD_NIGHT_PAYMENT_HOLD_MINUTES,
  NERD_NIGHT_THEMES,
} from '@/lib/nerd-night/constants'
import { prisma } from '@/lib/prisma'
import {
  canNerdNightReceivePayment,
  canOpenNerdNightVoting,
  hasNerdNightPaymentEvidence,
} from '@/lib/nerd-night/registration-state'
import { isVietQRConfigured } from '@/lib/vietqr'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { applyWalletTransactionInTx } from '@/lib/wallet-ledger'
import { addMinutes } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const eventSchema = z.object({
  id: z.string().optional(),
  season: z.number().int().min(1).max(99),
  episode: z.number().int().min(1).max(99),
  themeCode: z.string().trim().min(1).max(30),
  title: z.string().trim().max(160).optional(),
  themeDescription: z.string().trim().max(1200).optional(),
  topicPrompt: z.string().trim().max(240).optional(),
  topicSuggestions: z.array(z.string().trim().min(1).max(180)).max(12).optional(),
  startsAt: z.string().datetime(),
  locationId: z.string().nullable().optional(),
  venueName: z.string().trim().min(2).max(160),
  venueAddress: z.string().trim().max(300).optional(),
  price: z.number().int().min(0).max(100_000_000),
  capacity: z.number().int().min(1).max(1000),
  speakerCapacity: z.number().int().min(0).max(100),
  registrationOpen: z.boolean(),
  speakerRegistrationOpen: z.boolean(),
  notes: z.string().trim().max(3000).optional(),
})

type AdminResult<T = undefined> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string }

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function requirePermission(permission: 'canViewNerdNight' | 'canManageNerdNight' | 'canConfirmNerdNightPayments') {
  const result = await checkApiPermission(permission)
  return result.session && result.hasAccess ? result.session : null
}

function revalidateNerdNight(slug?: string) {
  revalidatePath('/nerd-night')
  revalidatePath('/profile/nerd-night')
  revalidatePath('/admin/nerd-night')
  if (slug) revalidatePath(`/nerd-night/${slug}`)
}

function getNerdNightRefundExternalId(registration: {
  id: string
  paymentTransactionId: string | null
  paymentConfirmedAt: Date | null
  paymentReportedAt: Date | null
  updatedAt: Date
}) {
  const paymentAttempt = registration.paymentTransactionId
    || registration.paymentConfirmedAt?.getTime()
    || registration.paymentReportedAt?.getTime()
    || registration.updatedAt.getTime()
  return `REFUND-NERD-NIGHT-${registration.id}-${paymentAttempt}`
}

export async function saveNerdNightEvent(rawInput: z.input<typeof eventSchema>): Promise<AdminResult<{ id: string }>> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền quản lý Nerd Night' }

  const parsed = eventSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Dữ liệu chưa hợp lệ' }
  if (parsed.data.speakerCapacity > parsed.data.capacity) {
    return { success: false, error: 'Số suất chia sẻ không thể lớn hơn tổng số chỗ' }
  }

  try {
    const theme = isNerdNightThemeCode(parsed.data.themeCode)
      ? NERD_NIGHT_THEMES[parsed.data.themeCode]
      : null
    const title = parsed.data.title || `Đêm ${String(parsed.data.episode).padStart(2, '0')} — ${parsed.data.themeCode}`
    const baseSlug = `season-${parsed.data.season}-${slugify(title)}`
    const values = {
      season: parsed.data.season,
      episode: parsed.data.episode,
      themeCode: parsed.data.themeCode.toUpperCase(),
      title,
      themeDescription: parsed.data.themeDescription || theme?.description || null,
      topicPrompt: parsed.data.topicPrompt || NERD_NIGHT_DEFAULT_TOPIC_PROMPT,
      topicSuggestions: parsed.data.topicSuggestions ?? (
        parsed.data.themeCode.toUpperCase() === 'THEORY'
          ? [...NERD_NIGHT_DEFAULT_THEORY_EXAMPLES]
          : theme?.suggestions || []
      ),
      startsAt: new Date(parsed.data.startsAt),
      locationId: parsed.data.locationId || null,
      venueName: parsed.data.venueName,
      venueAddress: parsed.data.venueAddress || null,
      price: parsed.data.price,
      capacity: parsed.data.capacity,
      speakerCapacity: parsed.data.speakerCapacity,
      registrationOpen: parsed.data.registrationOpen,
      speakerRegistrationOpen: parsed.data.speakerRegistrationOpen,
      notes: parsed.data.notes || null,
    }

    let event
    if (parsed.data.id) {
      const now = new Date()
      const stalePendingBefore = addMinutes(now, -NERD_NIGHT_PAYMENT_HOLD_MINUTES)
      await prisma.nerdNightRegistration.updateMany({
        where: {
          eventId: parsed.data.id,
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
      const current = await prisma.nerdNightEvent.findUnique({
        where: { id: parsed.data.id },
        include: {
          registrations: {
            where: { status: 'ACTIVE' },
            select: { wantsToShare: true },
          },
        },
      })
      if (!current) return { success: false, error: 'Không tìm thấy sự kiện' }
      if (parsed.data.capacity < current.registrations.length) {
        return { success: false, error: 'Sức chứa mới nhỏ hơn số người đang giữ chỗ' }
      }
      const activeSpeakers = current.registrations.filter((item) => item.wantsToShare).length
      const activeListeners = current.registrations.length - activeSpeakers
      if (parsed.data.speakerCapacity < activeSpeakers) {
        return { success: false, error: 'Số slot speaker mới nhỏ hơn số đăng ký speaker đang giữ chỗ' }
      }
      if (parsed.data.capacity - parsed.data.speakerCapacity < activeListeners) {
        return { success: false, error: 'Số chỗ người nghe mới nhỏ hơn số người nghe đang giữ chỗ' }
      }
      event = await prisma.nerdNightEvent.update({ where: { id: current.id }, data: values })
      await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-event', event.id, values)
    } else {
      event = await prisma.nerdNightEvent.create({
        data: { ...values, slug: baseSlug, createdById: session.user.id },
      })
      await audit.create(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-event', event.id, values)
    }

    revalidateNerdNight(event.slug)
    return { success: true, data: { id: event.id } }
  } catch (error) {
    console.error('[NerdNightAdmin] save event failed:', error)
    return { success: false, error: 'Không thể lưu sự kiện. Kiểm tra số season/đêm có bị trùng.' }
  }
}

export async function setNerdNightEventStatus(
  eventId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED',
): Promise<AdminResult> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền' }

  const event = await prisma.nerdNightEvent.findUnique({ where: { id: eventId } })
  if (!event) return { success: false, error: 'Không tìm thấy sự kiện' }

  if (status === 'PUBLISHED') {
    if (!isVietQRConfigured()) {
      return { success: false, error: 'VietQR dùng chung của hệ thống chưa được cấu hình trên server' }
    }
  }

  const reopening = status === 'PUBLISHED' && event.status !== 'PUBLISHED'
  const canOpenRegistration = status === 'PUBLISHED' && event.startsAt > new Date()
  const votingStatus = status === 'COMPLETED'
    ? 'RESULTS'
    : status === 'PUBLISHED'
      ? reopening ? 'CLOSED' : event.votingStatus
      : 'CLOSED'

  const updated = await prisma.$transaction(async (tx) => {
    const savedEvent = await tx.nerdNightEvent.update({
      where: { id: event.id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : status === 'PUBLISHED' ? null : event.completedAt,
        registrationOpen: canOpenRegistration ? (reopening || event.registrationOpen) : false,
        speakerRegistrationOpen: canOpenRegistration
          ? ((reopening && event.speakerCapacity > 0) || event.speakerRegistrationOpen)
          : false,
        votingStatus,
      },
    })

    if (status === 'CANCELLED') {
      await tx.nerdNightRegistration.updateMany({
        where: { eventId: event.id, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'Sự kiện đã bị hủy',
        },
      })
      await tx.nerdNightRegistration.updateMany({
        where: {
          eventId: event.id,
          refundStatus: { not: 'COMPLETED' },
          OR: [
            { paymentStatus: 'CONFIRMED' },
            { paymentTransactionId: { not: null } },
            { paymentReceivedAmount: { gt: 0 } },
          ],
        },
        data: { refundStatus: 'PENDING' },
      })
    }

    return savedEvent
  })

  await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-event', event.id, {
    from: event.status,
    to: status,
  })
  revalidateNerdNight(updated.slug)
  return { success: true }
}

export async function setNerdNightVotingStatus(
  eventId: string,
  votingStatus: 'CLOSED' | 'OPEN' | 'RESULTS',
): Promise<AdminResult> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền' }

  const current = await prisma.nerdNightEvent.findUnique({ where: { id: eventId } })
  if (!current) return { success: false, error: 'Không tìm thấy đêm Nerd Night' }
  if (votingStatus === 'OPEN' && !canOpenNerdNightVoting(current)) {
    return { success: false, error: 'Chỉ có thể mở vote khi đêm đang diễn ra' }
  }
  if (
    votingStatus === 'RESULTS' &&
    current.status !== 'COMPLETED' &&
    !canOpenNerdNightVoting(current)
  ) {
    return { success: false, error: 'Chỉ có thể công bố kết quả sau khi đêm bắt đầu' }
  }

  const event = await prisma.nerdNightEvent.update({ where: { id: eventId }, data: { votingStatus } })
  await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-voting', eventId, {
    votingStatus,
  })
  revalidateNerdNight(event.slug)
  return { success: true }
}

export async function resetNerdNightVotes(eventId: string): Promise<AdminResult<{ count: number }>> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền quản lý vote Nerd Night' }

  const event = await prisma.nerdNightEvent.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, title: true, _count: { select: { votes: true } } },
  })
  if (!event) return { success: false, error: 'Không tìm thấy đêm Nerd Night' }
  if (event._count.votes === 0) return { success: true, data: { count: 0 } }

  const result = await prisma.nerdNightVote.deleteMany({ where: { eventId: event.id } })
  await audit.delete(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-votes', event.id, {
    eventTitle: event.title,
    removedVotes: result.count,
  })
  revalidateNerdNight(event.slug)
  revalidatePath(`/admin/nerd-night/${event.id}`)
  return { success: true, data: { count: result.count } }
}

export async function deleteNerdNightEvent(eventId: string): Promise<AdminResult> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền xóa đêm Nerd Night' }

  const event = await prisma.nerdNightEvent.findUnique({
    where: { id: eventId },
    include: {
      registrations: {
        select: {
          paymentStatus: true,
          refundStatus: true,
          paymentTransactionId: true,
          paymentReceivedAmount: true,
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Không tìm thấy đêm Nerd Night' }

  const hasFinancialRecords = event.registrations.some(
    (registration) =>
      registration.paymentStatus === 'CONFIRMED' ||
      registration.refundStatus !== 'NOT_REQUIRED' ||
      Boolean(registration.paymentTransactionId) ||
      (registration.paymentReceivedAmount || 0) > 0,
  )
  if (hasFinancialRecords) {
    return {
      success: false,
      error: 'Không thể xóa đêm đã có giao dịch. Hãy hủy sự kiện và xử lý hoàn tiền để giữ lịch sử đối soát.',
    }
  }

  await prisma.nerdNightEvent.delete({ where: { id: event.id } })
  await audit.delete(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-event', event.id, {
    title: event.title,
    season: event.season,
    episode: event.episode,
    removedRegistrations: event.registrations.length,
  })
  revalidateNerdNight(event.slug)
  return { success: true }
}

export async function deleteNerdNightRegistration(
  registrationId: string,
): Promise<AdminResult<{ refundedAmount: number; newWalletBalance?: number }>> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền xóa slot Nerd Night' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { id: true, slug: true, title: true } } },
  })
  if (!registration) return { success: false, error: 'Không tìm thấy slot đăng ký' }

  const hasPaymentEvidence = hasNerdNightPaymentEvidence(registration)
  const shouldRefund = hasPaymentEvidence && registration.refundStatus !== 'COMPLETED'

  let refundWalletId: string | null = null
  if (shouldRefund) {
    const paymentSession = await requirePermission('canConfirmNerdNightPayments')
    if (!paymentSession) return { success: false, error: 'Bạn không có quyền hoàn tiền vào Ví Nerd' }

    const walletAccount = await ensureUserWalletAccount(registration.userId)
    if (!walletAccount.success) return { success: false, error: walletAccount.message }
    refundWalletId = walletAccount.wallet.id
  }

  let result: { refundedAmount: number; newWalletBalance?: number }
  try {
    result = await prisma.$transaction(async (tx) => {
      const current = await tx.nerdNightRegistration.findUnique({ where: { id: registration.id } })
      if (!current) throw new Error('REGISTRATION_NOT_FOUND')

      const currentHasPaymentEvidence = hasNerdNightPaymentEvidence(current)
      const refundedAmount = currentHasPaymentEvidence && current.refundStatus !== 'COMPLETED'
        ? Math.round(current.paymentReceivedAmount || current.amount)
        : 0
      let newWalletBalance: number | undefined

      if (refundedAmount > 0) {
        if (!refundWalletId) throw new Error('WALLET_REQUIRED')
        const walletResult = await applyWalletTransactionInTx(tx, {
          walletId: refundWalletId,
          type: 'REFUND',
          amount: refundedAmount,
          source: 'SYSTEM',
          referenceType: 'nerd_night_registration',
          referenceId: current.id,
          externalTransactionId: getNerdNightRefundExternalId(current),
          description: `Hoàn tiền Nerd Night ${current.registrationCode} khi xóa đăng ký`,
          createdById: session.user.id,
        })
        newWalletBalance = walletResult.balanceAfter
      }

      await tx.nerdNightRegistration.delete({ where: { id: current.id } })
      return { refundedAmount, newWalletBalance }
    })
  } catch (error) {
    console.error('[deleteNerdNightRegistration] Error:', error)
    return { success: false, error: 'Không thể xóa và xử lý hoàn tiền đăng ký lúc này' }
  }

  await audit.delete(
    session.user.id,
    session.user.name || session.user.email || 'Staff',
    'nerd-night-registration',
    registration.id,
    {
      eventId: registration.event.id,
      eventTitle: registration.event.title,
      registrationCode: registration.registrationCode,
      attendeeName: registration.attendeeName,
      paymentStatus: registration.paymentStatus,
      paymentTransactionId: registration.paymentTransactionId,
      refundedToWallet: result.refundedAmount,
      newWalletBalance: result.newWalletBalance,
    },
  )
  revalidateNerdNight(registration.event.slug)
  revalidatePath(`/admin/nerd-night/${registration.event.id}`)
  revalidatePath('/profile/wallet')
  revalidatePath('/admin/wallets')
  return {
    success: true,
    data: result,
    message: result.refundedAmount > 0
      ? `Đã xóa đăng ký và hoàn ${result.refundedAmount.toLocaleString('vi-VN')}đ vào Ví Nerd`
      : 'Đã xóa đăng ký',
  }
}

export async function deleteRejectedNerdNightSpeaker(
  registrationId: string,
): Promise<AdminResult<{ refundedAmount: number; newWalletBalance?: number }>> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền xóa speaker' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { id: true, slug: true, title: true } } },
  })
  if (!registration) return { success: false, error: 'Không tìm thấy đăng ký speaker' }
  if (registration.speakerStatus !== 'REJECTED') {
    return { success: false, error: 'Chỉ có thể xóa speaker đã bị từ chối' }
  }
  const shouldRefund = hasNerdNightPaymentEvidence(registration) && registration.refundStatus !== 'COMPLETED'
  let refundWalletId: string | null = null
  if (shouldRefund) {
    const paymentSession = await requirePermission('canConfirmNerdNightPayments')
    if (!paymentSession) {
      return { success: false, error: 'Bạn không có quyền hoàn tiền vào Ví Nerd' }
    }
    const walletAccount = await ensureUserWalletAccount(registration.userId)
    if (!walletAccount.success) {
      return { success: false, error: walletAccount.message }
    }
    refundWalletId = walletAccount.wallet.id
  }

  let result: { refundedAmount: number; newWalletBalance?: number }
  try {
    result = await prisma.$transaction(async (tx) => {
      const current = await tx.nerdNightRegistration.findUnique({ where: { id: registration.id } })
      if (!current || current.speakerStatus !== 'REJECTED') throw new Error('INVALID_SPEAKER_STATE')

      const refundedAmount =
        hasNerdNightPaymentEvidence(current) && current.refundStatus !== 'COMPLETED'
          ? Math.round(current.paymentReceivedAmount || current.amount)
          : 0
      let newWalletBalance: number | undefined

      if (refundedAmount > 0) {
        if (!refundWalletId) throw new Error('WALLET_REQUIRED')
        const walletResult = await applyWalletTransactionInTx(tx, {
          walletId: refundWalletId,
          type: 'REFUND',
          amount: refundedAmount,
          source: 'SYSTEM',
          referenceType: 'nerd_night_registration',
          referenceId: current.id,
          externalTransactionId: getNerdNightRefundExternalId(current),
          description: `Hoàn tiền Nerd Night ${current.registrationCode} do speaker bị từ chối`,
          createdById: session.user.id,
        })
        newWalletBalance = walletResult.balanceAfter
      }

      await tx.nerdNightRegistration.delete({ where: { id: current.id } })
      return { refundedAmount, newWalletBalance }
    })
  } catch (error) {
    console.error('[deleteRejectedNerdNightSpeaker] Error:', error)
    const code = error instanceof Error ? error.message : ''
    if (code === 'INVALID_SPEAKER_STATE') return { success: false, error: 'Speaker không còn ở trạng thái bị từ chối' }
    return { success: false, error: 'Không thể xóa và hoàn tiền Speaker lúc này' }
  }

  await audit.delete(
    session.user.id,
    session.user.name || session.user.email || 'Staff',
    'nerd-night-speaker',
    registration.id,
    {
      eventId: registration.event.id,
      eventTitle: registration.event.title,
      registrationCode: registration.registrationCode,
      attendeeName: registration.attendeeName,
      previousTopicTitle: registration.topicTitle,
      refundedToWallet: result.refundedAmount,
      newWalletBalance: result.newWalletBalance,
    },
  )
  revalidateNerdNight(registration.event.slug)
  revalidatePath(`/admin/nerd-night/${registration.event.id}`)
  revalidatePath('/profile/wallet')
  revalidatePath('/admin/wallets')
  return {
    success: true,
    data: result,
    message: result.refundedAmount > 0
      ? `Đã xóa đăng ký và hoàn ${result.refundedAmount.toLocaleString('vi-VN')}đ vào Ví Nerd`
      : 'Đã xóa đăng ký Speaker; người dùng có thể đăng ký lại',
  }
}

export async function reviewNerdNightSpeaker(
  registrationId: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<AdminResult> {
  const session = await requirePermission('canManageNerdNight')
  if (!session) return { success: false, error: 'Bạn không có quyền' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration || !registration.wantsToShare) return { success: false, error: 'Đăng ký speaker không hợp lệ' }
  if (registration.speakerStatus !== 'PENDING') {
    return { success: false, error: 'Chỉ có thể duyệt đăng ký speaker đang chờ' }
  }
  if (registration.status !== 'ACTIVE') {
    return { success: false, error: 'Đăng ký speaker không còn hiệu lực' }
  }
  if (!canNerdNightReceivePayment(registration.event)) {
    return { success: false, error: 'Không thể duyệt speaker sau khi đêm đã bắt đầu hoặc kết thúc' }
  }
  if (
    registration.paymentStatus !== 'CONFIRMED' &&
    registration.paymentExpiresAt &&
    registration.paymentExpiresAt <= new Date() &&
    !hasNerdNightPaymentEvidence(registration)
  ) {
    await prisma.nerdNightRegistration.update({
      where: { id: registration.id },
      data: { status: 'EXPIRED' },
    })
    revalidateNerdNight(registration.event.slug)
    return { success: false, error: 'Đăng ký speaker đã hết thời gian giữ chỗ' }
  }

  await prisma.nerdNightRegistration.update({
    where: { id: registration.id },
    data: { speakerStatus: decision },
  })
  await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-speaker', registration.id, {
    decision,
  })
  revalidateNerdNight(registration.event.slug)
  return { success: true }
}

export async function confirmNerdNightPayment(
  registrationId: string,
  confirmed: boolean,
  reason?: string,
): Promise<AdminResult> {
  const session = await requirePermission('canConfirmNerdNightPayments')
  if (!session) return { success: false, error: 'Bạn không có quyền xác nhận thanh toán' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration) return { success: false, error: 'Không tìm thấy đăng ký' }
  if (registration.status !== 'ACTIVE') {
    return { success: false, error: 'Đăng ký không còn hiệu lực' }
  }
  if (confirmed && registration.event.status !== 'PUBLISHED') {
    return { success: false, error: 'Không thể xác nhận tiền cho sự kiện chưa công khai, đã hoàn thành hoặc đã hủy' }
  }
  if (
    confirmed &&
    registration.paymentExpiresAt &&
    registration.paymentExpiresAt <= new Date() &&
    !hasNerdNightPaymentEvidence(registration)
  ) {
    await prisma.nerdNightRegistration.update({
      where: { id: registration.id },
      data: { status: 'EXPIRED' },
    })
    revalidateNerdNight(registration.event.slug)
    return { success: false, error: 'Thời gian giữ chỗ đã hết; không thể xác nhận thủ công' }
  }

  if (confirmed && registration.paymentStatus !== 'PENDING') {
    return { success: false, error: 'Chỉ có thể xác nhận giao dịch đang chờ' }
  }
  if (!confirmed && registration.paymentStatus !== 'CONFIRMED') {
    return { success: false, error: 'Giao dịch chưa được xác nhận' }
  }
  if (!confirmed && registration.paymentTransactionId) {
    return { success: false, error: 'Thanh toán VietQR tự động không thể bỏ xác nhận thủ công' }
  }
  if (!confirmed && (!reason || reason.trim().length < 3)) {
    return { success: false, error: 'Cần nhập lý do bỏ xác nhận' }
  }

  await prisma.nerdNightRegistration.update({
    where: { id: registration.id },
    data: confirmed
      ? {
          paymentStatus: 'CONFIRMED',
          paymentConfirmedAt: new Date(),
          paymentConfirmedById: session.user.id,
          paymentExpiresAt: null,
        }
      : {
          paymentStatus: 'PENDING',
          paymentConfirmedAt: null,
          paymentConfirmedById: null,
          paymentExpiresAt: addMinutes(new Date(), NERD_NIGHT_PAYMENT_HOLD_MINUTES),
        },
  })

  await audit.confirmPayment(
    session.user.id,
    session.user.name || session.user.email || 'Staff',
    registration.id,
    { module: 'nerd-night', confirmed, reason },
  )
  revalidateNerdNight(registration.event.slug)
  return { success: true }
}

export async function completeNerdNightRefund(
  registrationId: string,
): Promise<AdminResult<{ refundedAmount: number; newWalletBalance: number }>> {
  const session = await requirePermission('canConfirmNerdNightPayments')
  if (!session) return { success: false, error: 'Bạn không có quyền' }

  const registration = await prisma.nerdNightRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration) return { success: false, error: 'Không tìm thấy đăng ký' }
  if (registration.refundStatus !== 'PENDING') {
    return { success: false, error: 'Đăng ký không có khoản hoàn tiền đang chờ xử lý' }
  }
  const hasPaymentEvidence = hasNerdNightPaymentEvidence(registration)
  if (!hasPaymentEvidence) {
    return { success: false, error: 'Chưa có bằng chứng đã nhận tiền để hoàn vào Ví Nerd' }
  }

  const walletAccount = await ensureUserWalletAccount(registration.userId)
  if (!walletAccount.success) return { success: false, error: walletAccount.message }

  let result: { refundedAmount: number; newWalletBalance: number }
  try {
    result = await prisma.$transaction(async (tx) => {
      const current = await tx.nerdNightRegistration.findUnique({ where: { id: registration.id } })
      if (!current || current.refundStatus !== 'PENDING') throw new Error('INVALID_REFUND_STATE')

      const currentHasPaymentEvidence = hasNerdNightPaymentEvidence(current)
      if (!currentHasPaymentEvidence) throw new Error('PAYMENT_NOT_RECORDED')

      const refundedAmount = Math.round(current.paymentReceivedAmount || current.amount)
      const walletResult = await applyWalletTransactionInTx(tx, {
        walletId: walletAccount.wallet.id,
        type: 'REFUND',
        amount: refundedAmount,
        source: 'SYSTEM',
        referenceType: 'nerd_night_registration',
        referenceId: current.id,
        externalTransactionId: getNerdNightRefundExternalId(current),
        description: `Hoàn tiền Nerd Night ${current.registrationCode}`,
        createdById: session.user.id,
      })

      await tx.nerdNightRegistration.update({
        where: { id: current.id },
        data: { refundStatus: 'COMPLETED' },
      })

      return { refundedAmount, newWalletBalance: walletResult.balanceAfter }
    })
  } catch (error) {
    console.error('[completeNerdNightRefund] Error:', error)
    return { success: false, error: 'Không thể hoàn tiền vào Ví Nerd lúc này' }
  }

  await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-refund', registration.id, {
    status: 'COMPLETED',
    refundedToWallet: result.refundedAmount,
    newWalletBalance: result.newWalletBalance,
  })
  revalidateNerdNight(registration.event.slug)
  revalidatePath('/profile/wallet')
  revalidatePath('/admin/wallets')
  return {
    success: true,
    data: result,
    message: `Đã hoàn ${result.refundedAmount.toLocaleString('vi-VN')}đ vào Ví Nerd`,
  }
}
