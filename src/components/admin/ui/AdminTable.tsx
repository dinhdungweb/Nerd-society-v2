import { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react'

export function AdminTableContainer({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`} {...props}>{children}</div>
}

export function AdminTable({ children, className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
    return <div className="overflow-x-auto"><table className={`min-w-full text-sm ${className}`} {...props}>{children}</table></div>
}

export function AdminTableHead({ children }: { children: ReactNode }) {
    return <thead className="border-b border-neutral-200 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">{children}</thead>
}

export function AdminTableBody({ children }: { children: ReactNode }) {
    return <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</tbody>
}

export function AdminTableCell({ children, header = false, className = '', ...props }: { children?: ReactNode; header?: boolean; className?: string } & HTMLAttributes<HTMLTableCellElement>) {
    const Component = header ? 'th' : 'td'
    return <Component className={`px-5 py-4 ${className}`} {...props}>{children}</Component>
}
