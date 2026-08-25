import { ChevronRightIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'
import { ReactNode } from 'react'

export interface AdminBreadcrumbItem {
    label: string
    href?: string
}

interface AdminPageHeaderProps {
    title: ReactNode
    description?: ReactNode
    breadcrumbs?: AdminBreadcrumbItem[]
    status?: ReactNode
    actions?: ReactNode
}

export default function AdminPageHeader({
    title,
    description,
    breadcrumbs,
    status,
    actions,
}: AdminPageHeaderProps) {
    return (
        <header className="space-y-3">
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb">
                    <ol className="flex flex-wrap items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {breadcrumbs.map((item, index) => (
                            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                                {index > 0 && <ChevronRightIcon className="size-4" aria-hidden="true" />}
                                {item.href ? (
                                    <Link href={item.href} className="rounded hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span aria-current="page" className="text-neutral-700 dark:text-neutral-200">{item.label}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
                        {status}
                    </div>
                    {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 sm:text-base">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </header>
    )
}
