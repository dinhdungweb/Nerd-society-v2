'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
    PaperAirplaneIcon,
    MapPinIcon,
    ClockIcon,
    DocumentIcon,
    ArrowUpTrayIcon,
    XMarkIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline'

const locationOptions = [
    { value: 'Tây Sơn', label: 'Tây Sơn' },
    { value: 'Hồ Tùng Mậu', label: 'Hồ Tùng Mậu' },
    { value: 'Cả hai', label: 'Cả hai đều được' },
]

const shiftOptions = [
    { value: 'Ca 1 (00:00 - 07:00)', label: 'Ca 1: 00:00 – 07:00' },
    { value: 'Ca 2 (07:00 - 12:00)', label: 'Ca 2: 07:00 – 12:00' },
    { value: 'Ca 3 (12:00 - 19:00)', label: 'Ca 3: 12:00 – 19:00' },
    { value: 'Ca 4 (19:00 - 00:00)', label: 'Ca 4: 19:00 – 00:00' },
]

interface ApplicationFormProps {
    jobId: string
}

export default function ApplicationForm({ jobId }: ApplicationFormProps) {
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        preferredLocation: '',
        availability: '',
        cvUrl: '',
    })

    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.phone || !formData.preferredLocation) {
            toast.error('Vui lòng điền đầy đủ thông tin bắt buộc')
            return
        }

        setSubmitting(true)

        try {
            const res = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: jobId,
                    ...formData,
                    cvUrl: formData.cvUrl // This will be the uploaded file URL
                }),
            })

            const data = await res.json()

            if (res.ok) {
                setSubmitted(true)
                // toast handled by UI state
            } else {
                toast.error(data.error || 'Có lỗi xảy ra')
            }
        } catch (error) {
            toast.error('Không thể gửi đơn. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="sticky top-24">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-primary-500/5 dark:border-neutral-800 dark:bg-neutral-900">
                {submitted ? (
                    <div className="text-center py-10">
                        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 animate-bounce">
                            <CheckCircleIcon className="size-10" />
                        </div>
                        <h3 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-white">
                            Đã gửi thành công!
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
                            Hồ sơ của bạn đã được chuyển đến bộ phận tuyển dụng. Chúng tôi sẽ liên hệ lại sớm nhất!
                        </p>
                        <button
                            onClick={() => router.push('/tuyen-dung')}
                            className="w-full rounded-xl bg-neutral-100 py-3 font-medium text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
                        >
                            Xem vị trí khác
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                            <h3 className="flex items-center gap-2 text-xl font-bold text-neutral-900 dark:text-white">
                                <PaperAirplaneIcon className="size-5 text-primary-500" />
                                Ứng tuyển ngay
                            </h3>
                            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                                Hãy điền thông tin bên dưới để gia nhập Nerd Society nhé!
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Họ và tên <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
                                    placeholder="Nhập họ và tên"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Số điện thoại <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
                                    placeholder="0912 345 678"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
                                    placeholder="email@example.com"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Cơ sở mong muốn <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.preferredLocation}
                                        onChange={e => setFormData({ ...formData, preferredLocation: e.target.value })}
                                        className="w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
                                        required
                                    >
                                        <option value="">Chọn cơ sở làm việc</option>
                                        {locationOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Có thể đi làm ca nào?
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.availability}
                                        onChange={e => setFormData({ ...formData, availability: e.target.value })}
                                        className="w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
                                    >
                                        <option value="">Chọn ca làm mong muốn</option>
                                        {shiftOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                    Xoay ca linh hoạt, tối thiểu 4 ca/tuần, trong đó có ít nhất 1 ca đêm.
                                </p>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    Link CV/Portfolio
                                </label>
                                <div className="relative">
                                    <DocumentIcon className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />

                                    {!formData.cvUrl ? (
                                        <div className="relative w-full">
                                            <input
                                                type="file"
                                                id="cv-upload"
                                                accept=".pdf,.doc,.docx"
                                                onChange={async (e) => {
                                                    const selectedFile = e.target.files?.[0]
                                                    if (!selectedFile) return

                                                    // Max 5MB
                                                    if (selectedFile.size > 5 * 1024 * 1024) {
                                                        toast.error('File quá lớn (Max 5MB)')
                                                        return
                                                    }

                                                    setUploading(true)
                                                    setFile(selectedFile)

                                                    const formDataUpload = new FormData()
                                                    formDataUpload.append('files', selectedFile)

                                                    try {
                                                        const res = await fetch('/api/upload', {
                                                            method: 'POST',
                                                            body: formDataUpload
                                                        })

                                                        if (res.ok) {
                                                            const data = await res.json()
                                                            setFormData(prev => ({ ...prev, cvUrl: data.url }))
                                                            toast.success('Upload CV thành công')
                                                        } else {
                                                            toast.error('Upload thất bại')
                                                            setFile(null)
                                                        }
                                                    } catch (error) {
                                                        toast.error('Lỗi upload')
                                                        setFile(null)
                                                    } finally {
                                                        setUploading(false)
                                                    }
                                                }}
                                                className="hidden"
                                            />
                                            <label
                                                htmlFor="cv-upload"
                                                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-3 pl-11 pr-4 text-neutral-500 transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                {uploading ? 'Đang tải lên...' : 'Chọn file (PDF, DOC, DOCX)...'}
                                                <ArrowUpTrayIcon className="size-5" />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-primary-50 py-3 pl-11 pr-4 text-primary-700 dark:border-neutral-700 dark:bg-primary-900/20 dark:text-primary-400">
                                            <span className="truncate max-w-[200px]">{file?.name || 'File đã upload'}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, cvUrl: '' }))
                                                    setFile(null)
                                                }}
                                                className="rounded-full p-1 hover:bg-primary-100 dark:hover:bg-primary-900/40"
                                            >
                                                <XMarkIcon className="size-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-1.5 text-xs text-neutral-500">
                                    Upload CV định dạng PDF, DOC, DOCX (Max 5MB).
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-4 font-bold text-white shadow-lg shadow-primary-500/25 transition-all hover:translate-y-[-2px] hover:bg-primary-600 hover:shadow-xl hover:shadow-primary-500/40 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                            >
                                {submitting ? (
                                    <>
                                        <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Đang gửi...
                                    </>
                                ) : (
                                    <>
                                        <PaperAirplaneIcon className="size-5" />
                                        Gửi đơn ứng tuyển
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Thắc mắc liên hệ hotline: <a href="tel:0368483689" className="font-semibold text-primary-600 hover:underline dark:text-primary-400">036 848 3689</a>
                </p>
            </div>
        </div>
    )
}
