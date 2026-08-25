'use client'

import { ADMIN_NAVIGATION_GROUPS } from '@/config/admin'
import { usePermissions } from '@/contexts/PermissionsContext'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

export default function AdminCommandPalette() {
    const router = useRouter()
    const { hasPermission, isAdmin, loading } = usePermissions()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    const allowedItems = useMemo(() => ADMIN_NAVIGATION_GROUPS.flatMap(group =>
        group.items
            .filter(item => item.adminOnly ? isAdmin : !item.permissionKey || hasPermission(item.permissionKey))
            .map(item => ({ ...item, group: group.name })),
    ), [hasPermission, isAdmin])

    const results = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase('vi')
        if (!normalizedQuery) return allowedItems
        return allowedItems.filter(item =>
            `${item.name} ${item.group} ${item.href}`.toLocaleLowerCase('vi').includes(normalizedQuery),
        )
    }, [allowedItems, query])

    useEffect(() => {
        const onGlobalKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(current => !current)
            }
        }
        window.addEventListener('keydown', onGlobalKeyDown)
        return () => window.removeEventListener('keydown', onGlobalKeyDown)
    }, [])

    useEffect(() => {
        if (!open) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        setQuery('')
        setActiveIndex(0)
        window.requestAnimationFrame(() => inputRef.current?.focus())

        const onDialogKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                return
            }
            if (event.key !== 'Tab') return

            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            )
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
        window.addEventListener('keydown', onDialogKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onDialogKeyDown)
            triggerRef.current?.focus()
        }
    }, [open])

    useEffect(() => {
        setActiveIndex(0)
    }, [query])

    const navigate = (href: string) => {
        setOpen(false)
        router.push(href)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex(index => Math.min(index + 1, Math.max(0, results.length - 1)))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex(index => Math.max(index - 1, 0))
        } else if (event.key === 'Enter' && results[activeIndex]) {
            event.preventDefault()
            navigate(results[activeIndex].href)
        }
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(true)}
                disabled={loading}
                aria-label="Tìm kiếm trong trang quản trị"
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 sm:w-64 sm:px-3 lg:w-80"
            >
                <MagnifyingGlassIcon className="size-4 shrink-0" />
                <span className="hidden flex-1 text-left sm:block">Tìm trang hoặc chức năng...</span>
                <kbd className="hidden rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 lg:inline-block dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                    Ctrl K
                </kbd>
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}>
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Tìm kiếm trang quản trị"
                        className="w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
                            <MagnifyingGlassIcon className="size-5 text-neutral-400" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Nhập tên trang hoặc chức năng..."
                                aria-controls="admin-command-results"
                                aria-activedescendant={results[activeIndex] ? `admin-command-${activeIndex}` : undefined}
                                className="min-w-0 flex-1 bg-transparent py-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
                            />
                            <kbd className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-700">Esc</kbd>
                        </div>

                        <div id="admin-command-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
                            {results.length > 0 ? results.map((item, index) => (
                                <button
                                    id={`admin-command-${index}`}
                                    key={`${item.href}-${item.name}`}
                                    type="button"
                                    role="option"
                                    aria-selected={activeIndex === index}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => navigate(item.href)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${activeIndex === index
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                        : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    <span>
                                        <span className="block text-sm font-semibold">{item.name}</span>
                                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{item.group}</span>
                                    </span>
                                    <span className="text-xs text-neutral-400">{item.href}</span>
                                </button>
                            )) : (
                                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                                    Không tìm thấy chức năng phù hợp.
                                </div>
                            )}
                        </div>

                        <div className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                            ↑↓ để chọn · Enter để mở · Esc để đóng
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
