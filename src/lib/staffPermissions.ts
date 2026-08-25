import {
    ADMIN_ROUTE_PERMISSIONS,
    AdminPermissions,
    DEFAULT_ROLE_PERMISSIONS,
    getAdminRoutePermission,
} from '@/config/admin'
import { prisma } from '@/lib/prisma'

export const DEFAULT_STAFF_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.STAFF
export type StaffPermissions = AdminPermissions

const PERMISSION_KEY = 'staff_permissions'

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

export const PERMISSION_ROUTE_MAP = ADMIN_ROUTE_PERMISSIONS

export function isRouteAllowedForStaff(pathname: string, permissions: StaffPermissions): boolean {
    const permissionKey = getAdminRoutePermission(pathname)
    return permissionKey ? permissions[permissionKey] ?? false : false
}

export function getAllowedRoutesForStaff(permissions: StaffPermissions): string[] {
    return Object.entries(PERMISSION_ROUTE_MAP)
        .filter(([, permissionKey]) => permissions[permissionKey])
        .map(([route]) => route)
}
