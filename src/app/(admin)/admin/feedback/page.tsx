'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ChatBubbleLeftRightIcon,
    EyeIcon,
    TrashIcon,
    XMarkIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    StarIcon,
    HomeIcon,
    UserGroupIcon,
    LightBulbIcon,
    DocumentTextIcon,
    PhoneIcon,
    EnvelopeIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import NcModal from '@/shared/NcModal'

interface Feedback {
    id: string
    userId: string | null
    name: string
    email: string | null
    phone: string | null
    type: 'SERVICE_QUALITY' | 'FACILITIES' | 'STAFF_ATTITUDE' | 'SUGGESTION' | 'OTHER'
    subject: string | null
    content: string
    images: string[]
    status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'IGNORED'
    adminNote: string | null
    createdAt: string
}

const statusOptions = [
    { value: 'PENDING', label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20', icon: ClockIcon },
    { value: 'REVIEWED', label: 'Đã xem', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20', icon: EyeIcon },
    { value: 'RESOLVED', label: 'Đã giải quyết', color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20', icon: CheckCircleIcon },
    { value: 'IGNORED', label: 'Bỏ qua', color: 'bg-neutral-100 text-neutral-500 ring-1 ring-neutral-500/10 dark:bg-neutral-700 dark:text-neutral-400 dark:ring-neutral-400/20', icon: ExclamationTriangleIcon },
]

const typeLabels: Record<string, { label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string }> = {
    SERVICE_QUALITY: { label: 'Chất lượng dịch vụ', Icon: StarIcon, color: 'text-amber-500' },
    FACILITIES: { label: 'Cơ sở vật chất', Icon: HomeIcon, color: 'text-blue-500' },
    STAFF_ATTITUDE: { label: 'Thái độ nhân viên', Icon: UserGroupIcon, color: 'text-purple-500' },
    SUGGESTION: { label: 'Đề xuất', Icon: LightBulbIcon, color: 'text-emerald-500' },
    OTHER: { label: 'Khác', Icon: DocumentTextIcon, color: 'text-neutral-500' },
}

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [adminNote, setAdminNote] = useState('')

    useEffect(() => {
        fetchFeedbacks()
    }, [filterStatus, filterType])

    const fetchFeedbacks = async () => {
        try {
            const params = new URLSearchParams()
            if (filterStatus) params.append('status', filterStatus)
            if (filterType) params.append('type', filterType)

            const res = await fetch(`/api/admin/feedbacks?${params}`)
            const data = await res.json()
            setFeedbacks(data.feedbacks || [])
        } catch (error) {
            console.error('Error fetching feedbacks:', error)
            toast.error('Không thể tải dữ liệu')
        } finally {
            setLoading(false)
        }
    }

    const openDetailModal = (feedback: Feedback) => {
        setSelectedFeedback(feedback)
        setAdminNote(feedback.adminNote || '')
        setIsModalOpen(true)
    }

    const updateStatus = async (feedbackId: string, status: string) => {
        try {
            const res = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })

            if (res.ok) {
                toast.success('Đã cập nhật trạng thái')
                fetchFeedbacks()
                if (selectedFeedback?.id === feedbackId) {
                    setSelectedFeedback({ ...selectedFeedback, status: status as Feedback['status'] })
                }
            } else {
                toast.error('Không thể cập nhật')
            }
        } catch {
            toast.error('Có lỗi xảy ra')
        }
    }

    const saveNotes = async () => {
        if (!selectedFeedback) return
        try {
            const res = await fetch(`/api/admin/feedbacks/${selectedFeedback.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNote }),
            })

            if (res.ok) {
                toast.success('Đã lưu ghi chú')
                fetchFeedbacks()
            } else {
                toast.error('Không thể lưu')
            }
        } catch {
            toast.error('Có lỗi xảy ra')
        }
    }

    const deleteFeedback = async (feedbackId: string) => {
        if (!confirm('Bạn có chắc muốn xóa góp ý này?')) return
        try {
            const res = await fetch(`/api/admin/feedbacks/${feedbackId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Đã xóa góp ý')
                fetchFeedbacks()
                setIsModalOpen(false)
            } else {
                toast.error('Không thể xóa')
            }
        } catch {
            toast.error('Có lỗi xảy ra')
        }
    }

    const filteredFeedbacks = useMemo(() => {
        if (!searchTerm) return feedbacks
        const query = searchTerm.toLowerCase()
        return feedbacks.filter(
            (f) =>
                f.name.toLowerCase().includes(query) ||
                f.content.toLowerCase().includes(query) ||
                f.email?.toLowerCase().includes(query) ||
                f.phone?.includes(query)
        )
    }, [feedbacks, searchTerm])

    // Stats
    const stats = useMemo(() => ({
        total: feedbacks.length,
        pending: feedbacks.filter((f) => f.status === 'PENDING').length,
        resolved: feedbacks.filter((f) => f.status === 'RESOLVED').length,
    }), [feedbacks])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                    ))}
                </div>
                <div className="h-96 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý góp ý</h1>
                    <p className="text-sm text-neutral-500">{stats.total} góp ý • {stats.pending} chờ xử lý</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <ChatBubbleLeftRightIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-neutral-500">Tổng góp ý</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <ClockIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.pending}</p>
                            <p className="text-xs text-neutral-500">Chờ xử lý</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircleIcon className="size-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.resolved}</p>
                            <p className="text-xs text-neutral-500">Đã giải quyết</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, email, SĐT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <FunnelIcon className="size-5 text-neutral-400" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-xl border border-neutral-200 bg-white pl-3 pr-10 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="">Tất cả trạng thái</option>
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="rounded-xl border border-neutral-200 bg-white pl-3 pr-10 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="">Tất cả loại</option>
                        {Object.entries(typeLabels).map(([value, { label }]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Feedback List - Grid View */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredFeedbacks.length === 0 ? (
                    <div className="col-span-full rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-20 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
                        <div className="mb-6 flex size-20 items-center justify-center mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <ChatBubbleLeftRightIcon className="size-10 text-neutral-400" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
                            Chưa có góp ý nào
                        </h3>
                        <p className="max-w-md mx-auto text-neutral-500 dark:text-neutral-400">
                            Hiện tại chưa có góp ý nào phù hợp với bộ lọc.
                        </p>
                    </div>
                ) : (
                    filteredFeedbacks.map((feedback) => {
                        const statusOpt = statusOptions.find((s) => s.value === feedback.status)
                        const typeInfo = typeLabels[feedback.type]
                        const TypeIcon = typeInfo?.Icon
                        return (
                            <div
                                key={feedback.id}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 transition-all hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-500/30"
                            >
                                <div>
                                    <div className="mb-4 flex items-start justify-between gap-2">
                                        <div className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold ${statusOpt?.color}`}>
                                            {statusOpt?.icon && <statusOpt.icon className="size-3.5" />}
                                            {statusOpt?.label}
                                        </div>
                                        <span className="text-xs text-neutral-400">
                                            {new Date(feedback.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <div className="mb-2 flex items-center gap-2">
                                            {TypeIcon && <TypeIcon className={`size-5 ${typeInfo?.color}`} />}
                                            <h3 className="font-bold text-neutral-900 dark:text-white">
                                                {typeInfo?.label}
                                            </h3>
                                        </div>
                                        {feedback.subject && (
                                            <p className="font-medium text-neutral-800 dark:text-neutral-200 line-clamp-1">
                                                {feedback.subject}
                                            </p>
                                        )}
                                    </div>

                                    <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                                        {feedback.content}
                                    </p>

                                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                        <div className="flex size-6 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                                            <span className="uppercase">{feedback.name.charAt(0)}</span>
                                        </div>
                                        <span className="truncate">{feedback.name}</span>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                    <button
                                        onClick={() => openDetailModal(feedback)}
                                        className="flex-1 rounded-xl bg-neutral-50 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
                                    >
                                        Chi tiết
                                    </button>
                                    <button
                                        onClick={() => deleteFeedback(feedback.id)}
                                        className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                        title="Xóa"
                                    >
                                        <TrashIcon className="size-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Detail Modal */}
            <NcModal
                isOpenProp={isModalOpen}
                onCloseModal={() => setIsModalOpen(false)}
                modalTitle="Chi tiết góp ý"
                renderContent={() => {
                    if (!selectedFeedback) return null
                    const typeInfo = typeLabels[selectedFeedback.type]
                    const statusOpt = statusOptions.find(s => s.value === selectedFeedback.status)

                    return (
                        <div className="flex flex-col gap-6">
                            {/* Header Section: Name, Type, Status */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100 text-2xl font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                        {selectedFeedback.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                                            {selectedFeedback.name}
                                        </h3>
                                        <p className="font-medium text-neutral-500 dark:text-neutral-400">
                                            Góp ý: <span className="text-neutral-900 dark:text-white">{typeInfo?.label}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusOpt?.color}`}>
                                    {statusOpt?.icon && <statusOpt.icon className="size-4" />}
                                    {statusOpt?.label}
                                </div>
                            </div>

                            <hr className="border-neutral-100 dark:border-neutral-800" />

                            {/* Info Section - 2 Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Contact Info */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Thông tin liên hệ</h4>
                                    <div className="space-y-3">
                                        {/* Phone */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                                <PhoneIcon className="size-4" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs text-neutral-500">Số điện thoại</p>
                                                <p className="font-medium text-neutral-900 dark:text-white truncate">
                                                    {selectedFeedback.phone || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Email */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                                <EnvelopeIcon className="size-4" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs text-neutral-500">Email</p>
                                                <p className="font-medium text-neutral-900 dark:text-white truncate">
                                                    {selectedFeedback.email || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Subject Info */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Chủ đề</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                                {typeInfo?.Icon && <typeInfo.Icon className="size-4" />}
                                            </div>
                                            <div>
                                                <p className="text-xs text-neutral-500">Loại góp ý</p>
                                                <p className="font-medium text-neutral-900 dark:text-white">
                                                    {typeInfo?.label}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                                <DocumentTextIcon className="size-4" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs text-neutral-500">Tiêu đề</p>
                                                <p className="font-medium text-neutral-900 dark:text-white truncate" title={selectedFeedback.subject || ''}>
                                                    {selectedFeedback.subject || 'Không có tiêu đề'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                                <div className="flex items-start gap-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-neutral-800">
                                        <ChatBubbleLeftRightIcon className="size-5 text-primary-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="mb-2 font-medium text-neutral-900 dark:text-white">Nội dung góp ý</p>
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                                            {selectedFeedback.content}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions & Notes Group */}
                            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Cập nhật trạng thái</label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {statusOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateStatus(selectedFeedback.id, opt.value)}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${selectedFeedback.status === opt.value
                                                    ? opt.color + ' ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm'
                                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Ghi chú nội bộ
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={adminNote}
                                            onChange={(e) => setAdminNote(e.target.value)}
                                            className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                                            placeholder="Nhập ghi chú..."
                                        />
                                        <button
                                            onClick={saveNotes}
                                            className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="flex justify-between text-xs text-neutral-400">
                                <span>ID: {selectedFeedback.id.slice(0, 8)}...</span>
                                <span>Đã gửi: {new Date(selectedFeedback.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                        </div>
                    )
                }}
            />
        </div>
    )
}
