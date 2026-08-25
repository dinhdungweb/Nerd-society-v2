'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

function visiblePages(current: number, total: number): Array<number | 'ellipsis'> {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total]
    if (current >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

export default function AdminPagination({
    page,
    totalPages,
    onPageChange,
    summary,
}: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
    summary?: string
}) {
    if (totalPages <= 1) return summary ? <p className="text-sm text-neutral-500 dark:text-neutral-400">{summary}</p> : null

    return (
        <nav aria-label="Phân trang" className="flex flex-col gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{summary}</p>
            <div className="flex items-center gap-1">
                <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} aria-label="Trang trước" className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                    <ChevronLeftIcon className="size-4" />
                </button>
                {visiblePages(page, totalPages).map((item, index) => item === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-neutral-400" aria-hidden="true">…</span>
                ) : (
                    <button key={item} type="button" onClick={() => onPageChange(item)} aria-label={`Trang ${item}`} aria-current={page === item ? 'page' : undefined} className={`size-9 rounded-lg text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${page === item ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}>
                        {item}
                    </button>
                ))}
                <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Trang sau" className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                    <ChevronRightIcon className="size-4" />
                </button>
            </div>
        </nav>
    )
}
