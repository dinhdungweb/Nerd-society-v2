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
  PENDING_ACTIVATION: 'Đã thanh toán, đang chờ kích hoạt và cấp QR',
  ACTIVE: 'Gói đang hoạt động',
  EXPIRED: 'Gói đã hết hạn',
  CANCELLED: 'Gói đã bị hủy',
  RENEWED: 'Gói cũ đã được gia hạn hoặc gộp vào gói hiện tại',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Đơn đang chờ thanh toán',
  PAID: 'Đơn đã thanh toán, hệ thống đang hoàn tất kích hoạt',
  QR_ISSUED: 'Đơn đã được cấp QR',
  CARD_ASSIGNED: 'Đơn cũ đã được gán thẻ thành viên',
  ACTIVATED: 'Đơn đã hoàn tất và kích hoạt gói',
  CANCELLED: 'Đơn đã bị hủy',
  ORDER_EXPIRED: 'Đơn đã hết hạn thanh toán',
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

const SESSION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang check-in, chưa check-out',
  COMPLETED: 'Đã check-out và hoàn tất',
  FORCE_CLOSED: 'Phiên được nhân viên đóng thủ công',
}

const SESSION_SOURCE_LABELS: Record<string, string> = {
  qr: 'Quét QR thành viên',
  wallet: 'Check-in bằng Ví Nerd',
  legacy_card: 'Thẻ thành viên cũ',
  mytime: 'Máy chấm công MyTime',
}

const HEADERS = [
  'STT',
  'Họ và tên hội viên',
  'Số điện thoại hội viên',
  'Email hội viên',
  'Cơ sở đăng ký chính',
  'Trạng thái hồ sơ hội viên',
  'Có liên kết tài khoản website',
  'Email tài khoản website',
  'Số điện thoại tài khoản website',
  'Ngày tạo hồ sơ hội viên',
  'Ngày cập nhật hồ sơ gần nhất',
  'Ảnh hồ sơ',
  'Mã thẻ thành viên cũ',
  'Mã nhân viên trên máy chấm công',
  'Ghi chú nội bộ',
  'Hạng thành viên',
  'Mã Ví Nerd',
  'Trạng thái Ví Nerd',
  'Số dư Ví Nerd hiện tại (VNĐ)',
  'Công nợ cần thanh toán (VNĐ)',
  'Trạng thái QR thành viên',
  'Phiên bản QR',
  'Ngày cấp QR',
  'Ngày cấp lại QR gần nhất',
  'Lần sử dụng QR gần nhất',
  'Gói hiện tại',
  'Trạng thái chi tiết của gói',
  'Giá gói đã thanh toán (VNĐ)',
  'Ngày mua gói',
  'Thời điểm kích hoạt gói',
  'Ngày bắt đầu sử dụng',
  'Ngày cuối cùng còn được sử dụng',
  'Thời hạn còn lại',
  'Tổng định mức của gói',
  'Thời lượng chuyển tiếp từ gói trước',
  'Tổng thời lượng đã sử dụng',
  'Định mức còn lại',
  'Giới hạn sử dụng mỗi ngày',
  'Phương thức thanh toán của gói',
  'Mã tham chiếu thanh toán của gói',
  'Tổng số gói trong lịch sử',
  'Tổng số phiên check-in',
  'Tổng thời lượng thực tế đã check-in',
  'Tổng thời lượng vượt định mức',
  'Tổng tiền phát sinh từ phiên sử dụng (VNĐ)',
  'Thời điểm check-in gần nhất',
  'Thời điểm check-out gần nhất',
  'Trạng thái phiên gần nhất',
  'Nguồn tạo phiên gần nhất',
  'Cơ sở của phiên gần nhất',
  'Tổng số lượt quét QR đã ghi nhận',
  'Tổng số đơn đăng ký và gia hạn',
  'Mã đơn gần nhất',
  'Trạng thái chi tiết của đơn gần nhất',
  'Ngày tạo đơn gần nhất',
  'Ngày thanh toán đơn gần nhất',
  'Số tiền của đơn gần nhất (VNĐ)',
  'Phương thức thanh toán của đơn gần nhất',
  'Mã tham chiếu thanh toán của đơn gần nhất',
  'Người hoặc hệ thống kích hoạt đơn gần nhất',
  'Thời điểm kích hoạt đơn gần nhất',
  'Hạn thanh toán của đơn gần nhất',
  'Mã hồ sơ hội viên trong hệ thống',
  'Mã gói hiện tại trong hệ thống',
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
            email: true,
            phone: true,
            wallet: { select: { walletCode: true, balance: true, status: true } },
          },
        },
        qrCredential: true,
        subscriptions: {
          ...(hasSubscriptionFilter ? { where: subscriptionWhere } : {}),
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        registrationOrders: { orderBy: { createdAt: 'desc' }, take: 1 },
        sessions: {
          orderBy: { checkInTime: 'desc' },
          take: 1,
          select: {
            branch: true,
            checkInTime: true,
            checkOutTime: true,
            status: true,
            source: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            registrationOrders: true,
            sessions: true,
            membershipScans: true,
          },
        },
      },
    })

    const subscriberIds = subscribers.map((subscriber) => subscriber.id)
    const sessionStats = subscriberIds.length
      ? await prisma.subscriptionSession.groupBy({
          by: ['subscriberId'],
          where: { subscriberId: { in: subscriberIds } },
          _sum: { durationMin: true, overageMin: true, amountCharged: true },
        })
      : []
    const sessionStatsBySubscriber = new Map(sessionStats.map((item) => [item.subscriberId, item._sum]))

    const rows = subscribers.map((subscriber, index) => {
      const subscription = subscriber.subscriptions[0]
      const order = subscriber.registrationOrders[0]
      const latestSession = subscriber.sessions[0]
      const stats = sessionStatsBySubscriber.get(subscriber.id)
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
        'Cơ sở đăng ký chính': branchLabel(subscriber.branchPrimary),
        'Trạng thái hồ sơ hội viên': readableLabel(SUBSCRIBER_STATUS_LABELS, subscriber.status),
        'Có liên kết tài khoản website': subscriber.userId ? 'Có' : 'Không',
        'Email tài khoản website': subscriber.user?.email || '',
        'Số điện thoại tài khoản website': subscriber.user?.phone || '',
        'Ngày tạo hồ sơ hội viên': formatDate(subscriber.createdAt, true),
        'Ngày cập nhật hồ sơ gần nhất': formatDate(subscriber.updatedAt, true),
        'Ảnh hồ sơ': subscriber.photoUrl || '',
        'Mã thẻ thành viên cũ': subscriber.cardNo || '',
        'Mã nhân viên trên máy chấm công': subscriber.mytimeEmpId || '',
        'Ghi chú nội bộ': subscriber.notes || '',
        'Hạng thành viên': subscriber.loyaltyTier,
        'Mã Ví Nerd': wallet?.walletCode || subscriber.walletCode || '',
        'Trạng thái Ví Nerd': wallet
          ? readableLabel({ ACTIVE: 'Ví đang hoạt động', LOCKED: 'Ví đang bị khóa' }, wallet.status)
          : 'Chưa có Ví Nerd',
        'Số dư Ví Nerd hiện tại (VNĐ)': wallet?.balance ?? subscriber.walletBalance,
        'Công nợ cần thanh toán (VNĐ)': subscriber.outstandingBalance,
        'Trạng thái QR thành viên': subscriber.qrCredential
          ? readableLabel(QR_STATUS_LABELS, subscriber.qrCredential.status)
          : 'Chưa được cấp QR thành viên',
        'Phiên bản QR': subscriber.qrCredential?.version || '',
        'Ngày cấp QR': formatDate(subscriber.qrCredential?.issuedAt, true),
        'Ngày cấp lại QR gần nhất': formatDate(subscriber.qrCredential?.rotatedAt, true),
        'Lần sử dụng QR gần nhất': formatDate(subscriber.qrCredential?.lastUsedAt, true),
        'Gói hiện tại': subscription
          ? readableLabel(PLAN_LABELS, subscription.planType)
          : 'Không có gói — sử dụng Ví Nerd',
        'Trạng thái chi tiết của gói': subscription
          ? readableLabel(SUBSCRIPTION_STATUS_LABELS, subscription.status)
          : 'Không có gói thành viên',
        'Giá gói đã thanh toán (VNĐ)': subscription?.pricePaid || 0,
        'Ngày mua gói': formatDate(subscription?.purchasedAt, true),
        'Thời điểm kích hoạt gói': formatDate(subscription?.activationDate, true),
        'Ngày bắt đầu sử dụng': formatDate(subscription?.startDate),
        'Ngày cuối cùng còn được sử dụng': formatDate(subscription?.endDate),
        'Thời hạn còn lại': remainingDuration(subscription?.endDate),
        'Tổng định mức của gói': formatMinutes(totalQuota),
        'Thời lượng chuyển tiếp từ gói trước': formatMinutes(subscription?.carriedHoursMin),
        'Tổng thời lượng đã sử dụng': formatMinutes(subscription?.usedHoursMin),
        'Định mức còn lại': totalQuota === null ? 'Áp dụng giới hạn theo ngày' : formatMinutes(remainingQuota),
        'Giới hạn sử dụng mỗi ngày': subscription?.dailyLimitMin
          ? `${formatMinutes(subscription.dailyLimitMin)} mỗi ngày`
          : 'Không áp dụng giới hạn theo ngày',
        'Phương thức thanh toán của gói': readableLabel(PAYMENT_METHOD_LABELS, subscription?.paymentMethod),
        'Mã tham chiếu thanh toán của gói': subscription?.paymentRef || '',
        'Tổng số gói trong lịch sử': subscriber._count.subscriptions,
        'Tổng số phiên check-in': subscriber._count.sessions,
        'Tổng thời lượng thực tế đã check-in': formatMinutes(stats?.durationMin),
        'Tổng thời lượng vượt định mức': formatMinutes(stats?.overageMin),
        'Tổng tiền phát sinh từ phiên sử dụng (VNĐ)': stats?.amountCharged || 0,
        'Thời điểm check-in gần nhất': formatDate(latestSession?.checkInTime, true),
        'Thời điểm check-out gần nhất': formatDate(latestSession?.checkOutTime, true),
        'Trạng thái phiên gần nhất': latestSession
          ? readableLabel(SESSION_STATUS_LABELS, latestSession.status)
          : 'Chưa có phiên check-in',
        'Nguồn tạo phiên gần nhất': latestSession ? readableLabel(SESSION_SOURCE_LABELS, latestSession.source) : '',
        'Cơ sở của phiên gần nhất': latestSession ? branchLabel(latestSession.branch) : '',
        'Tổng số lượt quét QR đã ghi nhận': subscriber._count.membershipScans,
        'Tổng số đơn đăng ký và gia hạn': subscriber._count.registrationOrders,
        'Mã đơn gần nhất': order?.orderCode || '',
        'Trạng thái chi tiết của đơn gần nhất': order
          ? readableLabel(ORDER_STATUS_LABELS, order.orderStatus)
          : 'Chưa có đơn đăng ký liên kết',
        'Ngày tạo đơn gần nhất': formatDate(order?.createdAt, true),
        'Ngày thanh toán đơn gần nhất': formatDate(order?.paidAt, true),
        'Số tiền của đơn gần nhất (VNĐ)': order?.amount || 0,
        'Phương thức thanh toán của đơn gần nhất': readableLabel(PAYMENT_METHOD_LABELS, order?.paymentMethod),
        'Mã tham chiếu thanh toán của đơn gần nhất': order?.paymentRef || '',
        'Người hoặc hệ thống kích hoạt đơn gần nhất': order?.assignedBy || '',
        'Thời điểm kích hoạt đơn gần nhất': formatDate(order?.assignedAt, true),
        'Hạn thanh toán của đơn gần nhất': formatDate(order?.expiresAt, true),
        'Mã hồ sơ hội viên trong hệ thống': subscriber.id,
        'Mã gói hiện tại trong hệ thống': subscription?.id || '',
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
        'Content-Disposition': `attachment; filename="monthly-beaver-full-${timestamp}.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[Monthly Beaver Export]', error)
    return NextResponse.json({ error: 'Không thể xuất dữ liệu Monthly Beaver' }, { status: 500 })
  }
}
