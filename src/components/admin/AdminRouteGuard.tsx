'use client'

import { usePermissions } from '@/contexts/PermissionsContext'
import {
    getAdminRoutePermission,
    getFirstAllowedAdminRoute,
    isAdminOnlyRoute,
} from '@/config/admin'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'

interface AdminRouteGuardProps {
    children: ReactNode
}

/**
 * AdminRouteGuard - Central permission checking for all admin routes
 * Checks permissions from database and redirects if not allowed
 */
export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { hasPermission, isAdmin, loading } = usePermissions()
    const requiredPermission = getAdminRoutePermission(pathname)
    const adminOnly = isAdminOnlyRoute(pathname)
    const hasAccess = isAdmin || (!adminOnly && requiredPermission !== null && hasPermission(requiredPermission))

    useEffect(() => {
        if (loading) return

        if (!hasAccess) {
            const redirectTo = getFirstAllowedAdminRoute(hasPermission, isAdmin)
            const separator = redirectTo.includes('?') ? '&' : '?'
            router.replace(`${redirectTo}${separator}error=access_denied`)
        }
    }, [hasAccess, hasPermission, isAdmin, loading, router])

    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="text-sm text-neutral-500">Đang kiểm tra quyền truy cập...</p>
                </div>
            </div>
        )
    }

    return hasAccess ? <>{children}</> : null
}
