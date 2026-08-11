'use server'

import { audit } from '@/lib/audit'
import { checkApiPermission } from '@/lib/apiPermissions'
import {
  isNerdNightThemeCode,
  NERD_NIGHT_DEFAULT_THEORY_EXAMPLES,
  NERD_NIGHT_DEFAULT_TOPIC_PROMPT,
  NERD_NIGHT_THEMES,
} from '@/lib/nerd-night/constants'
import { prisma } from '@/lib/prisma'
import { isVietQRConfigured } from '@/lib/vietqr'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { applyWalletTransactionInTx } from '@/lib/wallet-ledger'
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
      await prisma.nerdNightRegistration.updateMany({
        where: {
          eventId: parsed.data.id,
          status: 'ACTIVE',
          paymentStatus: 'UNPAID',
          paymentExpiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      })
      const current = await prisma.nerdNightEvent.findUnique({
        where: { id: parsed.data.id },
        include: { _count: { select: { registrations: { where: { status: 'ACTIVE' } } } } },
      })
      if (!current) return { success: false, error: 'Không tìm thấy sự kiện' }
      if (parsed.data.capacity < current._count.registrations) {
        return { success: false, error: 'Sức chứa mới nhỏ hơn số người đang giữ chỗ' }
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

  const updated = await prisma.nerdNightEvent.update({
    where: { id: event.id },
    data: {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : status === 'PUBLISHED' ? null : event.completedAt,
      registrationOpen: status === 'PUBLISHED' ? event.registrationOpen : false,
      speakerRegistrationOpen: status === 'PUBLISHED' ? event.speakerRegistrationOpen : false,
      votingStatus: status === 'CANCELLED' ? 'CLOSED' : event.votingStatus,
    },
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
        select: { paymentStatus: true, refundStatus: true, paymentTransactionId: true },
      },
    },
  })
  if (!event) return { success: false, error: 'Không tìm thấy đêm Nerd Night' }

  const hasFinancialRecords = event.registrations.some(
    (registration) =>
      registration.paymentStatus !== 'UNPAID' ||
      registration.refundStatus === 'PENDING' ||
      Boolean(registration.paymentTransactionId),
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

  const hasPaymentEvidence =
    registration.paymentStatus === 'CONFIRMED' ||
    Boolean(registration.paymentTransactionId) ||
    (registration.paymentReceivedAmount || 0) > 0
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

      const currentHasPaymentEvidence =
        current.paymentStatus === 'CONFIRMED' ||
        Boolean(current.paymentTransactionId) ||
        (current.paymentReceivedAmount || 0) > 0
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
          externalTransactionId: `REFUND-NERD-NIGHT-${current.id}`,
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
  const shouldRefund = (
    registration.paymentStatus === 'CONFIRMED' ||
    Boolean(registration.paymentTransactionId) ||
    (registration.paymentReceivedAmount || 0) > 0
  ) && registration.refundStatus !== 'COMPLETED'
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
        (
          current.paymentStatus === 'CONFIRMED' ||
          Boolean(current.paymentTransactionId) ||
          (current.paymentReceivedAmount || 0) > 0
        ) && current.refundStatus !== 'COMPLETED'
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
          externalTransactionId: `REFUND-NERD-NIGHT-${current.id}`,
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

  await prisma.nerdNightRegistration.update({
    where: { id: registration.id },
    data: { speakerStatus: decision, wantsToShare: decision === 'APPROVED' },
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

  if (confirmed && registration.paymentStatus !== 'PENDING') {
    return { success: false, error: 'Chỉ có thể xác nhận giao dịch đang chờ' }
  }
  if (!confirmed && registration.paymentStatus !== 'CONFIRMED') {
    return { success: false, error: 'Giao dịch chưa được xác nhận' }
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
        }
      : {
          paymentStatus: 'PENDING',
          paymentConfirmedAt: null,
          paymentConfirmedById: null,
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

export async function completeNerdNightRefund(registrationId: string): Promise<AdminResult> {
  const session = await requirePermission('canConfirmNerdNightPayments')
  if (!session) return { success: false, error: 'Bạn không có quyền' }

  const registration = await prisma.nerdNightRegistration.update({
    where: { id: registrationId },
    data: { refundStatus: 'COMPLETED' },
    include: { event: true },
  })
  await audit.update(session.user.id, session.user.name || session.user.email || 'Staff', 'nerd-night-refund', registration.id, {
    status: 'COMPLETED',
  })
  revalidateNerdNight(registration.event.slug)
  return { success: true }
}
