'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import {
    ADMIN_PERMISSIONS,
    AdminPermissionKey,
    AdminPermissions,
    ConfigurableAdminRole,
    DEFAULT_ROLE_PERMISSIONS,
} from '@/config/admin'

export type StaffPermissions = AdminPermissions

interface PermissionsContextType {
    permissions: StaffPermissions
    loading: boolean
    isAdmin: boolean
    role: string | null
    hasPermission: (key: AdminPermissionKey) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
    permissions: DEFAULT_ROLE_PERMISSIONS.STAFF,
    loading: true,
    isAdmin: false,
    role: null,
    hasPermission: () => false,
})

function isConfigurableRole(role: string | null): role is ConfigurableAdminRole {
    return role === 'MANAGER' || role === 'STAFF' || role === 'CONTENT_EDITOR'
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession()
    const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_ROLE_PERMISSIONS.STAFF)
    const [loading, setLoading] = useState(true)

    const role = (session?.user?.role as string) || null
    const isAdmin = role === 'ADMIN'

    useEffect(() => {
        if (status === 'loading') return

        if (isAdmin) {
            setPermissions(ADMIN_PERMISSIONS)
            setLoading(false)
            return
        }

        if (isConfigurableRole(role)) {
            const fallbackPermissions = DEFAULT_ROLE_PERMISSIONS[role]

            const fetchPermissions = async () => {
                try {
                    const response = await fetch('/api/staff/permissions')
                    if (!response.ok) {
                        setPermissions(fallbackPermissions)
                        return
                    }

                    const data = await response.json()
                    setPermissions({ ...fallbackPermissions, ...data.permissions })
                } catch (error) {
                    console.error('Error fetching permissions:', error)
                    setPermissions(fallbackPermissions)
                } finally {
                    setLoading(false)
                }
            }

            fetchPermissions()
            return
        }

        setPermissions(DEFAULT_ROLE_PERMISSIONS.STAFF)
        setLoading(false)
    }, [isAdmin, role, status])

    const hasPermission = (key: AdminPermissionKey): boolean => {
        if (isAdmin) return true
        return permissions[key] ?? false
    }

    return (
        <PermissionsContext.Provider value={{ permissions, loading, isAdmin, role, hasPermission }}>
            {children}
        </PermissionsContext.Provider>
    )
}

export const usePermissions = () => useContext(PermissionsContext)
