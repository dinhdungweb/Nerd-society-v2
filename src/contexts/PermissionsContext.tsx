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

// Limited permissions for CONTENT_EDITOR - only content management
const CONTENT_EDITOR_PERMISSIONS: StaffPermissions = {
    canViewDashboard: false,
    canViewBookings: false,
    canCreateBookings: false,
    canEditBookings: false,
    canDeleteBookings: false,
    canCheckIn: false,
    canCheckOut: false,
    canViewCustomers: false,
    canViewRooms: false,
    canViewServices: false,
    canViewLocations: false,
    canViewPosts: true,  // Only content access
    canViewNerdCoin: false,
    canViewReports: false,
    canViewSettings: false,
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

        // For MANAGER, STAFF, and CONTENT_EDITOR - fetch from API (database permissions)
        if (role && ['MANAGER', 'STAFF', 'CONTENT_EDITOR'].includes(role)) {
            const fetchPermissions = async () => {
                try {
                    const res = await fetch('/api/staff/permissions')
                    if (res.ok) {
                        const data = await res.json()
                        // Merge with defaults, falling back to CONTENT_EDITOR defaults if API fails
                        const basePermissions = role === 'CONTENT_EDITOR'
                            ? CONTENT_EDITOR_PERMISSIONS
                            : DEFAULT_PERMISSIONS
                        setPermissions({ ...basePermissions, ...data.permissions })
                    } else {
                        // If API fails, use role-specific defaults
                        setPermissions(role === 'CONTENT_EDITOR' ? CONTENT_EDITOR_PERMISSIONS : DEFAULT_PERMISSIONS)
                    }
                } catch (error) {
                    console.error('Error fetching permissions:', error)
                    // Fallback to role-specific defaults
                    setPermissions(role === 'CONTENT_EDITOR' ? CONTENT_EDITOR_PERMISSIONS : DEFAULT_PERMISSIONS)
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
