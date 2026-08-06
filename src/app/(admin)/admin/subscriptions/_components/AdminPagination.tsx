'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface AdminPaginationProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  itemLabel: string
  disabled?: boolean
  onPageChange: (page: number) => void
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const visibleCount = Math.min(5, totalPages)
  let start = Math.max(1, currentPage - 2)
  start = Math.min(start, Math.max(1, totalPages - visibleCount + 1))

  return Array.from({ length: visibleCount }, (_, index) => start + index)
}

export default function AdminPagination({
  page,
  pageSize,
  total,
  totalPages,
  itemLabel,
  disabled = false,
  onPageChange,
}: AdminPaginationProps) {
  if (total === 0) return null

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Hiển thị {startItem}–{endItem} / {total} {itemLabel}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Trang trước"
          className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        {getVisiblePages(page, totalPages).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            disabled={disabled}
            aria-label={`Trang ${pageNumber}`}
            aria-current={page === pageNumber ? 'page' : undefined}
            className={`flex size-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              page === pageNumber
                ? 'bg-primary-600 text-white'
                : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          aria-label="Trang sau"
          className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
