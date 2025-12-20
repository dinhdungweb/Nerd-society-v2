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
    { name: 'booking_confirmation', label: 'Xác nhận đặt lịch (đã cọc)' },
    { name: 'booking_pending', label: 'Tiếp nhận đặt lịch (chờ cọc)' },
    { name: 'password_reset', label: 'Đặt lại mật khẩu' },
    { name: 'booking_cancelled', label: 'Hủy đặt lịch' },
    { name: 'checkin_reminder', label: 'Nhắc check-in' },
]

// Pre-built templates for each email type
const prebuiltTemplates: Record<string, { subject: string; content: string }> = {
    booking_confirmation: {
        subject: '[Nerd Society] Xác nhận đặt lịch #{{bookingCode}}',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #4f46e5; color: white; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Đặt lịch thành công! ✅</h1>
  </div>
  <div style="padding: 32px; background: #f9fafb;">
    <p style="font-size: 16px;">Xin chào <strong>{{customerName}}</strong>,</p>
    <p>Đặt lịch của bạn đã được xác nhận thành công!</p>
    
    <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #4f46e5;">
      <h3 style="margin-top: 0; color: #4f46e5;">📝 Thông tin đặt lịch</h3>
      <p><strong>Mã đặt lịch:</strong> {{bookingCode}}</p>
      <p><strong>Cơ sở:</strong> {{locationName}}</p>
      <p><strong>Dịch vụ:</strong> {{serviceName}}</p>
      <p><strong>Thời gian:</strong> {{date}} | {{startTime}} - {{endTime}}</p>
      <p><strong>Tổng tiền:</strong> {{amount}}</p>
    </div>
    
    <p style="text-align: center;">
      <a href="{{bookingUrl}}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Xem chi tiết đặt lịch</a>
    </p>
  </div>
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p>Nerd Society - Study & Work Space</p>
    <p>Hotline: 036 848 3689</p>
  </div>
</div>`
    },
    booking_pending: {
        subject: '[Nerd Society] Tiếp nhận đặt lịch #{{bookingCode}}',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #f59e0b; color: white; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Đã nhận yêu cầu đặt lịch! 📩</h1>
  </div>
  <div style="padding: 32px; background: #f9fafb;">
    <p style="font-size: 16px;">Xin chào <strong>{{customerName}}</strong>,</p>
    <p>Chúng tôi đã nhận được yêu cầu đặt lịch của bạn. Vui lòng thanh toán cọc để hoàn tất.</p>
    
    <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <h3 style="margin-top: 0; color: #d97706;">📝 Thông tin đặt lịch</h3>
      <p><strong>Mã đặt lịch:</strong> {{bookingCode}}</p>
      <p><strong>Cơ sở:</strong> {{locationName}}</p>
      <p><strong>Dịch vụ:</strong> {{serviceName}}</p>
      <p><strong>Thời gian:</strong> {{date}} | {{startTime}} - {{endTime}}</p>
      <p><strong>Tổng tiền:</strong> {{amount}}</p>
    </div>
    
    <p style="text-align: center;">
      <a href="{{bookingUrl}}" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Thanh toán ngay</a>
    </p>
  </div>
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p>Nerd Society - Study & Work Space</p>
  </div>
</div>`
    },
    password_reset: {
        subject: '[Nerd Society] Yêu cầu đặt lại mật khẩu',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #4f46e5; color: white; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Đặt lại mật khẩu 🔐</h1>
  </div>
  <div style="padding: 32px; background: #f9fafb;">
    <p>Xin chào,</p>
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
    <p>Đường dẫn có hiệu lực trong <strong>1 giờ</strong>.</p>
    
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{resetUrl}}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Đặt lại mật khẩu</a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">Nếu bạn không yêu cầu thay đổi này, vui lòng bỏ qua email này.</p>
  </div>
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p>Nerd Society - Study & Work Space</p>
  </div>
</div>`
    },
    booking_cancelled: {
        subject: '[Nerd Society] Đặt lịch #{{bookingCode}} đã bị hủy',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #ef4444; color: white; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Đặt lịch đã bị hủy ❌</h1>
  </div>
  <div style="padding: 32px; background: #f9fafb;">
    <p style="font-size: 16px;">Xin chào <strong>{{customerName}}</strong>,</p>
    <p>Đặt lịch của bạn đã bị hủy.</p>
    
    <div style="background: #fef2f2; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #ef4444;">
      <h3 style="margin-top: 0; color: #dc2626;">📝 Thông tin đặt lịch đã hủy</h3>
      <p><strong>Mã đặt lịch:</strong> {{bookingCode}}</p>
      <p><strong>Cơ sở:</strong> {{locationName}}</p>
      <p><strong>Dịch vụ:</strong> {{serviceName}}</p>
      <p><strong>Thời gian:</strong> {{date}} | {{startTime}} - {{endTime}}</p>
    </div>
    
    <p>Nếu bạn đã thanh toán cọc, vui lòng liên hệ để được hoàn tiền.</p>
    <p><strong>Hotline:</strong> 036 848 3689</p>
  </div>
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p>Nerd Society - Study & Work Space</p>
  </div>
</div>`
    },
    checkin_reminder: {
        subject: '[Nerd Society] Nhắc nhở check-in #{{bookingCode}}',
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #10b981; color: white; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Sắp đến giờ check-in! ⏰</h1>
  </div>
  <div style="padding: 32px; background: #f9fafb;">
    <p style="font-size: 16px;">Xin chào <strong>{{customerName}}</strong>,</p>
    <p>Đây là lời nhắc cho đặt lịch sắp tới của bạn. Đừng quên đến đúng giờ nhé! 😊</p>
    
    <div style="background: #d1fae5; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #059669;">📅 Thông tin đặt lịch</h3>
      <p><strong>Mã đặt lịch:</strong> {{bookingCode}}</p>
      <p><strong>Cơ sở:</strong> {{locationName}}</p>
      <p><strong>Dịch vụ:</strong> {{serviceName}}</p>
      <p><strong>Thời gian:</strong> {{date}} | {{startTime}} - {{endTime}}</p>
    </div>
    
    <p style="text-align: center;">
      <a href="{{bookingUrl}}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Xem chi tiết</a>
    </p>
  </div>
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p>Nerd Society - Study & Work Space</p>
  </div>
</div>`
    },
}

const availableVariables = [
    { name: 'customerName', description: 'Tên khách hàng' },
    { name: 'bookingCode', description: 'Mã booking' },
    { name: 'serviceName', description: 'Tên dịch vụ/phòng' },
    { name: 'locationName', description: 'Tên cơ sở' },
    { name: 'date', description: 'Ngày đặt' },
    { name: 'startTime', description: 'Giờ bắt đầu' },
    { name: 'endTime', description: 'Giờ kết thúc' },
    { name: 'amount', description: 'Tổng tiền' },
    { name: 'bookingUrl', description: 'Link xem chi tiết' },
    { name: 'resetUrl', description: 'Link đặt lại mật khẩu' },
]

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false) // Toggle between code and preview

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
            content: '',
            isActive: true,
        })
        setPreviewMode(false)
        setIsEditing(true)
    }

    // Handle template type selection - auto-fill with prebuilt template
    const handleTemplateTypeChange = (templateName: string) => {
        setFormData(prev => ({ ...prev, name: templateName }))

        // Auto-fill subject and content if a prebuilt template exists
        if (templateName && prebuiltTemplates[templateName]) {
            const prebuilt = prebuiltTemplates[templateName]
            setFormData(prev => ({
                ...prev,
                name: templateName,
                subject: prebuilt.subject,
                content: prebuilt.content,
            }))
        }
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
                                        Loại template
                                    </label>
                                    <select
                                        value={formData.name}
                                        onChange={(e) => handleTemplateTypeChange(e.target.value)}
                                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                        disabled={!!selectedTemplate}
                                    >
                                        <option value="">-- Chọn loại template --</option>
                                        {defaultTemplates.map((t) => (
                                            <option key={t.name} value={t.name}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-neutral-500">
                                        Chọn loại sẽ tự động điền sẵn nội dung mẫu đẹp
                                    </p>
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
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            Nội dung email
                                        </label>
                                        <div className="flex rounded-lg border border-neutral-300 dark:border-neutral-700">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewMode(false)}
                                                className={`px-3 py-1 text-sm ${!previewMode ? 'bg-primary-600 text-white' : 'text-neutral-600 dark:text-neutral-400'} rounded-l-lg`}
                                            >
                                                Code
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewMode(true)}
                                                className={`px-3 py-1 text-sm ${previewMode ? 'bg-primary-600 text-white' : 'text-neutral-600 dark:text-neutral-400'} rounded-r-lg`}
                                            >
                                                Xem trước
                                            </button>
                                        </div>
                                    </div>
                                    {previewMode ? (
                                        <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-white" style={{ minHeight: '480px' }}>
                                            <iframe
                                                srcDoc={formData.content}
                                                className="h-[450px] w-full border-0"
                                                title="Email Preview"
                                            />
                                        </div>
                                    ) : (
                                        <textarea
                                            value={formData.content}
                                            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                            rows={20}
                                            placeholder="Chọn loại template ở trên để tự động điền nội dung mẫu..."
                                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                        />
                                    )}
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
