import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    CreditCardIcon,
    BoltIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    SparklesIcon,
    ClipboardDocumentIcon,
    IdentificationIcon,
} from '@heroicons/react/24/outline'
import { getVietQRConfig } from '@/lib/vietqr'
import TopupModal from './TopupModal'

export const dynamic = 'force-dynamic'

const planLabels: Record<string, string> = {
    WEEKLY_LIMITED: 'Gói Tuần - Limited',
    MONTHLY_LIMITED: 'Gói Tháng - Limited',
    MONTHLY_UNLIMITED: 'Gói Tháng - Unlimited',
}

const subStatusLabels: Record<string, { label: string; style: string }> = {
    ACTIVE: { label: 'Đang hoạt động', style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    PENDING_ACTIVATION: { label: 'Chờ kích hoạt', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    EXPIRED: { label: 'Đã hết hạn', style: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
    SUSPENDED: { label: 'Tạm dừng', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    CANCELLED: { label: 'Đã hủy', style: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500' },
}

export default async function MonthlyBeaverPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            subscriber: {
                include: {
                    subscriptions: {
                        orderBy: { createdAt: 'desc' },
                        take: 3,
                    },
                    sessions: {
                        orderBy: { checkInTime: 'desc' },
                        take: 10,
                    },
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                },
            },
        },
    })

    const subscriber = user?.subscriber

    // Nếu chưa là hội viên → kiểm tra có đơn hàng đang chờ xử lý không
    if (!subscriber) {
        const pendingOrders = await prisma.registrationOrder.findMany({
            where: {
                OR: [
                    { userId: session.user.id },
                    { email: user?.email },
                    { phone: user?.phone || '' },
                ],
                orderStatus: { in: ['PAID', 'PENDING_PAYMENT'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
        })

        // Có đơn hàng đã thanh toán → hiển thị trạng thái chờ gán thẻ
        if (pendingOrders.length > 0) {
            const orderStatusLabels: Record<string, { label: string; style: string; Icon: any }> = {
                PAID: { label: 'Đã thanh toán — Chờ nhận thẻ', style: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', Icon: ClockIcon },
                PENDING_PAYMENT: { label: 'Chờ thanh toán', style: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800', Icon: CreditCardIcon },
            }

            return (
                <div className="space-y-6">
                    {/* Banner thông báo */}
                    <div className="flex items-start gap-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-800 dark:bg-blue-900/10">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                            <SparklesIcon className="size-7" />
                        </div>
                        <div>
                            <h3 className="font-bold text-neutral-900 dark:text-white">Đơn đăng ký Monthly Beaver đang được xử lý!</h3>
                            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                                Bạn đã đăng ký thành công. Vui lòng đến quầy để nhận thẻ hội viên hoặc liên hệ nhân viên để được hỗ trợ.
                            </p>
                        </div>
                    </div>

                    {/* Danh sách đơn hàng */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Đơn đăng ký của bạn</h3>
                        {pendingOrders.map((order: any) => {
                            const status = orderStatusLabels[order.orderStatus] || { label: order.orderStatus, style: 'bg-neutral-100 text-neutral-600', Icon: ClipboardDocumentIcon }
                            return (
                                <div key={order.id} className={`rounded-xl border p-4 ${status.style}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-white/50 dark:bg-black/20">
                                                <status.Icon className="size-6" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">{order.orderCode}</p>
                                                <p className="text-sm opacity-80">
                                                    {planLabels[order.planType] || order.planType} • {order.branchPrimary}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-medium uppercase">{status.label}</p>
                                            <p className="text-xs opacity-70 mt-0.5">
                                                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Hướng dẫn */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                        <h3 className="font-bold text-neutral-900 dark:text-white">Bước tiếp theo</h3>
                        <div className="mt-3 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30">1</div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">Đến quầy lễ tân tại chi nhánh bạn đã đăng ký</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30">2</div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">Nhân viên sẽ gán thẻ hội viên cho bạn</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30">3</div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">Quay lại trang này để quản lý ví tiền và gói dịch vụ</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        // Chưa có đơn hàng nào → hiển thị CTA đăng ký
        return (
            <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                    <CreditCardIcon className="size-10 text-primary-500" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Bạn chưa có Monthly Beaver</h2>
                <p className="mt-2 max-w-sm text-neutral-500 dark:text-neutral-400">
                    Đăng ký Monthly Beaver để sử dụng không gian linh hoạt, quản lý ví tiền và tận hưởng nhiều ưu đãi.
                </p>
                <Link
                    href="/monthly-beaver"
                    className="mt-6 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl"
                >
                    Đăng ký Monthly Beaver ngay
                </Link>
            </div>
        )
    }

    const activeSub = subscriber.subscriptions.find(s => s.status === 'ACTIVE' || s.status === 'PENDING_ACTIVATION')
    const bankConfig = getVietQRConfig()

    return (
        <div className="space-y-6">
            {/* === Card Row: Ví tiền + Gói cước === */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Wallet Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-5 text-white shadow-xl">
                    <div className="absolute right-0 top-0 -mr-6 -mt-6 size-32 rounded-full bg-white/5" />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-neutral-400">
                            <CreditCardIcon className="size-5" />
                            <span className="text-sm font-medium">Số dư Ví</span>
                        </div>
                        <p className="mt-2 text-3xl font-bold">
                            {subscriber.walletBalance.toLocaleString()}
                            <span className="ml-1 text-sm font-normal text-neutral-400">đ</span>
                        </p>

                        {subscriber.outstandingBalance > 0 && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300">
                                <ExclamationTriangleIcon className="size-4" />
                                Nợ: {subscriber.outstandingBalance.toLocaleString()}đ
                            </div>
                        )}

                        <div className="mt-4">
                            <TopupModal
                                empId={subscriber.mytimeEmpId || 'N/A'}
                                bankConfig={{
                                    bankCode: bankConfig.bankCode,
                                    accountNumber: bankConfig.accountNumber,
                                    accountName: bankConfig.accountName,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Subscription Card */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-2 text-neutral-500">
                        <BoltIcon className="size-5" />
                        <span className="text-sm font-medium">Gói dịch vụ</span>
                    </div>

                    {activeSub ? (
                        <div className="mt-3">
                            <p className="text-xl font-bold text-neutral-900 dark:text-white">
                                {planLabels[activeSub.planType] || activeSub.planType}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${subStatusLabels[activeSub.status]?.style || 'bg-neutral-100 text-neutral-600'}`}>
                                    {activeSub.status === 'ACTIVE' && <CheckCircleIcon className="size-3" />}
                                    {subStatusLabels[activeSub.status]?.label || activeSub.status}
                                </span>
                            </div>
                            <div className="mt-3 space-y-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                                {activeSub.endDate && (
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="size-4 shrink-0" />
                                        <span>HSD: {new Date(activeSub.endDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                )}
                                {activeSub.totalHoursMin && (
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="size-4 shrink-0" />
                                        <span>Đã dùng: {activeSub.usedHoursMin}/{activeSub.totalHoursMin} phút</span>
                                    </div>
                                )}
                                {activeSub.dailyLimitMin && (
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="size-4 shrink-0" />
                                        <span>Giới hạn: {activeSub.dailyLimitMin / 60}h/ngày</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3">
                            <p className="text-neutral-500 dark:text-neutral-400">Không có gói nào đang hoạt động</p>
                            <Link
                                href="/monthly-beaver"
                                className="mt-3 inline-block rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40"
                            >
                                Đăng ký gói mới
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* === Mã hội viên === */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="text-sm font-medium text-neutral-500">Mã hội viên</h3>
                <p className="mt-1 text-2xl font-bold tracking-widest text-primary-600">{subscriber.mytimeEmpId || '—'}</p>
                {subscriber.cardNo && (
                    <p className="mt-1 text-xs text-neutral-400">Thẻ vật lý: {subscriber.cardNo}</p>
                )}
            </div>

            {/* === Lịch sử giao dịch === */}
            <div className="space-y-3">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Lịch sử giao dịch</h3>

                {subscriber.transactions.length > 0 ? (
                    <div className="space-y-2">
                        {subscriber.transactions.map((tx: any) => (
                            <div
                                key={tx.id}
                                className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex size-9 items-center justify-center rounded-full ${tx.type === 'TOPUP' || tx.type === 'REFUND'
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                                        : 'bg-red-50 text-red-600 dark:bg-red-900/20'
                                        }`}>
                                        {tx.type === 'TOPUP' || tx.type === 'REFUND'
                                            ? <ArrowDownIcon className="size-4" />
                                            : <ArrowUpIcon className="size-4" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                            {tx.type === 'TOPUP' ? 'Nạp tiền' : 
                                             tx.type === 'DEDUCT' ? 'Trừ tiền' : 
                                             tx.type === 'REFUND' ? 'Hoàn tiền' : 
                                             tx.type === 'OVERAGE_PAYMENT' ? 'Thanh toán nợ' :
                                             tx.type === 'OVERAGE_CHARGE' ? 'Phí quá giờ' :
                                             tx.type}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-sm font-bold ${tx.type === 'TOPUP' || tx.type === 'REFUND' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {tx.type === 'TOPUP' || tx.type === 'REFUND' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}đ
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
                        <p className="text-sm text-neutral-400">Chưa có giao dịch nào</p>
                    </div>
                )}
            </div>

            {/* === Lịch sử phiên ngồi === */}
            <div className="space-y-3">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Lịch sử check-in</h3>

                {subscriber.sessions.length > 0 ? (
                    <div className="space-y-2">
                        {subscriber.sessions.map((s: any) => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                            >
                                <div>
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                        Check-in tại {s.branch}
                                    </p>
                                    <p className="text-xs text-neutral-400">
                                        {new Date(s.checkInTime).toLocaleString('vi-VN')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary-600">
                                        {s.durationMin ? `${s.durationMin} phút` : (
                                            <span className="flex items-center gap-1.5 text-emerald-600">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                <span>Đang ngồi</span>
                                            </span>
                                        )}
                                    </p>
                                    {s.amountCharged > 0 && (
                                        <p className="text-xs font-mono text-neutral-500">
                                            −{s.amountCharged.toLocaleString()}đ
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
                        <p className="text-sm text-neutral-400">Chưa có phiên check-in nào</p>
                    </div>
                )}
            </div>
        </div>
    )
}
