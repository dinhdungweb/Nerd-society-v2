import {
    ArrowPathIcon,
    ExclamationTriangleIcon,
    InboxIcon,
} from '@heroicons/react/24/outline'
import { ReactNode } from 'react'

interface StateShellProps {
    icon: ReactNode
    title: string
    description?: string
    action?: ReactNode
    role?: 'status' | 'alert'
}

function StateShell({ icon, title, description, action, role = 'status' }: StateShellProps) {
    return (
        <div role={role} className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {icon}
            </div>
            <h2 className="mt-4 text-base font-semibold text-neutral-900 dark:text-white">{title}</h2>
            {description && <p className="mx-auto mt-1 max-w-lg text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
            {action && <div className="mt-5 flex justify-center">{action}</div>}
        </div>
    )
}

export function AdminEmptyState({ title, description, action }: Omit<StateShellProps, 'icon'>) {
    return <StateShell icon={<InboxIcon className="size-6" />} title={title} description={description} action={action} />
}

export function AdminErrorState({
    title = 'Không thể tải dữ liệu',
    description = 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    onRetry,
}: {
    title?: string
    description?: string
    onRetry?: () => void
}) {
    return (
        <StateShell
            role="alert"
            icon={<ExclamationTriangleIcon className="size-6 text-red-500" />}
            title={title}
            description={description}
            action={onRetry ? (
                <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                    <ArrowPathIcon className="size-4" /> Thử lại
                </button>
            ) : undefined}
        />
    )
}

export function AdminLoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
    return (
        <div role="status" aria-live="polite" className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-b-primary-600 dark:border-neutral-700 dark:border-b-primary-400" />
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
        </div>
    )
}
