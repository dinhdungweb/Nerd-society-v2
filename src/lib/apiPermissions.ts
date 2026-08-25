import {
    ADMIN_PERMISSIONS,
    AdminPermissionKey,
    ConfigurableAdminRole,
    DEFAULT_ROLE_PERMISSIONS,
} from '@/config/admin'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const PERMISSION_KEY_PREFIX = 'role_permissions_'

export type PermissionKey = AdminPermissionKey

function isConfigurableRole(role: string): role is ConfigurableAdminRole {
    return role === 'MANAGER' || role === 'STAFF' || role === 'CONTENT_EDITOR'
}

export async function getRolePermissions(role: string): Promise<Record<string, boolean>> {
    if (role === 'ADMIN') {
        return ADMIN_PERMISSIONS
    }

    if (!isConfigurableRole(role)) {
        return {}
    }

    try {
        const setting = await prisma.setting.findUnique({
            where: { key: `${PERMISSION_KEY_PREFIX}${role}` },
        })

        const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role]
        return setting
            ? { ...defaultPermissions, ...JSON.parse(setting.value) }
            : defaultPermissions
    } catch (error) {
        console.error(`Error fetching permissions for role ${role}:`, error)
        return DEFAULT_ROLE_PERMISSIONS[role]
    }
}

export async function hasPermission(role: string, permission: PermissionKey): Promise<boolean> {
    if (role === 'ADMIN') return true

    const permissions = await getRolePermissions(role)
    return permissions[permission] === true
}

export async function checkApiPermission(requiredPermission: PermissionKey): Promise<{
    session: any | null
    hasAccess: boolean
    role: string | null
}> {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return { session: null, hasAccess: false, role: null }
    }

    const role = session.user.role as string
    if (role === 'ADMIN') {
        return { session, hasAccess: true, role }
    }

    const hasAccess = await hasPermission(role, requiredPermission)
    return { session, hasAccess, role }
}

type ViewResource =
    | 'Dashboard'
    | 'Reports'
    | 'Bookings'
    | 'Chat'
    | 'Rooms'
    | 'Services'
    | 'Locations'
    | 'Posts'
    | 'Gallery'
    | 'Content'
    | 'Customers'
    | 'Wallets'
    | 'NerdCoin'
    | 'Settings'
    | 'Staff'
    | 'AuditLog'
    | 'EmailTemplates'
    | 'Recruitment'
    | 'QrGenerator'
    | 'Feedback'
    | 'StudyDate'
    | 'NerdNight'

export async function canView(resource: ViewResource): Promise<{
    session: any | null
    hasAccess: boolean
    role: string | null
}> {
    const permissionKey = `canView${resource}` as PermissionKey
    return checkApiPermission(permissionKey)
}

type ManageResource =
    | 'Rooms'
    | 'Services'
    | 'Locations'
    | 'Posts'
    | 'Gallery'
    | 'Content'
    | 'Customers'
    | 'Wallets'
    | 'NerdCoin'
    | 'Staff'
    | 'EmailTemplates'
    | 'Recruitment'
    | 'StudyDate'
    | 'NerdNight'

export async function canManage(resource: ManageResource): Promise<{
    session: any | null
    hasAccess: boolean
    role: string | null
}> {
    const permissionKey = `canManage${resource}` as PermissionKey
    return checkApiPermission(permissionKey)
}

export async function canBooking(action: 'View' | 'Create' | 'Edit' | 'Delete' | 'CheckIn' | 'CheckOut'): Promise<{
    session: any | null
    hasAccess: boolean
    role: string | null
}> {
    let permissionKey: PermissionKey
    switch (action) {
        case 'View': permissionKey = 'canViewBookings'; break
        case 'Create': permissionKey = 'canCreateBookings'; break
        case 'Edit': permissionKey = 'canEditBookings'; break
        case 'Delete': permissionKey = 'canDeleteBookings'; break
        case 'CheckIn': permissionKey = 'canCheckIn'; break
        case 'CheckOut': permissionKey = 'canCheckOut'; break
    }
    return checkApiPermission(permissionKey)
}
