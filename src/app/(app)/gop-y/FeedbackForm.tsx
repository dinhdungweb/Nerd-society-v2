'use client'

import { useState } from 'react'
import {
    EnvelopeIcon,
    PhoneIcon,
    UserIcon,
    ChatBubbleLeftRightIcon,
    CheckCircleIcon,
    StarIcon,
    HomeIcon,
    UserGroupIcon,
    LightBulbIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const feedbackTypes = [
    { value: 'SERVICE_QUALITY', label: 'Chất lượng dịch vụ', Icon: StarIcon },
    { value: 'FACILITIES', label: 'Cơ sở vật chất', Icon: HomeIcon },
    { value: 'STAFF_ATTITUDE', label: 'Thái độ nhân viên', Icon: UserGroupIcon },
    { value: 'SUGGESTION', label: 'Đề xuất/Góp ý', Icon: LightBulbIcon },
    { value: 'OTHER', label: 'Khác', Icon: DocumentTextIcon },
]

export default function FeedbackForm() {
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        type: 'SUGGESTION',
        subject: '',
        content: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim() || !formData.content.trim()) {
            toast.error('Vui lòng điền họ tên và nội dung góp ý')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (res.ok) {
                setSubmitted(true)
                toast.success('Cảm ơn bạn đã gửi góp ý!')
            } else {
                const data = await res.json()
                toast.error(data.error || 'Có lỗi xảy ra')
            }
        } catch {
            toast.error('Không thể gửi góp ý. Vui lòng thử lại sau.')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircleIcon className="size-10" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
                    Cảm ơn bạn!
                </h2>
                <p className="mb-6 max-w-md text-neutral-600 dark:text-neutral-400">
                    Góp ý của bạn đã được ghi nhận. Chúng tôi sẽ xem xét và phản hồi trong thời gian sớm nhất.
                </p>
                <button
                    onClick={() => {
                        setSubmitted(false)
                        setFormData({ name: '', email: '', phone: '', type: 'SUGGESTION', subject: '', content: '' })
                    }}
                    className="rounded-full bg-primary-500 px-6 py-2 font-medium text-white transition-colors hover:bg-primary-600"
                >
                    Gửi góp ý khác
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Feedback Type */}
            <div>
                <label className="mb-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Loại góp ý <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {feedbackTypes.map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: type.value })}
                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${formData.type === type.value
                                ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                                : 'border-neutral-200 bg-white hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-800'
                                }`}
                        >
                            <type.Icon className="size-6 text-primary-500" />
                            <span className="text-center text-xs font-medium text-neutral-700 dark:text-neutral-300">{type.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Nguyễn Văn A"
                            className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Email
                    </label>
                    <div className="relative">
                        <EnvelopeIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@example.com"
                            className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Số điện thoại
                    </label>
                    <div className="relative">
                        <PhoneIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="0901234567"
                            className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Subject */}
            <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Tiêu đề
                </label>
                <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Tóm tắt ngắn gọn vấn đề..."
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
            </div>

            {/* Content */}
            <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Nội dung góp ý <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <ChatBubbleLeftRightIcon className="absolute left-3 top-3 size-5 text-neutral-400" />
                    <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Chia sẻ chi tiết góp ý của bạn..."
                        rows={6}
                        className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        required
                    />
                </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-8 py-3 font-semibold text-white transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Đang gửi...
                        </>
                    ) : (
                        'Gửi góp ý'
                    )}
                </button>
            </div>
        </form>
    )
}
