import { getRolePermissions } from '@/lib/apiPermissions'
import { getStaffSession } from '@/lib/authHelpers'
import { prisma } from '@/lib/prisma'
import { businessDateOnly } from '@/lib/subscription/date-utils'
import type { PlanType, Prisma, SubscriberStatus, SubscriptionStatus } from '@prisma/client'
import { NextResponse } from 'next/server'

const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Gói tuần Limited — 15 giờ trong 7 ngày',
  MONTHLY_LIMITED: 'Gói tháng Limited — tối đa 8 giờ mỗi ngày trong 30 ngày',
  MONTHLY_UNLIMITED: 'Gói tháng Unlimited — tối đa 8 giờ mỗi ngày trong 30 ngày',
}

const SUBSCRIBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hồ sơ hội viên đang hoạt động',
  EXPIRED: 'Hồ sơ hội viên đã hết hiệu lực',
  SUSPENDED: 'Hồ sơ hội viên đang bị tạm khóa',
}

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Gói đang chờ thanh toán',
  PENDING_ACTIVATION: 'Đã thanh toán, đang chờ kích hoạt',
  ACTIVE: 'Gói đang hoạt động',
  EXPIRED: 'Gói đã hết hạn',
  CANCELLED: 'Gói đã bị hủy',
  RENEWED: 'Gói cũ đã được gia hạn hoặc gộp vào gói hiện tại',
}

const QR_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'QR đang hoạt động và có thể check-in',
  REVOKED: 'QR đã bị khóa hoặc thu hồi',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WALLET: 'Thanh toán bằng Ví Nerd',
  ONLINE: 'Chuyển khoản VietQR tự động',
  VIETQR: 'Chuyển khoản VietQR tự động',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  CASH: 'Thanh toán tiền mặt tại quầy',
  ADMIN: 'Nhân viên xác nhận thanh toán',
}

const HEADERS = [
  'STT',
  'Họ và tên hội viên',
  'Số điện thoại hội viên',
  'Email hội viên',
  'Cơ sở đăng ký',
  'Trạng thái hội viên',
  'Trạng thái QR thành viên',
  'Gói hiện tại',
  'Trạng thái gói',
  'Ngày bắt đầu sử dụng',
  'Ngày cuối cùng được sử dụng',
  'Thời hạn còn lại',
  'Giá gói đã thanh toán (VNĐ)',
  'Ngày thanh toán hoặc mua gói',
  'Phương thức thanh toán',
  'Tổng định mức',
  'Thời lượng đã sử dụng',
  'Định mức còn lại',
  'Giới hạn mỗi ngày',
  'Số dư Ví Nerd (VNĐ)',
  'Công nợ (VNĐ)',
  'Tổng số phiên check-in',
  'Lần check-in gần nhất',
] as const

function readableLabel(labels: Record<string, string>, value?: string | null, empty = 'Chưa ghi nhận') {
  if (!value) return empty
  return labels[value.toUpperCase()] || value.replaceAll('_', ' ').toLocaleLowerCase('vi-VN')
}

function branchLabel(value?: string | null) {
  if (value === 'HTM') return 'Hồ Tùng Mậu (HTM)'
  if (value === 'TS') return 'Tây Sơn (TS)'
  return value || 'Chưa chọn cơ sở'
}

function formatDate(value?: Date | null, includeTime = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : {}),
  }).format(value)
}

function formatMinutes(value?: number | null) {
  if (value === null || value === undefined) return ''
  const minutes = Math.max(0, Math.round(value))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${remainingMinutes} phút`
  if (!remainingMinutes) return `${hours} giờ`
  return `${hours} giờ ${remainingMinutes} phút`
}

function remainingDuration(endDate?: Date | null) {
  if (!endDate) return ''
  const today = businessDateOnly()
  const difference = Math.floor((endDate.getTime() - today.getTime()) / 86_400_000)
  if (difference >= 0) return `${difference + 1} ngày, bao gồm hôm nay`
  return `Đã quá hạn ${Math.abs(difference)} ngày`
}

function csvCell(value: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  let text = String(value ?? '')
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function buildSubscriberWhere(searchParams: URLSearchParams) {
  const where: Prisma.SubscriberWhereInput = {}
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')
  const branch = searchParams.get('branch')
  const planType = searchParams.get('planType')
  const subscriptionStatus = searchParams.get('subscriptionStatus')
  const subscriberStatuses: SubscriberStatus[] = ['ACTIVE', 'EXPIRED', 'SUSPENDED']
  const planTypes: PlanType[] = ['WEEKLY_LIMITED', 'MONTHLY_LIMITED', 'MONTHLY_UNLIMITED']
  const subscriptionStatuses: SubscriptionStatus[] = [
    'PENDING_PAYMENT',
    'PENDING_ACTIVATION',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'RENEWED',
  ]
  const validStatus = subscriberStatuses.includes(status as SubscriberStatus) ? (status as SubscriberStatus) : null
  const validPlanType = planTypes.includes(planType as PlanType) ? (planType as PlanType) : null
  const validSubscriptionStatus = subscriptionStatuses.includes(subscriptionStatus as SubscriptionStatus)
    ? (subscriptionStatus as SubscriptionStatus)
    : null
  const noSubscription = subscriptionStatus === 'NO_SUBSCRIPTION'

  if (validStatus) where.status = validStatus
  if (branch && ['HTM', 'TS'].includes(branch)) where.branchPrimary = branch
  if (search) {
    where.OR = [{ fullName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }]
  }

  const subscriptionWhere: Prisma.SubscriptionWhereInput = {}
  if (validPlanType) subscriptionWhere.planType = validPlanType
  if (validSubscriptionStatus) subscriptionWhere.status = validSubscriptionStatus
  const hasSubscriptionFilter = Boolean(validPlanType || validSubscriptionStatus)
  if (noSubscription) where.subscriptions = { none: {} }
  else if (hasSubscriptionFilter) where.subscriptions = { some: subscriptionWhere }

  return { where, subscriptionWhere, hasSubscriptionFilter }
}

export async function GET(request: Request) {
  try {
    const session = await getStaffSession()
    if (!session) return NextResponse.json({ error: 'Bạn chưa đăng nhập' }, { status: 401 })
    const role = session.user.role as string
    const permissions = await getRolePermissions(role)
    if (role !== 'ADMIN' && !permissions.canViewCustomers) {
      return NextResponse.json({ error: 'Bạn không có quyền xuất danh sách hội viên' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const { where, subscriptionWhere, hasSubscriptionFilter } = buildSubscriberWhere(searchParams)
    const subscribers = await prisma.subscriber.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { fullName: 'asc' }],
      include: {
        user: {
          select: {
            wallet: { select: { balance: true } },
          },
        },
        qrCredential: { select: { status: true } },
        subscriptions: {
          ...(hasSubscriptionFilter ? { where: subscriptionWhere } : {}),
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        registrationOrders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { paidAt: true },
        },
        sessions: {
          orderBy: { checkInTime: 'desc' },
          take: 1,
          select: { checkInTime: true },
        },
        _count: { select: { sessions: true } },
      },
    })

    const rows = subscribers.map((subscriber, index) => {
      const subscription = subscriber.subscriptions[0]
      const order = subscriber.registrationOrders[0]
      const latestSession = subscriber.sessions[0]
      const wallet = subscriber.user?.wallet
      const totalQuota =
        subscription?.totalHoursMin === null || subscription?.totalHoursMin === undefined
          ? null
          : subscription.totalHoursMin + subscription.carriedHoursMin
      const remainingQuota = totalQuota === null ? null : Math.max(0, totalQuota - (subscription?.usedHoursMin || 0))

      const row: Record<(typeof HEADERS)[number], string | number> = {
        STT: index + 1,
        'Họ và tên hội viên': subscriber.fullName,
        'Số điện thoại hội viên': subscriber.phone,
        'Email hội viên': subscriber.email || '',
        'Cơ sở đăng ký': branchLabel(subscriber.branchPrimary),
        'Trạng thái hội viên': readableLabel(SUBSCRIBER_STATUS_LABELS, subscriber.status),
        'Trạng thái QR thành viên': subscriber.qrCredential
          ? readableLabel(QR_STATUS_LABELS, subscriber.qrCredential.status)
          : 'Chưa được cấp QR thành viên',
        'Gói hiện tại': subscription
          ? readableLabel(PLAN_LABELS, subscription.planType)
          : 'Không có gói — sử dụng Ví Nerd',
        'Trạng thái gói': subscription
          ? readableLabel(SUBSCRIPTION_STATUS_LABELS, subscription.status)
          : 'Không có gói thành viên',
        'Ngày bắt đầu sử dụng': formatDate(subscription?.startDate),
        'Ngày cuối cùng được sử dụng': formatDate(subscription?.endDate),
        'Thời hạn còn lại': remainingDuration(subscription?.endDate),
        'Giá gói đã thanh toán (VNĐ)': subscription?.pricePaid || 0,
        'Ngày thanh toán hoặc mua gói': formatDate(order?.paidAt || subscription?.purchasedAt, true),
        'Phương thức thanh toán': readableLabel(PAYMENT_METHOD_LABELS, subscription?.paymentMethod),
        'Tổng định mức': formatMinutes(totalQuota),
        'Thời lượng đã sử dụng': formatMinutes(subscription?.usedHoursMin),
        'Định mức còn lại': totalQuota === null ? 'Áp dụng giới hạn theo ngày' : formatMinutes(remainingQuota),
        'Giới hạn mỗi ngày': subscription?.dailyLimitMin
          ? `${formatMinutes(subscription.dailyLimitMin)} mỗi ngày`
          : 'Không áp dụng giới hạn theo ngày',
        'Số dư Ví Nerd (VNĐ)': wallet?.balance ?? subscriber.walletBalance,
        'Công nợ (VNĐ)': subscriber.outstandingBalance,
        'Tổng số phiên check-in': subscriber._count.sessions,
        'Lần check-in gần nhất': formatDate(latestSession?.checkInTime, true),
      }
      return HEADERS.map((header) => row[header])
    })

    const csv = [HEADERS.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n')
    const timestamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .format(new Date())
      .replaceAll(/[-: ]/g, '')

    return new Response(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="monthly-beaver-${timestamp}.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[Monthly Beaver Export]', error)
    return NextResponse.json({ error: 'Không thể xuất dữ liệu Monthly Beaver' }, { status: 500 })
  }
}
