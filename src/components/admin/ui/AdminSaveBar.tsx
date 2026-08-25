'use client'

interface AdminSaveBarProps {
    visible: boolean
    saving?: boolean
    message?: string
    saveLabel?: string
    onReset?: () => void
}

export default function AdminSaveBar({
    visible,
    saving = false,
    message = 'Bạn có thay đổi chưa lưu',
    saveLabel = 'Lưu thay đổi',
    onReset,
}: AdminSaveBarProps) {
    if (!visible) return null

    return (
        <div role="status" aria-live="polite" className="sticky bottom-4 z-30 mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{message}</p>
            <div className="flex items-center gap-2">
                {onReset && (
                    <button type="button" onClick={onReset} disabled={saving} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
                        Hoàn tác
                    </button>
                )}
                <button type="submit" disabled={saving} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                    {saving ? 'Đang lưu...' : saveLabel}
                </button>
            </div>
        </div>
    )
}
