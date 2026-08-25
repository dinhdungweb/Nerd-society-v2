import { ReactNode } from 'react'

export type AdminStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple'

const TONE_CLASSES: Record<AdminStatusTone, string> = {
    neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
    purple: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

const DOT_CLASSES: Record<AdminStatusTone, string> = {
    neutral: 'bg-neutral-500',
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    purple: 'bg-purple-500',
}

export default function AdminStatusBadge({
    children,
    tone = 'neutral',
    dot = false,
}: {
    children: ReactNode
    tone?: AdminStatusTone
    dot?: boolean
}) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
            {dot && <span className={`size-1.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />}
            {children}
        </span>
    )
}
