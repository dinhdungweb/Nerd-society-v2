import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import RenewPlanClientWrapper from './RenewPlanClientWrapper'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    CreditCardIcon,
    BoltIcon,
    ClockIcon,
    CheckCircleIcon,
    SparklesIcon,
    ClipboardDocumentIcon,
    CalendarDaysIcon,
    IdentificationIcon,
} from '@heroicons/react/24/outline'
import { ensureUserWalletAccount } from '@/lib/wallet-account'

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

    const walletRes = await ensureUserWalletAccount(session.user.id)
    const walletBalance = walletRes.success ? walletRes.wallet.balance : 0
    const walletStatus = walletRes.success ? walletRes.wallet.status : 'INACTIVE'

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
                },
            },
        },
    })

    const subscriber = user?.subscriber

    // Nếu chưa là hội viên → kiểm tra có đơn hàng đang chờ xử lý không
    if (!subscriber) {
        const conditions: any[] = [{ userId: session.user.id }];
        
        const nullUserConditions: any[] = [];
        if (user?.email) nullUserConditions.push({ email: user.email });
        if (user?.phone) nullUserConditions.push({ phone: user.phone });

        if (nullUserConditions.length > 0) {
            conditions.push({
                userId: null,
                OR: nullUserConditions
            });
        }

        const pendingOrders = await prisma.registrationOrder.findMany({
            where: {
                OR: conditions,
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
                    <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10 sm:gap-4 sm:p-5">
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
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
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
                                        <div className="text-left sm:text-right">
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
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
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
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">Quay lại trang này để theo dõi gói dịch vụ và lịch sử check-in</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        // Chưa có đơn hàng nào → hiển thị CTA đăng ký
        return (
            <div className="flex flex-col items-center rounded-2xl bg-white px-4 py-10 text-center dark:bg-neutral-900 sm:bg-transparent sm:px-0 sm:py-12 sm:dark:bg-transparent">
                <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                    <CreditCardIcon className="size-10 text-primary-500" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Bạn chưa có Monthly Beaver</h2>
                <p className="mt-2 max-w-sm text-neutral-500 dark:text-neutral-400">
                    Đăng ký Monthly Beaver để sử dụng không gian linh hoạt và tận hưởng nhiều ưu đãi tại Nerd.
                </p>
                <Link
                    href="/monthly-beaver"
                    className="mt-6 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white transition-all hover:bg-primary-600"
                >
                    Đăng ký Monthly Beaver ngay
                </Link>
            </div>
        )
    }

    const activeSub = subscriber.subscriptions.find(s => s.status === 'ACTIVE' || s.status === 'PENDING_ACTIVATION')
    const availableMinutes = activeSub?.totalHoursMin
        ? activeSub.totalHoursMin + activeSub.carriedHoursMin
        : null
    const usedMinutes = activeSub?.usedHoursMin || 0
    const remainingMinutes = availableMinutes !== null
        ? Math.max(0, availableMinutes - usedMinutes)
        : null
    const usagePercent = availableMinutes
        ? Math.min(100, Math.round((usedMinutes / availableMinutes) * 100))
        : 0
    const formatMinutes = (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        if (hours <= 0) return `${mins} phút`
        if (mins === 0) return `${hours} giờ`
        return `${hours} giờ ${mins} phút`
    }

    return (
        <div className="space-y-5 sm:space-y-8">
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="min-w-0 bg-gradient-to-br from-primary-50 to-white p-4 dark:from-primary-950/30 dark:to-neutral-900 sm:p-7">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-primary-500 text-white">
                                <BoltIcon className="size-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Monthly Beaver</p>
                                <h2 className="text-xl font-bold text-neutral-950 dark:text-white sm:text-2xl">
                                    {activeSub ? (planLabels[activeSub.planType] || activeSub.planType) : 'Chưa có gói hoạt động'}
                                </h2>
                            </div>
                            {activeSub && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium sm:ml-auto ${subStatusLabels[activeSub.status]?.style || 'bg-neutral-100 text-neutral-600'}`}>
                                    {activeSub.status === 'ACTIVE' && <CheckCircleIcon className="size-3.5" />}
                                    {subStatusLabels[activeSub.status]?.label || activeSub.status}
                                </span>
                            )}
                        </div>

                        {activeSub ? (
                            <div className="mt-7 space-y-5">
                                {availableMinutes !== null ? (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between text-sm">
                                            <span className="font-medium text-neutral-700 dark:text-neutral-300">Tiến độ sử dụng</span>
                                            <span className="text-neutral-500 dark:text-neutral-400">{usagePercent}%</span>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-primary-100 ring-1 ring-primary-200/70 dark:bg-neutral-800 dark:ring-neutral-700">
                                            <div
                                                className="h-full rounded-full bg-primary-500"
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl bg-white/70 p-4 text-sm text-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-300">
                                        {activeSub.dailyLimitMin
                                            ? `Giới hạn ${activeSub.dailyLimitMin / 60}h/ngày. Không giới hạn tổng giờ theo tháng.`
                                            : 'Gói không giới hạn giờ. Hệ thống vẫn theo dõi giới hạn sử dụng trong ngày nếu có.'}
                                    </div>
                                )}

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                                        <p className="text-xs font-semibold uppercase text-neutral-500">Đã dùng</p>
                                        <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{formatMinutes(usedMinutes)}</p>
                                    </div>
                                    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                                        <p className="text-xs font-semibold uppercase text-neutral-500">Còn lại</p>
                                        <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                                            {remainingMinutes !== null ? formatMinutes(remainingMinutes) : 'Không giới hạn'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                                        <p className="text-xs font-semibold uppercase text-neutral-500">
                                            Hạn sử dụng
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                                            {activeSub.endDate
                                                ? new Date(activeSub.endDate).toLocaleDateString('vi-VN')
                                                : activeSub.activationDeadline
                                                    ? new Date(activeSub.activationDeadline).toLocaleDateString('vi-VN')
                                                    : activeSub.dailyLimitMin
                                                        ? `${activeSub.dailyLimitMin / 60}h/ngày`
                                                        : '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <RenewPlanClientWrapper 
                                        subscriberId={subscriber.id}
                                        currentPlanType={activeSub.planType}
                                        walletBalance={walletBalance}
                                        walletStatus={walletStatus}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6">
                                <p className="max-w-xl text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                    Bạn chưa có gói Monthly Beaver đang hoạt động. Bạn có thể gia hạn lại gói trước đó bằng thẻ vật lý cũ của mình.
                                </p>
                                <RenewPlanClientWrapper 
                                    subscriberId={subscriber.id}
                                    walletBalance={walletBalance}
                                    walletStatus={walletStatus}
                                />
                            </div>
                        )}
                    </div>

                    <aside className="min-w-0 border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 lg:border-l lg:border-t-0">
                        <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                            <IdentificationIcon className="size-5" />
                            <span className="text-sm font-semibold">Thông tin hội viên</span>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase text-neutral-500">Mã hội viên</p>
                                <p className="mt-1 text-3xl font-bold tracking-widest text-primary-600">
                                    {subscriber.mytimeEmpId || '—'}
                                </p>
                            </div>
                            <div className="relative flex aspect-[1.58/1] min-h-[164px] flex-col justify-between overflow-hidden rounded-2xl border border-primary-200 bg-neutral-950 p-4 text-white dark:border-primary-800 sm:min-h-[178px] sm:p-5">
                                <div className="absolute inset-x-0 top-0 h-1 bg-primary-400" />

                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Thẻ vật lý</p>
                                        <p className="mt-1 text-sm font-semibold text-white">Nerd Society</p>
                                    </div>
                                    <CreditCardIcon className="size-6 shrink-0 text-white/70" />
                                </div>

                                <div className="flex items-end justify-between gap-4">
                                    <div className="space-y-4">
                                        <div className="h-8 w-11 rounded-md border border-white/25 bg-white/15">
                                            <div className="h-full w-full rounded-md border border-black/10 bg-gradient-to-br from-primary-200 to-primary-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Mã thẻ</p>
                                            <p className="mt-1 font-mono text-xl font-bold tracking-widest">
                                                {subscriber.cardNo
                                                    ? subscriber.cardNo.replace(/(.{4})/g, '$1 ').trim()
                                                    : 'CHƯA GÁN'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="pb-0.5 text-right text-[10px] font-medium uppercase tracking-widest text-white/45">
                                        Proximity
                                        <br />
                                        Barcode
                                    </p>
                                </div>
                            </div>
                            {subscriber.branchPrimary && (
                                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                                    <p className="text-xs font-semibold uppercase text-neutral-500">Cơ sở chính</p>
                                    <p className="mt-1 font-semibold text-neutral-900 dark:text-white">{subscriber.branchPrimary}</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Lịch sử check-in</h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {subscriber.sessions.length > 0
                                ? `${subscriber.sessions.length} phiên gần nhất`
                                : 'Theo dõi các phiên sử dụng Monthly Beaver'}
                        </p>
                    </div>
                </div>

                {subscriber.sessions.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
                        {subscriber.sessions.map((s: any, index: number) => (
                            <div
                                key={s.id}
                                className={`flex flex-col gap-3 bg-white p-4 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${index > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''}`}
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                        <CalendarDaysIcon className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                                            Check-in tại {s.branch}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {new Date(s.checkInTime).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    {s.durationMin ? (
                                        <p className="text-sm font-bold text-primary-600">{formatMinutes(s.durationMin)}</p>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                            </span>
                                            Đang ngồi
                                        </span>
                                    )}
                                    {s.amountCharged > 0 && (
                                        <p className="mt-1 text-xs font-mono text-neutral-500">−{s.amountCharged.toLocaleString()}đ</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
                            <CalendarDaysIcon className="size-6" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">Chưa có phiên check-in nào</p>
                        <p className="mt-1 text-xs text-neutral-400">Các phiên sử dụng sẽ xuất hiện tại đây sau lần check-in đầu tiên.</p>
                    </div>
                )}
            </section>
        </div>
    )
}
