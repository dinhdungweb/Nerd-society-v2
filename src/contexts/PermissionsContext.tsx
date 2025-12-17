'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

export interface StaffPermissions {
    canViewDashboard: boolean
    canViewBookings: boolean
    canCreateBookings: boolean
    canEditBookings: boolean
    canDeleteBookings: boolean
    canCheckIn: boolean
    canCheckOut: boolean
    canViewCustomers: boolean
    canViewRooms: boolean
    canViewServices: boolean
    canViewLocations: boolean
    canViewPosts: boolean
    canViewNerdCoin: boolean
    canViewReports: boolean
    canViewSettings: boolean
}

const DEFAULT_PERMISSIONS: StaffPermissions = {
    canViewDashboard: true,
    canViewBookings: true,
    canCreateBookings: true,
    canEditBookings: true,
    canDeleteBookings: false,
    canCheckIn: true,
    canCheckOut: true,
    canViewCustomers: true,
    canViewRooms: false,
    canViewServices: false,
    canViewLocations: false,
    canViewPosts: false,
    canViewNerdCoin: false,
    canViewReports: false,
    canViewSettings: false,
}

// Full permissions for ADMIN
const ADMIN_PERMISSIONS: StaffPermissions = {
    canViewDashboard: true,
    canViewBookings: true,
    canCreateBookings: true,
    canEditBookings: true,
    canDeleteBookings: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewCustomers: true,
    canViewRooms: true,
    canViewServices: true,
    canViewLocations: true,
    canViewPosts: true,
    canViewNerdCoin: true,
    canViewReports: true,
    canViewSettings: true,
}

interface PermissionsContextType {
    permissions: StaffPermissions
    loading: boolean
    isAdmin: boolean
    role: string | null
    hasPermission: (key: keyof StaffPermissions) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
    permissions: DEFAULT_PERMISSIONS,
    loading: true,
    isAdmin: false,
    role: null,
    hasPermission: () => false,
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession()
    const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_PERMISSIONS)
    const [loading, setLoading] = useState(true)

    const role = (session?.user?.role as string) || null
    const isAdmin = role === 'ADMIN'

    useEffect(() => {
        if (status === 'loading') return

        // Admin has all permissions
        if (isAdmin) {
            setPermissions(ADMIN_PERMISSIONS)
            setLoading(false)
            return
        }

        // For all other roles (MANAGER, STAFF, CONTENT_EDITOR) - fetch from API
        if (role && ['MANAGER', 'STAFF', 'CONTENT_EDITOR'].includes(role)) {
            const fetchPermissions = async () => {
                try {
                    const res = await fetch('/api/staff/permissions')
                    if (res.ok) {
                        const data = await res.json()
                        setPermissions({ ...DEFAULT_PERMISSIONS, ...data.permissions })
                    }
                } catch (error) {
                    console.error('Error fetching permissions:', error)
                }
                setLoading(false)
            }
            fetchPermissions()
            return
        }

        setLoading(false)
    }, [isAdmin, role, status])

    const hasPermission = (key: keyof StaffPermissions): boolean => {
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
