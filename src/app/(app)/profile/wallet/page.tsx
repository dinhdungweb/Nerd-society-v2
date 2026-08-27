import WalletTopupModal from '@/components/profile/WalletTopupModal'
import PayDebtButton from '@/components/profile/PayDebtButton'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVietQRConfig } from '@/lib/vietqr'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import {
  ArrowDownIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowUpIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  WalletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Prisma, WalletTransactionStatus, WalletTransactionType } from '@prisma/client'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const TRANSACTION_TYPES = [
  'TOPUP',
  'DEBIT',
  'ADJUSTMENT',
  'REFUND',
  'BOOKING_PAYMENT',
  'SUBSCRIPTION_PURCHASE',
  'SESSION_CHARGE',
  'OVERAGE_CHARGE',
  'OVERAGE_PAYMENT',
] as const satisfies readonly WalletTransactionType[]
const TRANSACTION_STATUSES = [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REVERSED',
] as const satisfies readonly WalletTransactionStatus[]

const transactionLabels: Record<WalletTransactionType, string> = {
  TOPUP: 'Nạp tiền',
  DEBIT: 'Trừ tiền',
  ADJUSTMENT: 'Điều chỉnh số dư',
  SESSION_CHARGE: 'Phí sử dụng không gian',
  OVERAGE_CHARGE: 'Phí quá giờ',
  BOOKING_PAYMENT: 'Thanh toán đặt lịch',
  SUBSCRIPTION_PURCHASE: 'Mua gói thành viên',
  REFUND: 'Hoàn tiền',
  OVERAGE_PAYMENT: 'Thanh toán công nợ',
}

const descriptionLabels: Record<string, string> = {
  'Admin topup wallet': 'Nạp tiền thủ công bởi quản trị viên',
}

const sourceLabels: Record<string, string> = {
  SYSTEM: 'Hệ thống',
  VIETQR: 'VietQR',
  MANUAL_ADMIN: 'Quản trị viên',
  BOOKING: 'Đặt lịch',
  SUBSCRIPTION: 'Gói thành viên',
  MONTHLY_BEAVER: 'Monthly Beaver',
}

const statusLabels: Record<WalletTransactionStatus, string> = {
  PENDING: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  REVERSED: 'Đã hoàn tác',
}

type WalletPageSearchParams = {
  q?: string
  type?: string
  direction?: string
  status?: string
  from?: string
  to?: string
  page?: string
}

type WalletPageProps = {
  searchParams: Promise<WalletPageSearchParams>
}

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatDateTime(value: Date) {
  return value.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  })
}

function parseLocalDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  const parsed = new Date(`${value}T${time}+07:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function buildPageHref(params: WalletPageSearchParams, page: number) {
  const query = new URLSearchParams()
  for (const key of ['q', 'type', 'direction', 'status', 'from', 'to'] as const) {
    const value = params[key]?.trim()
    if (value) query.set(key, value)
  }
  if (page > 1) query.set('page', String(page))
  const serialized = query.toString()
  return serialized ? `/profile/wallet?${serialized}` : '/profile/wallet'
}

export default async function WalletPage({ searchParams }: WalletPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const walletAccount = await ensureUserWalletAccount(session.user.id)
  if (!walletAccount.success) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
          <ExclamationTriangleIcon className="size-10" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Chưa thể mở Ví Nerd</h2>
        <p className="mt-2 max-w-md text-neutral-500 dark:text-neutral-400">{walletAccount.message}</p>
        <Link
          href="/profile/settings"
          className="mt-6 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl"
        >
          Cập nhật tài khoản
        </Link>
      </div>
    )
  }

  const params = await searchParams
  const query = params.q?.trim().slice(0, 100) || ''
  const selectedType = TRANSACTION_TYPES.includes(params.type as WalletTransactionType)
    ? (params.type as WalletTransactionType)
    : undefined
  const selectedStatus = TRANSACTION_STATUSES.includes(params.status as WalletTransactionStatus)
    ? (params.status as WalletTransactionStatus)
    : undefined
  const selectedDirection = params.direction === 'credit' || params.direction === 'debit' ? params.direction : undefined
  const fromDate = parseLocalDate(params.from)
  const toDate = parseLocalDate(params.to, true)
  const requestedPage = Math.max(1, Number.parseInt(params.page || '1', 10) || 1)

  const [wallet, bankConfig] = await Promise.all([
    prisma.wallet.findUnique({
      where: { id: walletAccount.wallet.id },
      select: {
        id: true,
        walletCode: true,
        balance: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    getVietQRConfig(),
  ])

  if (!wallet) return null

  const where: Prisma.WalletTransactionWhereInput = {
    walletId: wallet.id,
    ...(selectedType ? { type: selectedType } : {}),
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(selectedDirection === 'credit'
      ? { amount: { gt: 0 } }
      : selectedDirection === 'debit'
        ? { amount: { lt: 0 } }
        : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { id: { contains: query, mode: 'insensitive' } },
            { externalTransactionId: { contains: query, mode: 'insensitive' } },
            { referenceId: { contains: query, mode: 'insensitive' } },
            { referenceType: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { note: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [totalCount, creditSummary, debitSummary] = await prisma.$transaction([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.aggregate({
      where: { AND: [where, { amount: { gt: 0 } }] },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { AND: [where, { amount: { lt: 0 } }] },
      _sum: { amount: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const transactions = await prisma.walletTransaction.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      status: true,
      source: true,
      referenceType: true,
      referenceId: true,
      externalTransactionId: true,
      description: true,
      note: true,
      createdAt: true,
    },
  })

  const totalCredit = creditSummary._sum.amount || 0
  const totalDebit = Math.abs(debitSummary._sum.amount || 0)
  const netMovement = totalCredit - totalDebit
  const hasFilters = Boolean(query || selectedType || selectedDirection || selectedStatus || fromDate || toDate)
  const firstResult = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastResult = Math.min(currentPage * PAGE_SIZE, totalCount)

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-w-0 overflow-hidden bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 p-5 text-white sm:p-7">
            <div className="absolute -top-14 -right-14 size-56 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 left-1/3 size-48 rounded-full bg-primary-500/10 blur-2xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-neutral-300">
                  <WalletIcon className="size-5" />
                  <span className="text-sm font-medium">Số dư khả dụng</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${wallet.status === 'ACTIVE' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}
                >
                  {wallet.status === 'ACTIVE' ? 'Ví đang hoạt động' : 'Ví đang bị khóa'}
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight break-words sm:text-4xl">
                {formatMoney(wallet.balance)}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400">
                <span>
                  Mã ví: <strong className="font-mono text-neutral-200">{wallet.walletCode}</strong>
                </span>
                <span>Mở từ: {wallet.createdAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok' })}</span>
              </div>

              {(walletAccount.subscriber?.outstandingBalance || 0) > 0 && (
                <div className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-200">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <ExclamationTriangleIcon className="size-4" />
                    Công nợ hiện tại: {formatMoney(walletAccount.subscriber?.outstandingBalance || 0)}
                  </div>
                  <PayDebtButton
                    outstandingBalance={walletAccount.subscriber?.outstandingBalance || 0}
                    walletBalance={wallet.balance}
                  />
                </div>
              )}

              <div className="mt-6">
                <WalletTopupModal
                  walletCode={wallet.walletCode}
                  bankConfig={{
                    bankCode: bankConfig.bankCode,
                    accountNumber: bankConfig.accountNumber,
                    accountName: bankConfig.accountName,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 p-5 sm:p-7">
            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <BanknotesIcon className="size-5" />
              <h2 className="text-sm font-semibold">Thông tin nạp tiền nhanh</h2>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <dt className="text-neutral-500">Nội dung CK</dt>
                <dd className="min-w-0 text-right font-mono text-base font-bold break-all text-primary-600">
                  VI {wallet.walletCode}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <dt className="text-neutral-500">Ngân hàng</dt>
                <dd className="text-right font-semibold text-neutral-900 dark:text-white">{bankConfig.bankCode}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-neutral-500">Tài khoản</dt>
                <dd className="text-right">
                  <div className="font-mono font-semibold text-neutral-900 dark:text-white">
                    {bankConfig.accountNumber}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500 uppercase">{bankConfig.accountName}</div>
                </dd>
              </div>
            </dl>
            <p className="mt-5 rounded-xl bg-primary-50 p-3 text-xs leading-5 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
              Chuyển khoản đúng nội dung. Khi ngân hàng xác nhận, giao dịch sẽ xuất hiện trong sổ ví kèm mã tham chiếu
              để đối soát.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl dark:text-white">Sổ giao dịch Ví Nerd</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Tra cứu theo thời gian, loại giao dịch và mã tham chiếu. Mỗi bản ghi đều hiển thị số dư trước và sau để kiểm
            tra chéo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<ArrowsRightLeftIcon className="size-5" />}
            label="Giao dịch tìm thấy"
            value={totalCount.toLocaleString('vi-VN')}
            help={hasFilters ? 'Theo bộ lọc hiện tại' : 'Toàn bộ lịch sử ví'}
          />
          <SummaryCard
            icon={<ArrowTrendingUpIcon className="size-5" />}
            label="Tổng tiền vào"
            value={totalCredit > 0 ? `+${formatMoney(totalCredit)}` : formatMoney(0)}
            help="Các giao dịch có biến động dương"
            tone="credit"
          />
          <SummaryCard
            icon={<ArrowTrendingDownIcon className="size-5" />}
            label="Tổng tiền ra"
            value={totalDebit > 0 ? `-${formatMoney(totalDebit)}` : formatMoney(0)}
            help="Các giao dịch có biến động âm"
            tone="debit"
          />
          <SummaryCard
            icon={<BanknotesIcon className="size-5" />}
            label="Biến động ròng"
            value={`${netMovement > 0 ? '+' : ''}${formatMoney(netMovement)}`}
            help="Tiền vào trừ tiền ra"
            tone={netMovement >= 0 ? 'credit' : 'debit'}
          />
        </div>

        <form
          method="get"
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="mb-4 flex items-center gap-2">
            <FunnelIcon className="size-5 text-primary-500" />
            <h2 className="font-semibold text-neutral-900 dark:text-white">Bộ lọc đối soát</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="md:col-span-2 xl:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">Tìm giao dịch</span>
              <span className="relative block">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Mã giao dịch, tham chiếu, mô tả..."
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-sm text-neutral-900 transition outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                />
              </span>
            </label>
            <FilterSelect label="Loại giao dịch" name="type" defaultValue={selectedType || ''}>
              <option value="">Tất cả loại</option>
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {transactionLabels[type]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Chiều tiền" name="direction" defaultValue={selectedDirection || ''}>
              <option value="">Tiền vào & tiền ra</option>
              <option value="credit">Tiền vào</option>
              <option value="debit">Tiền ra</option>
            </FilterSelect>
            <FilterSelect label="Trạng thái" name="status" defaultValue={selectedStatus || ''}>
              <option value="">Tất cả trạng thái</option>
              {TRANSACTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </FilterSelect>
            <div className="hidden xl:block" />
            <DateInput label="Từ ngày" name="from" defaultValue={params.from || ''} />
            <DateInput label="Đến ngày" name="to" defaultValue={params.to || ''} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">Múi giờ đối soát: GMT+7 · Sắp xếp mới nhất trước</p>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Link
                  href="/profile/wallet"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <XMarkIcon className="size-4" />
                  Xóa lọc
                </Link>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                <MagnifyingGlassIcon className="size-4" />
                Tra cứu
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-neutral-800">
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-white">Kết quả giao dịch</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {totalCount > 0
                  ? `Hiển thị ${firstResult}–${lastResult} trong ${totalCount.toLocaleString('vi-VN')} giao dịch`
                  : 'Không có giao dịch phù hợp'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              “Khớp sổ” = Số dư trước + Biến động = Số dư sau
            </div>
          </div>

          {transactions.length > 0 ? (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {transactions.map((transaction) => {
                const isCredit = transaction.amount > 0
                const isBalanced = transaction.balanceBefore + transaction.amount === transaction.balanceAfter
                const visibleDescription = transaction.description
                  ? descriptionLabels[transaction.description] || transaction.description
                  : null
                return (
                  <article
                    key={transaction.id}
                    className="p-4 transition-colors hover:bg-neutral-50/70 sm:p-5 dark:hover:bg-neutral-800/30"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_140px_180px_180px] lg:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${isCredit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}
                        >
                          {isCredit ? <ArrowDownIcon className="size-5" /> : <ArrowUpIcon className="size-5" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-neutral-900 dark:text-white">
                            {transactionLabels[transaction.type]}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                            <ClockIcon className="size-3.5" />
                            {formatDateTime(transaction.createdAt)}
                          </p>
                          {visibleDescription && (
                            <p className="mt-1 line-clamp-2 text-sm break-words text-neutral-500 dark:text-neutral-400">
                              {visibleDescription}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase lg:hidden">
                          Trạng thái
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge status={transaction.status} />
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${isBalanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}
                          >
                            {isBalanced ? 'Khớp sổ' : 'Cần kiểm tra'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                          Biến động
                        </p>
                        <p
                          className={`text-lg font-bold tabular-nums ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatMoney(Math.abs(transaction.amount))}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                          Số dư sau
                        </p>
                        <p className="font-semibold text-neutral-900 tabular-nums dark:text-white">
                          {formatMoney(transaction.balanceAfter)}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400 tabular-nums">
                          Trước: {formatMoney(transaction.balanceBefore)}
                        </p>
                      </div>
                    </div>

                    <details className="group mt-3 border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
                      <summary className="cursor-pointer list-none text-xs font-semibold text-primary-600 marker:hidden dark:text-primary-400">
                        <span className="group-open:hidden">Xem chi tiết đối soát</span>
                        <span className="hidden group-open:inline">Ẩn chi tiết</span>
                      </summary>
                      <div className="mt-3 grid gap-x-6 gap-y-3 rounded-xl bg-neutral-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3 dark:bg-neutral-950">
                        <DetailItem label="Mã giao dịch hệ thống" value={transaction.id} mono />
                        <DetailItem
                          label="Mã giao dịch bên ngoài"
                          value={transaction.externalTransactionId || '—'}
                          mono
                        />
                        <DetailItem
                          label="Nguồn ghi nhận"
                          value={sourceLabels[transaction.source] || transaction.source}
                        />
                        <DetailItem label="Loại tham chiếu" value={transaction.referenceType || '—'} />
                        <DetailItem label="Mã tham chiếu" value={transaction.referenceId || '—'} mono />
                        <DetailItem label="Thời điểm ghi sổ" value={formatDateTime(transaction.createdAt)} />
                        <DetailItem label="Số dư trước" value={formatMoney(transaction.balanceBefore)} />
                        <DetailItem
                          label="Biến động"
                          value={`${transaction.amount > 0 ? '+' : ''}${formatMoney(transaction.amount)}`}
                        />
                        <DetailItem label="Số dư sau" value={formatMoney(transaction.balanceAfter)} />
                        {visibleDescription && <DetailItem label="Diễn giải" value={visibleDescription} wide />}
                        {transaction.note && <DetailItem label="Ghi chú" value={transaction.note} wide />}
                      </div>
                    </details>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                <MagnifyingGlassIcon className="size-7" />
              </div>
              <h3 className="mt-4 font-semibold text-neutral-900 dark:text-white">Không tìm thấy giao dịch</h3>
              <p className="mt-1 max-w-sm text-sm text-neutral-500">
                Thử thay đổi khoảng ngày, loại giao dịch hoặc mã tham chiếu cần tra cứu.
              </p>
              {hasFilters && (
                <Link href="/profile/wallet" className="mt-4 text-sm font-semibold text-primary-600">
                  Xem toàn bộ lịch sử
                </Link>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Phân trang lịch sử giao dịch"
              className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-4 sm:px-5 dark:border-neutral-800"
            >
              <Link
                href={buildPageHref(params, Math.max(1, currentPage - 1))}
                aria-disabled={currentPage === 1}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${currentPage === 1 ? 'pointer-events-none border-neutral-100 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
              >
                <ChevronLeftIcon className="size-4" />
                Trước
              </Link>
              <span className="text-sm text-neutral-500">
                Trang <strong className="text-neutral-900 dark:text-white">{currentPage}</strong> / {totalPages}
              </span>
              <Link
                href={buildPageHref(params, Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage === totalPages}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${currentPage === totalPages ? 'pointer-events-none border-neutral-100 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
              >
                Sau
                <ChevronRightIcon className="size-4" />
              </Link>
            </nav>
          )}
        </div>
      </section>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  help,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  help: string
  tone?: 'neutral' | 'credit' | 'debit'
}) {
  const toneClasses =
    tone === 'credit'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
      : tone === 'debit'
        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        <span className={`flex size-8 items-center justify-center rounded-lg ${toneClasses}`}>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-xl font-bold text-neutral-900 tabular-nums dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{help}</p>
    </div>
  )
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string
  name: string
  defaultValue: string
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 pr-9 text-sm text-neutral-900 transition outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {children}
      </select>
    </label>
  )
}

function DateInput({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</span>
      <span className="relative block">
        <CalendarDaysIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="date"
          name={name}
          defaultValue={defaultValue}
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-sm text-neutral-900 transition outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        />
      </span>
    </label>
  )
}

function StatusBadge({ status }: { status: WalletTransactionStatus }) {
  const classes =
    status === 'COMPLETED'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
      : status === 'PENDING'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${classes}`}>
      {statusLabels[status]}
    </span>
  )
}

function DetailItem({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string
  value: string
  mono?: boolean
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2 xl:col-span-3' : ''}>
      <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{label}</p>
      <p className={`mt-1 break-all text-neutral-800 dark:text-neutral-200 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}
