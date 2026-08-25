import { ReactNode } from 'react'

export default function AdminFormSection({
    title,
    description,
    children,
    actions,
}: {
    title: string
    description?: string
    children: ReactNode
    actions?: ReactNode
}) {
    return (
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div>
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h2>
                    {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
                </div>
                {actions}
            </div>
            <div className="p-5 sm:p-6">{children}</div>
        </section>
    )
}
