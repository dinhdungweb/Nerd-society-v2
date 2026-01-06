'use client'

import { useState, useEffect } from 'react'
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    BriefcaseIcon,
    MapPinIcon,
    ClockIcon,
    EyeIcon,
    XMarkIcon,
    CheckIcon,
    UserGroupIcon,
    MagnifyingGlassIcon,
    LinkIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import NcModal from '@/shared/NcModal'
import { Switch } from '@/shared/switch'

interface Job {
    id: string
    title: string
    slug: string
    description: string
    location: string
    workShift: string
    requirements: string
    benefits: string
    isActive: boolean
    sortOrder: number
    createdAt: string
    _count: { applications: number }
}

const defaultJob = {
    title: '',
    description: '',
    location: 'Cả hai',
    workShift: 'Linh hoạt',
    requirements: '',
    benefits: '',
    isActive: true,
    sortOrder: 0,
}

const locationOptions = ['Tây Sơn', 'Hồ Tùng Mậu', 'Cả hai']
const shiftOptions = ['Sáng', 'Chiều', 'Tối', 'Linh hoạt']

export default function AdminJobsPage() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [formData, setFormData] = useState(defaultJob)
    const [submitting, setSubmitting] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchJobs()
    }, [])

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/admin/jobs')
            const data = await res.json()
            setJobs(data)
        } catch (error) {
            console.error('Error fetching jobs:', error)
            toast.error('Không thể tải danh sách tuyển dụng')
        } finally {
            setLoading(false)
        }
    }

    const openAddModal = () => {
        setFormData(defaultJob)
        setIsEditing(false)
        setSelectedJob(null)
        setIsModalOpen(true)
    }

    const openEditModal = (job: Job) => {
        setFormData({
            title: job.title,
            description: job.description,
            location: job.location,
            workShift: job.workShift,
            requirements: job.requirements,
            benefits: job.benefits,
            isActive: job.isActive,
            sortOrder: job.sortOrder,
        })
        setSelectedJob(job)
        setIsEditing(true)
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title || !formData.description) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }

        setSubmitting(true)

        try {
            const url = isEditing ? `/api/admin/jobs/${selectedJob?.id}` : '/api/admin/jobs'
            const method = isEditing ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (res.ok) {
                toast.success(isEditing ? 'Cập nhật thành công!' : 'Tạo mới thành công!')
                setIsModalOpen(false)
                fetchJobs()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Có lỗi xảy ra')
            }
        } catch (error) {
            toast.error('Không thể lưu. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (job: Job) => {
        if (!confirm(`Bạn có chắc muốn xóa "${job.title}"?`)) {
            return
        }

        try {
            const res = await fetch(`/api/admin/jobs/${job.id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Đã xóa!')
                fetchJobs()
            } else {
                toast.error('Không thể xóa')
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
        }
    }

    const toggleActive = async (job: Job) => {
        try {
            const res = await fetch(`/api/admin/jobs/${job.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...job, isActive: !job.isActive }),
            })
            if (res.ok) {
                toast.success(job.isActive ? 'Đã ẩn' : 'Đã hiển thị')
                fetchJobs()
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
        }
    }

    const copyLink = (slug: string) => {
        const url = `${window.location.origin}/tuyen-dung/${slug}`
        navigator.clipboard.writeText(url)
        toast.success('Đã sao chép liên kết!')
    }

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex animate-pulse items-center justify-between">
                    <div className="h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-10 w-32 rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Tuyển dụng</h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        Quản lý các vị trí đang tuyển dụng
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm vị trí..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-full w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white sm:w-64"
                        />
                    </div>
                    <button
                        onClick={openAddModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-medium text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-600"
                    >
                        <PlusIcon className="size-5" />
                        Thêm vị trí
                    </button>
                </div>
            </div>

            {/* Jobs List */}
            {filteredJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-12 text-center dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <BriefcaseIcon className="size-8 text-neutral-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
                        {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có vị trí tuyển dụng'}
                    </h3>
                    <p className="max-w-md text-neutral-500 dark:text-neutral-400">
                        {searchTerm ? `Không tìm thấy công việc nào phù hợp với "${searchTerm}"` : 'Bắt đầu bằng cách thêm vị trí tuyển dụng đầu tiên'}
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={openAddModal}
                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-primary-600"
                        >
                            <PlusIcon className="size-5" />
                            Thêm vị trí ngay
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.map(job => (
                        <div
                            key={job.id}
                            className={`group flex flex-col bg-white dark:bg-neutral-900 border rounded-2xl p-5 hover:shadow-lg transition-all ${job.isActive
                                ? 'border-neutral-200 dark:border-neutral-800'
                                : 'border-neutral-200 bg-neutral-50/50 opacity-75 dark:border-neutral-800 dark:bg-neutral-900/50'
                                }`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center size-10 rounded-xl bg-primary-100 dark:bg-primary-900/30">
                                        <BriefcaseIcon className="size-5 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-neutral-900 dark:text-white">
                                            {job.title}
                                        </h3>
                                        {!job.isActive && (
                                            <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                                Đang ẩn
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-4">
                                {/* Info Tags */}
                                <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                    <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 rounded">
                                        <MapPinIcon className="size-3.5" />
                                        <span>{job.location}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 rounded">
                                        <ClockIcon className="size-3.5" />
                                        <span>Ca {job.workShift}</span>
                                    </div>
                                </div>

                                {/* Applications Count */}
                                <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 space-y-1">
                                    <p className="text-xs text-primary-600 dark:text-primary-400">Số đơn ứng tuyển</p>
                                    <p className="font-semibold text-primary-700 dark:text-primary-300">
                                        {job._count.applications} ứng viên
                                    </p>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                <div title={job.isActive ? 'Đang hiển thị' : 'Đang ẩn'}>
                                    <Switch
                                        checked={job.isActive}
                                        onChange={() => toggleActive(job)}
                                        color="emerald"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(job)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-500 transition-colors"
                                    >
                                        <PencilIcon className="size-4" />
                                        <span>Sửa</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(job)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-500 transition-colors"
                                    >
                                        <TrashIcon className="size-4" />
                                        <span>Xóa</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <NcModal
                isOpenProp={isModalOpen}
                onCloseModal={() => setIsModalOpen(false)}
                modalTitle={isEditing ? 'Chỉnh sửa vị trí' : 'Thêm vị trí mới'}
                renderTrigger={() => null}
                renderContent={() => (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Tên vị trí <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="block w-full rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    placeholder="VD: Barista, Quản lý..."
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Địa điểm
                                    </label>
                                    <select
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        className="block w-full rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    >
                                        {locationOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Ca làm việc
                                    </label>
                                    <select
                                        value={formData.workShift}
                                        onChange={e => setFormData({ ...formData, workShift: e.target.value })}
                                        className="block w-full rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    >
                                        {shiftOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Mô tả công việc <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    className="block w-full resize-none rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    placeholder="Mô tả chi tiết về công việc..."
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Yêu cầu
                                </label>
                                <textarea
                                    value={formData.requirements}
                                    onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                                    rows={3}
                                    className="block w-full resize-none rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    placeholder="Các yêu cầu đối với ứng viên..."
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Quyền lợi
                                </label>
                                <textarea
                                    value={formData.benefits}
                                    onChange={e => setFormData({ ...formData, benefits: e.target.value })}
                                    rows={3}
                                    className="block w-full resize-none rounded-xl border-neutral-200 bg-white focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                                    placeholder="Quyền lợi cho ứng viên..."
                                />
                            </div>

                            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="size-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Hiển thị công khai trên trang tuyển dụng
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 rounded-xl border border-neutral-300 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 py-3 font-medium text-white transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="size-5" />
                                        {isEditing ? 'Cập nhật' : 'Tạo mới'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            />
        </div>
    )
}
