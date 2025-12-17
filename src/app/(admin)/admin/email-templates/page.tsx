'use client'

import { useState, useEffect } from 'react'
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    EnvelopeIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface EmailTemplate {
    id: string
    name: string
    subject: string
    content: string
    variables: string | null
    isActive: boolean
    updatedAt: string
}

const defaultTemplates = [
    { name: 'booking_confirmation', label: 'Xác nhận đặt lịch' },
    { name: 'payment_reminder', label: 'Nhắc thanh toán' },
    { name: 'booking_cancelled', label: 'Hủy đặt lịch' },
    { name: 'checkin_reminder', label: 'Nhắc check-in' },
]

const availableVariables = [
    { name: 'customerName', description: 'Tên khách hàng' },
    { name: 'bookingCode', description: 'Mã booking' },
    { name: 'roomName', description: 'Tên phòng' },
    { name: 'locationName', description: 'Tên cơ sở' },
    { name: 'date', description: 'Ngày đặt' },
    { name: 'startTime', description: 'Giờ bắt đầu' },
    { name: 'endTime', description: 'Giờ kết thúc' },
    { name: 'depositAmount', description: 'Số tiền cọc' },
    { name: 'totalAmount', description: 'Tổng tiền' },
]

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        content: '',
        isActive: true,
    })

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/admin/email-templates')
            const data = await res.json()
            if (res.ok) {
                setTemplates(data.templates)
            }
        } catch (error) {
            console.error('Error fetching templates:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTemplates()
    }, [])

    const handleEdit = (template: EmailTemplate) => {
        setSelectedTemplate(template)
        setFormData({
            name: template.name,
            subject: template.subject,
            content: template.content,
            isActive: template.isActive,
        })
        setIsEditing(true)
    }

    const handleNew = () => {
        setSelectedTemplate(null)
        setFormData({
            name: '',
            subject: '',
            content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nerd Society</h1>
        </div>
        <div class="content">
            <p>Xin chào {{customerName}},</p>
            <p>Nội dung email...</p>
        </div>
        <div class="footer">
            <p>© 2024 Nerd Society. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
            isActive: true,
        })
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!formData.name || !formData.subject || !formData.content) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/email-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedTemplate?.id,
                    ...formData,
                    variables: JSON.stringify(availableVariables.map(v => v.name)),
                }),
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            toast.success(selectedTemplate ? 'Đã cập nhật template' : 'Đã tạo template mới')
            setIsEditing(false)
            fetchTemplates()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa template này?')) return

        try {
            const res = await fetch(`/api/admin/email-templates?id=${id}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                toast.success('Đã xóa template')
                fetchTemplates()
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
        }
    }

    const insertVariable = (varName: string) => {
        setFormData(prev => ({
            ...prev,
            content: prev.content + `{{${varName}}}`,
        }))
    }

    if (isEditing) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {selectedTemplate ? 'Chỉnh sửa template' : 'Tạo template mới'}
                    </h1>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                        ← Quay lại
                    </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Tên template (slug)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="booking_confirmation"
                                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Tiêu đề email
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                        placeholder="Xác nhận đặt lịch #{{bookingCode}}"
                                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        Nội dung email (HTML)
                                    </label>
                                    <textarea
                                        value={formData.content}
                                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                        rows={20}
                                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                        className="rounded border-neutral-300"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-neutral-700 dark:text-neutral-300">
                                        Kích hoạt template
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu template'}
                            </button>
                        </div>
                    </div>

                    {/* Variables sidebar */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                        <h3 className="mb-4 font-semibold text-neutral-900 dark:text-white">Biến có thể dùng</h3>
                        <p className="mb-4 text-sm text-neutral-500">Click để chèn vào nội dung</p>
                        <div className="space-y-2">
                            {availableVariables.map((v) => (
                                <button
                                    key={v.name}
                                    onClick={() => insertVariable(v.name)}
                                    className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                                >
                                    <code className="text-primary-600">{`{{${v.name}}}`}</code>
                                    <span className="text-xs text-neutral-400">{v.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    Email Templates
                </h1>
                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                    <PlusIcon className="size-4" />
                    Tạo template
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="size-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
                </div>
            ) : templates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                        <EnvelopeIcon className="size-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-neutral-900 dark:text-white">
                                            {template.name}
                                        </h3>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                            {template.subject}
                                        </p>
                                    </div>
                                </div>
                                {template.isActive ? (
                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircleIcon className="size-4" />
                                        Active
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                                        <XCircleIcon className="size-4" />
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => handleEdit(template)}
                                    className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
                                >
                                    <PencilIcon className="size-4" />
                                    Sửa
                                </button>
                                <button
                                    onClick={() => handleDelete(template.id)}
                                    className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
                                >
                                    <TrashIcon className="size-4" />
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
                    <EnvelopeIcon className="mx-auto size-12 text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-4 text-neutral-500">Chưa có email template nào</p>
                    <button
                        onClick={handleNew}
                        className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                    >
                        Tạo template đầu tiên
                    </button>
                </div>
            )}
        </div>
    )
}
