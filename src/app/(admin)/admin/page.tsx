import { prisma } from '@/lib/prisma'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import Link from 'next/link'
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClockIcon,
    UsersIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    NewspaperIcon,
    PhotoIcon,
    PlusIcon,
    ArrowRightIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline'
import { RevenueChart, BookingChart, RoomUsageChart } from '@/components/admin/DashboardCharts'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRolePermissions } from '@/lib/apiPermissions'
import type { AdminPermissionKey } from '@/config/admin'

async function getStats(locationId?: string | null) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const currentPeriodStart = startOfDay(subDays(today, 6))
    const previousPeriodStart = startOfDay(subDays(today, 13))
    const previousPeriodEnd = endOfDay(subDays(today, 7))
    const bookingWhere = locationId ? { locationId } : {}

    const [
        todayBookings,
        yesterdayBookings,
        pendingBookings,
        totalCustomers,
        newCustomersToday,
        currentRevenue,
        previousRevenue,
    ] = await Promise.all([
        prisma.booking.count({
            where: {
                ...bookingWhere,
                createdAt: { gte: today },
            },
        }),
        prisma.booking.count({
            where: {
                ...bookingWhere,
                createdAt: { gte: yesterday, lt: today },
            },
        }),
        prisma.booking.count({
            where: { ...bookingWhere, status: 'PENDING' },
        }),
        prisma.user.count({
            where: {
                role: 'CUSTOMER',
                ...(locationId ? { bookings: { some: { locationId } } } : {}),
            },
        }),
        prisma.user.count({
            where: {
                role: 'CUSTOMER',
                createdAt: { gte: today },
                ...(locationId ? { bookings: { some: { locationId } } } : {}),
            },
        }),
        prisma.payment.aggregate({
            where: {
                status: 'COMPLETED',
                paidAt: { gte: currentPeriodStart },
                ...(locationId ? { booking: { locationId } } : {}),
            },
            _sum: { amount: true },
        }),
        prisma.payment.aggregate({
            where: {
                status: 'COMPLETED',
                paidAt: { gte: previousPeriodStart, lte: previousPeriodEnd },
                ...(locationId ? { booking: { locationId } } : {}),
            },
            _sum: { amount: true },
        }),
    ])

    // Calculate booking change
    const bookingChange = todayBookings - yesterdayBookings
    const currentRevenueAmount = currentRevenue._sum.amount || 0
    const previousRevenueAmount = previousRevenue._sum.amount || 0

    return {
        todayBookings,
        bookingChange,
        pendingBookings,
        totalCustomers,
        newCustomersToday,
        currentRevenue: currentRevenueAmount,
        revenueChange: previousRevenueAmount === 0
            ? (currentRevenueAmount === 0 ? 0 : 100)
            : ((currentRevenueAmount - previousRevenueAmount) / previousRevenueAmount) * 100,
    }
}

async function getRecentBookings(locationId?: string | null) {
    const bookings = await prisma.booking.findMany({
        where: locationId ? { locationId } : undefined,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { name: true, email: true } },
            location: { select: { name: true } },
            room: { select: { name: true, type: true } },
        },
    })
    return bookings.map(b => ({
        ...b,
        combo: b.room ? { name: b.room.name } : { name: 'N/A' },
        totalAmount: b.estimatedAmount,
        user: {
            name: b.customerName || b.user?.name || 'Khách',
            email: b.customerEmail || b.user?.email || '',
        },
    }))
}

async function getChartData(locationId?: string | null) {
    const today = new Date()
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(today, 6 - i)
        return {
            start: startOfDay(date),
            end: endOfDay(date),
            label: format(date, 'dd/MM'),
        }
    })

    // Get revenue data for last 7 days
    const revenueData = await Promise.all(
        last7Days.map(async ({ start, end, label }) => {
            const payments = await prisma.payment.aggregate({
                where: {
                    status: 'COMPLETED',
                    paidAt: { gte: start, lte: end },
                    ...(locationId ? { booking: { locationId } } : {}),
                },
                _sum: { amount: true },
            })
            return {
                date: label,
                amount: payments._sum.amount || 0,
            }
        })
    )

    // Get booking data for last 7 days
    const bookingData = await Promise.all(
        last7Days.map(async ({ start, end, label }) => {
            const count = await prisma.booking.count({
                where: {
                    ...(locationId ? { locationId } : {}),
                    createdAt: { gte: start, lte: end },
                },
            })
            return {
                date: label,
                bookings: count,
            }
        })
    )

    // Get top rooms by bookings
    const roomStats = await prisma.room.findMany({
        where: locationId ? { locationId } : undefined,
        select: {
            name: true,
            _count: { select: { bookings: true } },
        },
        orderBy: {
            bookings: { _count: 'desc' },
        },
        take: 5,
    })

    const roomUsageData = roomStats.map(r => ({
        name: r.name,
        bookings: r._count.bookings,
    }))

    return { revenueData, bookingData, roomUsageData }
}

const statusLabels: Record<string, string> = {
    PENDING: 'Chờ cọc',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang sử dụng',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Không đến',
}

const statusStyles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    COMPLETED: 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    NO_SHOW: 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700',
}

const quickActions = [
    { name: 'Thêm bài viết', href: '/admin/posts/new', icon: NewspaperIcon, color: 'bg-blue-500', permission: 'canManagePosts' },
    { name: 'Upload Media', href: '/admin/media', icon: PhotoIcon, color: 'bg-purple-500', permission: 'canManageGallery' },
    { name: 'Quản lý Booking', href: '/admin/bookings', icon: CalendarDaysIcon, color: 'bg-emerald-500', permission: 'canViewBookings' },
    { name: 'Khách hàng', href: '/admin/customers', icon: UsersIcon, color: 'bg-orange-500', permission: 'canViewCustomers' },
]

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions)
    const role = session?.user?.role || ''
    const permissions = await getRolePermissions(role)
    const assignedLocationId = role === 'STAFF' || role === 'MANAGER'
        ? (session?.user as { assignedLocationId?: string | null } | undefined)?.assignedLocationId
        : null
    const [stats, recentBookings, chartData] = await Promise.all([
        getStats(assignedLocationId),
        getRecentBookings(assignedLocationId),
        getChartData(assignedLocationId),
    ])
    const can = (permission: AdminPermissionKey) => permissions[permission] === true
    const allowedQuickActions = quickActions.filter(action => can(action.permission as AdminPermissionKey))
    const revenueChange = `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

    const statCards = [
        {
            name: 'Doanh thu 7 ngày',
            value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.currentRevenue),
            change: revenueChange,
            trend: stats.revenueChange >= 0 ? 'up' : 'down',
            icon: BanknotesIcon,
            gradient: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            permission: 'canViewReports' as AdminPermissionKey,
        },
        {
            name: 'Booking hôm nay',
            value: stats.todayBookings.toString(),
            change: stats.bookingChange >= 0 ? `+${stats.bookingChange}` : stats.bookingChange.toString(),
            trend: stats.bookingChange >= 0 ? 'up' : 'down',
            icon: CalendarDaysIcon,
            gradient: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
            permission: 'canViewBookings' as AdminPermissionKey,
        },
        {
            name: 'Chờ xác nhận',
            value: stats.pendingBookings.toString(),
            change: stats.pendingBookings > 0 ? 'Cần xử lý' : 'OK',
            trend: stats.pendingBookings > 0 ? 'down' : 'up',
            icon: ClockIcon,
            gradient: 'from-amber-500 to-orange-600',
            bgColor: 'bg-amber-50 dark:bg-amber-900/20',
            iconColor: 'text-amber-600 dark:text-amber-400',
            permission: 'canViewBookings' as AdminPermissionKey,
        },
        {
            name: 'Tổng khách hàng',
            value: stats.totalCustomers.toString(),
            change: stats.newCustomersToday > 0 ? `+${stats.newCustomersToday} hôm nay` : '0 hôm nay',
            trend: 'up',
            icon: UsersIcon,
            gradient: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
            iconColor: 'text-purple-600 dark:text-purple-400',
            permission: 'canViewCustomers' as AdminPermissionKey,
        },
    ].filter(stat => can(stat.permission))

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        Xin chào! 👋
                    </h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        {format(new Date(), "EEEE, 'ngày' d MMMM yyyy", { locale: vi })}
                    </p>
                </div>
                {can('canManagePosts') && (
                    <Link
                        href="/admin/posts/new"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-xl"
                    >
                        <PlusIcon className="size-4" />
                        Thêm bài viết
                    </Link>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.name}
                        className="group relative overflow-hidden rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    >
                        <div className="flex items-start justify-between">
                            <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                                <stat.icon className={`size-6 ${stat.iconColor}`} />
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${stat.trend === 'up'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                }`}>
                                {stat.trend === 'up' ? (
                                    <ArrowTrendingUpIcon className="size-3" />
                                ) : (
                                    <ArrowTrendingDownIcon className="size-3" />
                                )}
                                {stat.change}
                            </span>
                        </div>
                        <div className="mt-4">
                            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</h3>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{stat.name}</p>
                        </div>
                        <div className={`absolute -right-8 -top-8 size-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            {(can('canViewReports') || can('canViewBookings')) && <div className="grid gap-6 lg:grid-cols-2">
                {/* Revenue Chart */}
                {can('canViewReports') && <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                <BanknotesIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-neutral-900 dark:text-white">Doanh thu 7 ngày</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Theo ngày</p>
                            </div>
                        </div>
                    </div>
                    <RevenueChart data={chartData.revenueData} />
                </div>}

                {/* Booking Chart */}
                {can('canViewBookings') && <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                                <CalendarDaysIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-neutral-900 dark:text-white">Booking 7 ngày</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Số lượng booking</p>
                            </div>
                        </div>
                    </div>
                    <BookingChart data={chartData.bookingData} />
                </div>}

                {/* Room Usage Chart */}
                {can('canViewBookings') && <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                                <ChartBarIcon className="size-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-neutral-900 dark:text-white">Phòng được đặt nhiều</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Top 5 phòng</p>
                            </div>
                        </div>
                    </div>
                    <RoomUsageChart data={chartData.roomUsageData} />
                </div>}
            </div>}

            {/* Quick Actions */}
            {allowedQuickActions.length > 0 && <div className="rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">Thao tác nhanh</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {allowedQuickActions.map((action) => (
                        <Link
                            key={action.name}
                            href={action.href}
                            className="group flex flex-col items-center gap-3 rounded-xl border border-neutral-200 p-4 transition-all hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                        >
                            <div className={`flex size-12 items-center justify-center rounded-xl ${action.color} text-white shadow-lg`}>
                                <action.icon className="size-6" />
                            </div>
                            <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-white">
                                {action.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>}

            {/* Recent Bookings */}
            {can('canViewBookings') && <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Booking gần đây</h2>
                    <Link
                        href="/admin/bookings"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                        Xem tất cả
                        <ArrowRightIcon className="size-4" />
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                <th className="px-6 py-4">Mã booking</th>
                                <th className="px-6 py-4">Khách hàng</th>
                                <th className="px-6 py-4">Dịch vụ</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Tổng tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {recentBookings.length > 0 ? (
                                recentBookings.map((booking) => (
                                    <tr key={booking.id} className="text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <Link
                                                href={`/admin/bookings`}
                                                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                            >
                                                {booking.bookingCode}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-white">
                                                    {booking.user.name?.[0] || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-neutral-900 dark:text-white">{booking.user.name}</p>
                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{booking.user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-neutral-900 dark:text-white">{booking.combo.name}</p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">{booking.location.name}</p>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[booking.status]}`}>
                                                <span className={`size-1.5 rounded-full ${booking.status === 'PENDING' ? 'bg-amber-500' :
                                                    booking.status === 'CONFIRMED' ? 'bg-blue-500' :
                                                        booking.status === 'IN_PROGRESS' ? 'bg-emerald-500' :
                                                            booking.status === 'COMPLETED' ? 'bg-neutral-500' :
                                                                'bg-red-500'
                                                    }`} />
                                                {statusLabels[booking.status]}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-neutral-900 dark:text-white">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(booking.totalAmount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <CalendarDaysIcon className="mx-auto size-12 text-neutral-300 dark:text-neutral-600" />
                                        <p className="mt-4 text-lg font-medium text-neutral-900 dark:text-white">Chưa có booking nào</p>
                                        <p className="mt-1 text-neutral-500 dark:text-neutral-400">Các booking sẽ xuất hiện ở đây</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}
        </div>
    )
}
