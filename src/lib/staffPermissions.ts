import { prisma } from '@/lib/prisma'

// Default Staff permissions
export const DEFAULT_STAFF_PERMISSIONS = {
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

export type StaffPermissions = typeof DEFAULT_STAFF_PERMISSIONS

const PERMISSION_KEY = 'staff_permissions'

// Get staff permissions from database (server-side)
export async function getStaffPermissions(): Promise<StaffPermissions> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: PERMISSION_KEY },
        })

        if (setting) {
            return { ...DEFAULT_STAFF_PERMISSIONS, ...JSON.parse(setting.value) }
        }
        return DEFAULT_STAFF_PERMISSIONS
    } catch (error) {
        console.error('Error fetching staff permissions:', error)
        return DEFAULT_STAFF_PERMISSIONS
    }
}

// Map permissions to routes
export const PERMISSION_ROUTE_MAP: Record<string, keyof StaffPermissions> = {
    '/admin': 'canViewDashboard',
    '/admin/bookings': 'canViewBookings',
    '/admin/customers': 'canViewCustomers',
    '/admin/rooms': 'canViewRooms',
    '/admin/services': 'canViewServices',
    '/admin/locations': 'canViewLocations',
    '/admin/posts': 'canViewPosts',
    '/admin/gallery': 'canViewPosts',
    '/admin/media': 'canViewPosts',
    '/admin/content': 'canViewPosts',
    '/admin/nerdcoin': 'canViewNerdCoin',
    '/admin/reports': 'canViewReports',
    '/admin/settings': 'canViewSettings',
    '/admin/permissions': 'canViewSettings',
}

// Check if a route is allowed for staff based on permissions
export function isRouteAllowedForStaff(pathname: string, permissions: StaffPermissions): boolean {
    // Find matching route
    const matchingRoute = Object.keys(PERMISSION_ROUTE_MAP).find(route =>
        pathname === route || pathname.startsWith(route + '/')
    )

    if (!matchingRoute) {
        return false // Unknown routes are blocked for staff
    }

    const permissionKey = PERMISSION_ROUTE_MAP[matchingRoute]
    return permissions[permissionKey] ?? false
}

// Get allowed routes for staff based on permissions (for sidebar)
export function getAllowedRoutesForStaff(permissions: StaffPermissions): string[] {
    return Object.entries(PERMISSION_ROUTE_MAP)
        .filter(([_, permKey]) => permissions[permKey])
        .map(([route]) => route)
}
