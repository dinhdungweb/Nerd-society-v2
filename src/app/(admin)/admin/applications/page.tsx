'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    UserGroupIcon,
    PhoneIcon,
    EnvelopeIcon,
    MapPinIcon,
    ClockIcon,
    DocumentIcon,
    CheckIcon,
    XMarkIcon,
    FunnelIcon,
    BriefcaseIcon,
    EyeIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import NcModal from '@/shared/NcModal'

interface Job {
    id: string
    title: string
}

interface Application {
    id: string
    jobId: string
    job: Job
    name: string
    phone: string
    email: string | null
    preferredLocation: string
    cvUrl: string | null
    availability: string | null
    status: 'NEW' | 'REVIEWING' | 'INTERVIEWED' | 'ACCEPTED' | 'REJECTED'
    notes: string | null
    createdAt: string
}

const statusOptions = [
    { value: 'NEW', label: 'Mới', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20' },
    { value: 'REVIEWING', label: 'Đang xem xét', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20' },
    { value: 'INTERVIEWED', label: 'Đã phỏng vấn', color: 'bg-purple-50 text-purple-700 ring-1 ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/20' },
    { value: 'ACCEPTED', label: 'Đã nhận', color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20' },
    { value: 'REJECTED', label: 'Từ chối', color: 'bg-red-50 text-red-700 ring-1 ring-red-700/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20' },
]

export default function AdminApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [filterJob, setFilterJob] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        fetchData()
    }, [filterJob, filterStatus])

    const fetchData = async () => {
        try {
            const params = new URLSearchParams()
            if (filterJob) params.append('jobId', filterJob)
            if (filterStatus) params.append('status', filterStatus)

            const [appsRes, jobsRes] = await Promise.all([
                fetch(`/api/admin/applications?${params}`),
                fetch('/api/admin/jobs'),
            ])

            const appsData = await appsRes.json()
            const jobsData = await jobsRes.json()

            setApplications(appsData)
            setJobs(jobsData)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Không thể tải dữ liệu')
        } finally {
            setLoading(false)
        }
    }

    const openDetailModal = (app: Application) => {
        setSelectedApp(app)
        setNotes(app.notes || '')
        setIsModalOpen(true)
    }

    const updateStatus = async (appId: string, status: string) => {
        try {
            const res = await fetch(`/api/admin/applications/${appId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })

            if (res.ok) {
                toast.success('Cập nhật thành công!')
                fetchData()
                if (selectedApp?.id === appId) {
                    setSelectedApp({ ...selectedApp, status: status as any })
                }
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
        }
    }

    const saveNotes = async () => {
        if (!selectedApp) return

        try {
            const res = await fetch(`/api/admin/applications/${selectedApp.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            })

            if (res.ok) {
                toast.success('Đã lưu ghi chú!')
                fetchData()
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
        }
    }

    const getStatusBadge = (status: string) => {
        const opt = statusOptions.find(o => o.value === status)
        return opt || statusOptions[0]
    }

    const filteredApplications = applications.filter(app => {
        const searchLower = searchTerm.toLowerCase()
        return (
            app.name.toLowerCase().includes(searchLower) ||
            app.phone.includes(searchLower) ||
            (app.email && app.email.toLowerCase().includes(searchLower))
        )
    })

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex animate-pulse items-center justify-between">
                    <div className="h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-10 w-64 rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
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
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Đơn ứng tuyển</h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        {applications.length} đơn ứng tuyển
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Tìm tên, SĐT, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white sm:w-64"
                        />
                    </div>

                    <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />

                    <select
                        value={filterJob}
                        onChange={e => setFilterJob(e.target.value)}
                        className="h-10 rounded-xl border border-neutral-200 bg-white pl-4 pr-10 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="">Tất cả vị trí</option>
                        {jobs.map(job => (
                            <option key={job.id} value={job.id}>{job.title}</option>
                        ))}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="h-10 rounded-xl border border-neutral-200 bg-white pl-4 pr-10 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    >
                        <option value="">Tất cả trạng thái</option>
                        {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {statusOptions.map(opt => (
                    <div
                        key={opt.value}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                        <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                            {applications.filter(a => a.status === opt.value).length}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${opt.color.split(' ')[1]}`}>
                            {opt.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Applications List */}
            {filteredApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-12 text-center dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <UserGroupIcon className="size-8 text-neutral-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
                        {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có đơn ứng tuyển'}
                    </h3>
                    <p className="text-neutral-500 dark:text-neutral-400">
                        {searchTerm ? `Không tìm thấy ứng viên nào phù hợp với "${searchTerm}"` : 'Các đơn ứng tuyển mới sẽ hiển thị tại đây'}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-neutral-50 border-b border-neutral-100 dark:bg-white/5 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                        Ứng viên
                                    </th>
                                    <th className="hidden px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 sm:table-cell">
                                        Vị trí
                                    </th>
                                    <th className="hidden px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 md:table-cell">
                                        Cơ sở & Ca
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                        Trạng thái
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {filteredApplications.map(app => {
                                    const statusBadge = getStatusBadge(app.status)
                                    return (
                                        <tr key={app.id} className="group transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                                        {app.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-neutral-900 dark:text-white">{app.name}</p>
                                                        <p className="text-sm text-neutral-500">{app.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-6 py-4 sm:table-cell">
                                                <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-sm font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                                    {app.job.title}
                                                </span>
                                            </td>
                                            <td className="hidden px-6 py-4 md:table-cell">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                                                        <MapPinIcon className="size-4 text-neutral-400" />
                                                        {app.preferredLocation}
                                                    </div>
                                                    {app.availability && (
                                                        <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                                                            <ClockIcon className="size-4 text-neutral-400" />
                                                            {app.availability}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={app.status}
                                                    onChange={e => updateStatus(app.id, e.target.value)}
                                                    className={`rounded-full px-3 py-1 text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 appearance-none bg-none ${statusBadge.color}`}
                                                >
                                                    {statusOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value} className="bg-white text-neutral-900 dark:bg-neutral-800 dark:text-white">
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openDetailModal(app)}
                                                    className="rounded-xl bg-neutral-100 p-2 text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                                                    title="Xem chi tiết"
                                                >
                                                    <EyeIcon className="size-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            <NcModal
                isOpenProp={isModalOpen}
                onCloseModal={() => setIsModalOpen(false)}
                modalTitle="Chi tiết ứng viên"
                renderTrigger={() => null}
                renderContent={() => selectedApp && (
                    <div className="flex flex-col gap-6">
                        {/* Header Section: Name, Job, Status */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex size-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                    {selectedApp.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                                        {selectedApp.name}
                                    </h3>
                                    <p className="font-medium text-neutral-500 dark:text-neutral-400">
                                        Ứng tuyển: <span className="text-neutral-900 dark:text-white">{selectedApp.job.title}</span>
                                    </p>
                                </div>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(selectedApp.status).color}`}>
                                {getStatusBadge(selectedApp.status).label}
                            </div>
                        </div>

                        <hr className="border-neutral-100 dark:border-neutral-800" />

                        {/* Info Section - 2 Columns */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Contact Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Thông tin liên hệ</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                            <PhoneIcon className="size-4" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-xs text-neutral-500">Số điện thoại</p>
                                            <a href={`tel:${selectedApp.phone}`} className="font-medium text-neutral-900 hover:text-primary-600 dark:text-white truncate block">
                                                {selectedApp.phone}
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                            <EnvelopeIcon className="size-4" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-xs text-neutral-500">Email</p>
                                            <a href={`mailto:${selectedApp.email}`} className="font-medium text-neutral-900 hover:text-primary-600 dark:text-white truncate block">
                                                {selectedApp.email || 'N/A'}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Work Preference */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Nguyện vọng</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                            <MapPinIcon className="size-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500">Cơ sở làm việc</p>
                                            <p className="font-medium text-neutral-900 dark:text-white">
                                                {selectedApp.preferredLocation}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                                            <ClockIcon className="size-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500">Ca làm việc</p>
                                            <p className="font-medium text-neutral-900 dark:text-white">
                                                {selectedApp.availability || 'Linh hoạt'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CV Section */}
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                            <div className="flex items-center gap-4">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-neutral-800">
                                    <DocumentIcon className="size-5 text-primary-600" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-medium text-neutral-900 dark:text-white truncate">Hồ sơ ứng viên</p>
                                    <div className="flex items-center gap-3 text-sm">
                                        {selectedApp.cvUrl ? (
                                            <>
                                                <a href={selectedApp.cvUrl} target="_blank" className="text-primary-600 hover:underline font-medium">Xem online</a>
                                                <span className="text-neutral-300">|</span>
                                                <a href={selectedApp.cvUrl} download className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400">Tải xuống</a>
                                            </>
                                        ) : (
                                            <span className="text-neutral-400 italic">Chưa cập nhật CV</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions & Notes Group */}
                        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                            <div className="mb-4">
                                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Cập nhật trạng thái</label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {statusOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => updateStatus(selectedApp.id, opt.value)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${selectedApp.status === opt.value
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
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                                        placeholder="Nhập ghi chú..."
                                    />
                                    <button
                                        onClick={saveNotes}
                                        className="h-10 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="flex justify-between text-xs text-neutral-400">
                            <span>ID: {selectedApp.id.slice(0, 8)}...</span>
                            <span>Đã nộp: {new Date(selectedApp.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                    </div>
                )}
            />
        </div>
    )
}
