'use client'

import { useState, useEffect, useCallback, useDeferredValue } from 'react'
import {
    MagnifyingGlassIcon,
    UserIcon,
    EnvelopeIcon,
    PhoneIcon,
    CalendarDaysIcon,
    XMarkIcon,
    ArrowDownTrayIcon,
    CheckBadgeIcon,
    MapPinIcon,
    BriefcaseIcon,
    AcademicCapIcon,
    SparklesIcon,
    CakeIcon,
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import NcModal from '@/shared/NcModal'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { AdminErrorState, AdminLoadingState, AdminPagination } from '@/components/admin/ui'

interface Customer {
    id: string
    name: string
    email: string
    phone: string | null
    avatar: string | null
    createdAt: string
    // V2 fields
    region: string | null
    occupation: string | null
    school?: string | null
    visitPurpose?: string[]
    profileCompletedAt: string | null
    gender?: string | null
    dateOfBirth?: string | null
    address?: string | null
    bio?: string | null
    nerdCoinBalance?: number
    nerdCoinTier?: string
    _count: { bookings: number }
    bookings?: Booking[]
}

interface Booking {
    id: string
    bookingCode: string
    date: string
    startTime: string
    endTime: string
    status: string
    estimatedAmount: number
    room: { name: string }
    location: { name: string }
}

interface CustomersResponse {
    data: Customer[]
    pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
    stats: {
        total: number
        completed: number
        incomplete: number
        regions: string[]
        occupations: string[]
    }
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
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    IN_PROGRESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    COMPLETED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    NO_SHOW: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-500',
}

export default function CustomersPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const deferredSearch = useDeferredValue(searchQuery)
    const [currentPage, setCurrentPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1))
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'bookings'>((searchParams.get('sortBy') as 'name' | 'createdAt' | 'bookings') || 'createdAt')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc')
    // V2 Filters
    const [filterRegion, setFilterRegion] = useState(searchParams.get('region') || '')
    const [filterOccupation, setFilterOccupation] = useState(searchParams.get('occupation') || '')
    const [filterProfileCompleted, setFilterProfileCompleted] = useState<'all' | 'completed' | 'incomplete'>((searchParams.get('profile') as 'all' | 'completed' | 'incomplete') || 'all')
    const [pagination, setPagination] = useState<CustomersResponse['pagination']>({ page: currentPage, pageSize: 10, total: 0, totalPages: 1 })
    const [stats, setStats] = useState<CustomersResponse['stats']>({ total: 0, completed: 0, incomplete: 0, regions: [], occupations: [] })

    const fetchCustomers = useCallback(async () => {
        setRefreshing(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                pageSize: '10',
                sortBy,
                sortOrder,
            })
            if (deferredSearch) params.set('q', deferredSearch)
            if (filterRegion) params.set('region', filterRegion)
            if (filterOccupation) params.set('occupation', filterOccupation)
            if (filterProfileCompleted !== 'all') params.set('profile', filterProfileCompleted)

            const res = await fetch(`/api/admin/customers?${params.toString()}`)
            if (!res.ok) throw new Error('Không thể tải danh sách khách hàng')

            const result: CustomersResponse = await res.json()
            setCustomers(result.data)
            setPagination(result.pagination)
            setStats(result.stats)
        } catch (error) {
            console.error('Error fetching customers:', error)
            setError(error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [currentPage, deferredSearch, filterOccupation, filterProfileCompleted, filterRegion, sortBy, sortOrder])

    useEffect(() => {
        fetchCustomers()
    }, [fetchCustomers])

    useEffect(() => {
        const params = new URLSearchParams()
        if (deferredSearch) params.set('q', deferredSearch)
        if (currentPage > 1) params.set('page', String(currentPage))
        if (sortBy !== 'createdAt') params.set('sortBy', sortBy)
        if (sortOrder !== 'desc') params.set('sortOrder', sortOrder)
        if (filterRegion) params.set('region', filterRegion)
        if (filterOccupation) params.set('occupation', filterOccupation)
        if (filterProfileCompleted !== 'all') params.set('profile', filterProfileCompleted)
        const nextUrl = params.size ? `${pathname}?${params.toString()}` : pathname
        router.replace(nextUrl, { scroll: false })
    }, [currentPage, deferredSearch, filterOccupation, filterProfileCompleted, filterRegion, pathname, router, sortBy, sortOrder])

    const fetchCustomerDetail = async (customerId: string) => {
        setLoadingDetail(true)
        try {
            const res = await fetch(`/api/admin/customers/${customerId}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedCustomer(data)
            } else throw new Error('Không thể tải chi tiết khách hàng')
        } catch (error) {
            console.error('Error fetching customer detail:', error)
            toast.error('Không thể tải chi tiết khách hàng')
        } finally {
            setLoadingDetail(false)
        }
    }

    const openCustomerModal = (customer: Customer) => {
        setSelectedCustomer(customer)
        setIsModalOpen(true)
        fetchCustomerDetail(customer.id)
    }

    useEffect(() => {
        setCurrentPage(1)
    }, [deferredSearch, filterOccupation, filterProfileCompleted, filterRegion, sortBy, sortOrder])

    if (loading) return <AdminLoadingState label="Đang tải danh sách khách hàng..." />
    if (error && customers.length === 0) return <AdminErrorState description={error} onRetry={fetchCustomers} />

    return (
        <div className="space-y-6">
            {/* V2 Stats Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <UserIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-neutral-500">Tổng khách hàng</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckBadgeIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.completed}</p>
                            <p className="text-xs text-neutral-500">Đã hoàn thiện hồ sơ</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <MapPinIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.regions.length}</p>
                            <p className="text-xs text-neutral-500">Khu vực</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            <BriefcaseIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.occupations.length}</p>
                            <p className="text-xs text-neutral-500">Nghề nghiệp</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Khách hàng</h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        {pagination.total} khách hàng {refreshing && '• Đang cập nhật...'}
                    </p>
                </div>

                {/* Desktop: Search and Actions */}
                <div className="hidden sm:flex items-center gap-3">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Tìm tên, email, SĐT..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-64 rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <XMarkIcon className="size-4" />
                            </button>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={e => {
                            const [field, order] = e.target.value.split('-')
                            setSortBy(field as any)
                            setSortOrder(order as any)
                        }}
                        className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="createdAt-desc">Mới nhất</option>
                        <option value="createdAt-asc">Cũ nhất</option>
                        <option value="name-asc">Tên A-Z</option>
                        <option value="name-desc">Tên Z-A</option>
                        <option value="bookings-desc">Booking nhiều nhất</option>
                    </select>

                    {/* V2 Filter: Profile Status */}
                    <select
                        value={filterProfileCompleted}
                        onChange={e => setFilterProfileCompleted(e.target.value as any)}
                        className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="all">Tất cả hồ sơ</option>
                        <option value="completed">Đã hoàn thiện</option>
                        <option value="incomplete">Chưa hoàn thiện</option>
                    </select>

                    {/* V2 Filter: Region */}
                    {stats.regions.length > 0 && (
                        <select
                            value={filterRegion}
                            onChange={e => setFilterRegion(e.target.value)}
                            className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        >
                            <option value="">Tất cả khu vực</option>
                            {stats.regions.map(r => (
                                <option key={r} value={r!}>{r}</option>
                            ))}
                        </select>
                    )}

                    {/* V2 Filter: Occupation */}
                    {stats.occupations.length > 0 && (
                        <select
                            value={filterOccupation}
                            onChange={e => setFilterOccupation(e.target.value)}
                            className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        >
                            <option value="">Tất cả nghề nghiệp</option>
                            {stats.occupations.map(o => (
                                <option key={o} value={o!}>{o}</option>
                            ))}
                        </select>
                    )}

                    {/* Export Button */}
                    <a
                        href="/api/admin/export?type=customers"
                        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                        <ArrowDownTrayIcon className="size-5" />
                        Export
                    </a>
                </div>

                {/* Mobile: Actions row */}
                <div className="flex sm:hidden items-center gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <XMarkIcon className="size-4" />
                            </button>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={e => {
                            const [field, order] = e.target.value.split('-')
                            setSortBy(field as any)
                            setSortOrder(order as any)
                        }}
                        className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="createdAt-desc">Mới nhất</option>
                        <option value="createdAt-asc">Cũ nhất</option>
                        <option value="name-asc">A-Z</option>
                        <option value="name-desc">Z-A</option>
                        <option value="bookings-desc">Nhiều booking</option>
                    </select>

                    {/* Export Button */}
                    <a
                        href="/api/admin/export?type=customers"
                        className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-700 transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                        <ArrowDownTrayIcon className="size-5" />
                    </a>
                </div>
            </div>

            {/* Customers List - Desktop */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {customers.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400 grid grid-cols-12">
                            <div className="col-span-4">Khách hàng</div>
                            <div className="col-span-3">Email</div>
                            <div className="col-span-2">Số điện thoại</div>
                            <div className="col-span-1 text-center">Booking</div>
                            <div className="col-span-2 text-right">Ngày tham gia</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {customers.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => openCustomerModal(customer)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            openCustomerModal(customer)
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Xem chi tiết khách hàng ${customer.name}`}
                                    className="grid cursor-pointer grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                                >
                                    {/* Customer Info */}
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
                                            {customer.avatar ? (
                                                <img src={customer.avatar} alt="" className="size-10 rounded-full object-cover" />
                                            ) : (
                                                customer.name[0]?.toUpperCase() || 'U'
                                            )}
                                        </div>
                                        <span className="font-medium text-neutral-900 dark:text-white">
                                            {customer.name}
                                        </span>
                                    </div>

                                    {/* Email */}
                                    <div className="col-span-3 text-sm text-neutral-600 dark:text-neutral-400">
                                        {customer.email}
                                    </div>

                                    {/* Phone */}
                                    <div className="col-span-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        {customer.phone || '-'}
                                    </div>

                                    {/* Bookings Count */}
                                    <div className="col-span-1 text-center">
                                        <span className="inline-flex rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                            {customer._count.bookings}
                                        </span>
                                    </div>

                                    {/* Created Date */}
                                    <div className="col-span-2 text-right text-sm text-neutral-500 dark:text-neutral-400">
                                        {new Date(customer.createdAt).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="px-6 py-16 text-center">
                        <UserIcon className="mx-auto size-12 text-neutral-300 dark:text-neutral-600" />
                        <p className="mt-4 text-lg font-medium text-neutral-900 dark:text-white">
                            {searchQuery ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}
                        </p>
                        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                            {searchQuery ? 'Thử tìm với từ khóa khác' : 'Khách hàng sẽ xuất hiện ở đây sau khi đăng ký'}
                        </p>
                    </div>
                )}
            </div>

            {/* Customers List - Mobile Cards */}
            <div className="md:hidden space-y-3">
                {customers.length > 0 ? (
                    customers.map(customer => (
                        <div
                            key={customer.id}
                            onClick={() => openCustomerModal(customer)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    openCustomerModal(customer)
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Xem chi tiết khách hàng ${customer.name}`}
                            className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
                                        {customer.avatar ? (
                                            <img src={customer.avatar} alt="" className="size-10 rounded-full object-cover" />
                                        ) : (
                                            customer.name[0]?.toUpperCase() || 'U'
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-white">{customer.name}</p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{customer.email}</p>
                                    </div>
                                </div>
                                <span className="inline-flex rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                    {customer._count.bookings} booking
                                </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                                <div className="flex items-center gap-4 text-sm">
                                    {customer.phone && (
                                        <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
                                            <PhoneIcon className="size-4" />
                                            {customer.phone}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {new Date(customer.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
                        <UserIcon className="mx-auto size-12 text-neutral-300 dark:text-neutral-600" />
                        <p className="mt-4 text-lg font-medium text-neutral-900 dark:text-white">
                            {searchQuery ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}
                        </p>
                        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                            {searchQuery ? 'Thử tìm với từ khóa khác' : 'Khách hàng sẽ xuất hiện ở đây sau khi đăng ký'}
                        </p>
                    </div>
                )}
            </div>

            <AdminPagination
                page={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                summary={pagination.total > 0
                    ? `Hiển thị ${(currentPage - 1) * pagination.pageSize + 1}-${Math.min(currentPage * pagination.pageSize, pagination.total)} / ${pagination.total} khách hàng`
                    : '0 khách hàng'}
            />

            {/* Customer Detail Modal */}
            <NcModal
                isOpenProp={isModalOpen}
                onCloseModal={() => setIsModalOpen(false)}
                modalTitle="Thông tin khách hàng"
                renderTrigger={() => null}
                renderContent={() => (
                    <div className="space-y-6">
                        {selectedCustomer && (
                            <>
                                {/* Header Profile Card */}
                                <div className="flex items-center gap-5 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800">
                                    <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-3xl font-bold text-white">
                                        {selectedCustomer.avatar ? (
                                            <img src={selectedCustomer.avatar} alt="" className="size-20 rounded-full object-cover" />
                                        ) : (
                                            selectedCustomer.name[0]?.toUpperCase() || 'U'
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                                                {selectedCustomer.name}
                                            </h3>
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${selectedCustomer.nerdCoinTier === 'GOLD'
                                                ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                                : selectedCustomer.nerdCoinTier === 'SILVER'
                                                    ? 'bg-neutral-100 text-neutral-700 ring-neutral-500/20'
                                                    : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                                                }`}>
                                                {selectedCustomer.nerdCoinTier || 'BRONZE'} MEMBER
                                            </span>
                                            {selectedCustomer.dateOfBirth && selectedCustomer.region && selectedCustomer.occupation && selectedCustomer.visitPurpose && selectedCustomer.visitPurpose.length > 0 ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30">
                                                    HỒ SƠ ĐÃ HOÀN THIỆN
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/30">
                                                    HỒ SƠ CHƯA HOÀN THIỆN
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                                            <div className="flex items-center gap-1.5">
                                                <EnvelopeIcon className="size-4" />
                                                {selectedCustomer.email}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <PhoneIcon className="size-4" />
                                                {selectedCustomer.phone || 'Chưa cập nhật'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
                                        <p className="text-xs text-neutral-500">Booking</p>
                                        <p className="font-semibold text-neutral-900 dark:text-white">{selectedCustomer._count.bookings}</p>
                                    </div>
                                    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
                                        <p className="text-xs text-neutral-500">Nerd Coin</p>
                                        <p className="font-semibold text-primary-600">{selectedCustomer.nerdCoinBalance?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
                                        <p className="text-xs text-neutral-500">Ngày tham gia</p>
                                        <p className="font-semibold text-neutral-900 dark:text-white">{new Date(selectedCustomer.createdAt).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    {/* Personal Info */}
                                    <div className="flex flex-col gap-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                                            <UserIcon className="size-4" /> Thông tin cá nhân
                                        </h4>
                                        <div className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Họ và tên:</span>
                                                    <span className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Email:</span>
                                                    <span className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.email}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Số điện thoại:</span>
                                                    <span className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.phone || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Giới tính:</span>
                                                    <span className="font-medium text-neutral-900 dark:text-white">
                                                        {selectedCustomer.gender === 'Male' ? 'Nam' : selectedCustomer.gender === 'Female' ? 'Nữ' : selectedCustomer.gender || '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Ngày sinh:</span>
                                                    <span className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.dateOfBirth ? new Date(selectedCustomer.dateOfBirth).toLocaleDateString('vi-VN') : '-'}</span>
                                                </div>
                                                {selectedCustomer.bio && (
                                                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                                        <p className="text-neutral-500 mb-1">Giới thiệu:</p>
                                                        <p className="text-neutral-700 dark:text-neutral-300 italic">"{selectedCustomer.bio}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Membership Profile */}
                                    <div className="flex flex-col gap-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                                            <CheckBadgeIcon className="size-4" /> Hồ sơ thành viên
                                        </h4>
                                        <div className="flex-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <MapPinIcon className="size-4 shrink-0 text-neutral-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-neutral-500 text-xs">Khu vực</p>
                                                        <p className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.region || '-'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <BriefcaseIcon className="size-4 shrink-0 text-neutral-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-neutral-500 text-xs">Nghề nghiệp</p>
                                                        <p className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.occupation || '-'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <AcademicCapIcon className="size-4 shrink-0 text-neutral-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-neutral-500 text-xs">Trường học</p>
                                                        <p className="font-medium text-neutral-900 dark:text-white">{selectedCustomer.school || '-'}</p>
                                                    </div>
                                                </div>
                                                {selectedCustomer.visitPurpose && selectedCustomer.visitPurpose.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {selectedCustomer.visitPurpose.map(p => (
                                                            <span key={p} className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Booking History */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                                        <CalendarDaysIcon className="size-4" /> Lịch sử đặt phòng
                                    </h4>
                                    {loadingDetail ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                                            ))}
                                        </div>
                                    ) : selectedCustomer.bookings && selectedCustomer.bookings.length > 0 ? (
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {selectedCustomer.bookings.map(booking => (
                                                <div key={booking.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm hover:border-primary-200 dark:border-neutral-800 dark:bg-neutral-900">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-neutral-900 dark:text-white">{booking.bookingCode}</span>
                                                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${statusStyles[booking.status]}`}>
                                                                {statusLabels[booking.status]}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-neutral-500 mt-0.5">
                                                            {new Date(booking.date).toLocaleDateString('vi-VN')} • {booking.startTime}-{booking.endTime}
                                                        </div>
                                                    </div>
                                                    <div className="text-right font-medium text-primary-600">
                                                        {new Intl.NumberFormat('vi-VN').format(booking.estimatedAmount)}đ
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-800">
                                            Chưa có lịch sử đặt phòng
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            />
        </div>
    )
}
