'use client'

import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ReactNode, useEffect, useId, useRef } from 'react'

interface AdminConfirmDialogProps {
    open: boolean
    title: string
    description: ReactNode
    details?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'danger' | 'warning' | 'primary'
    pending?: boolean
    onConfirm: () => void
    onCancel: () => void
}

const CONFIRM_CLASSES = {
    danger: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
    warning: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
    primary: 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500',
}

export default function AdminConfirmDialog({
    open,
    title,
    description,
    details,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy',
    tone = 'danger',
    pending = false,
    onConfirm,
    onCancel,
}: AdminConfirmDialogProps) {
    const cancelButtonRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const titleId = useId()
    const descriptionId = useId()

    useEffect(() => {
        if (!open) return

        const previousOverflow = document.body.style.overflow
        previousFocusRef.current = document.activeElement as HTMLElement | null
        document.body.style.overflow = 'hidden'
        cancelButtonRef.current?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !pending) onCancel()
            if (event.key === 'Tab') {
                const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
                if (!focusable?.length) return
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', handleKeyDown)
            previousFocusRef.current?.focus()
        }
    }, [onCancel, open, pending])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) onCancel()
        }}>
            <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
                <div className="flex items-start gap-4">
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : tone === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                        <ExclamationTriangleIcon className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>
                        <div id={descriptionId} className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</div>
                    </div>
                    <button type="button" onClick={onCancel} disabled={pending} aria-label="Đóng hộp thoại" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200">
                        <XMarkIcon className="size-5" />
                    </button>
                </div>

                {details && <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{details}</div>}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={onConfirm} disabled={pending} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${CONFIRM_CLASSES[tone]}`}>
                        {pending ? 'Đang xử lý...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
