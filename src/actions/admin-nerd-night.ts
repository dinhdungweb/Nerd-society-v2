'use server'

import { audit } from '@/lib/audit'
import { checkApiPermission } from '@/lib/apiPermissions'
import { isNerdNightThemeCode, NERD_NIGHT_THEMES } from '@/lib/nerd-night/constants'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const eventSchema = z.object({
  id: z.string().optional(),
  season: z.number().int().min(1).max(99),
  episode: z.number().int().min(1).max(99),
  themeCode: z.string().trim().min(1).max(30),
  title: z.string().trim().max(160).optional(),
  themeDescription: z.string().trim().max(1200).optional(),
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

const configSchema = z.object({
  bankCode: z.string().trim().min(2).max(20),
  accountNumber: z.string().trim().min(4).max(30),
  accountName: z.string().trim().min(2).max(120),
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
      topicSuggestions: theme?.suggestions || [],
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
    const config = await prisma.nerdNightPaymentConfig.findUnique({ where: { id: 'default' } })
    const hasEnvConfig = Boolean(
      process.env.VIETQR_BANK_CODE && process.env.VIETQR_ACCOUNT_NUMBER && process.env.VIETQR_ACCOUNT_NAME,
    )
    if (!config && !hasEnvConfig) {
      return { success: false, error: 'Hãy cấu hình tài khoản VietQR trước khi công khai sự kiện' }
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

export async function saveNerdNightPaymentConfig(
  rawInput: z.input<typeof configSchema>,
): Promise<AdminResult> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return { success: false, error: 'Chỉ Admin được thay đổi tài khoản nhận tiền' }
  }

  const parsed = configSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: 'Thông tin tài khoản chưa hợp lệ' }

  await prisma.nerdNightPaymentConfig.upsert({
    where: { id: 'default' },
    update: { ...parsed.data, updatedById: session.user.id },
    create: { id: 'default', ...parsed.data, updatedById: session.user.id },
  })
  await audit.update(session.user.id, session.user.name || session.user.email || 'Admin', 'nerd-night-payment-config', 'default', {
    bankCode: parsed.data.bankCode,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName,
  })
  revalidatePath('/admin/nerd-night/settings')
  return { success: true }
}
