import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Default Staff permissions
const DEFAULT_ROLE_PERMISSIONS = {
    MANAGER: {
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
    },
    STAFF: {
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
    },
    CONTENT_EDITOR: {
        canViewDashboard: true,
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
        canViewPosts: true,
        canViewNerdCoin: false,
        canViewReports: false,
        canViewSettings: false,
    },
}

const PERMISSION_KEY_PREFIX = 'role_permissions_'

// GET - Get staff permissions based on their role (accessible by STAFF and ADMIN)
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const role = session.user.role as string

        // Check if role exists in defaults
        if (!(role in DEFAULT_ROLE_PERMISSIONS)) {
            return NextResponse.json({ permissions: {} })
        }

        const setting = await prisma.setting.findUnique({
            where: { key: `${PERMISSION_KEY_PREFIX}${role}` },
        })

        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS]
        const permissions = setting
            ? { ...defaultPerms, ...JSON.parse(setting.value) }
            : defaultPerms

        return NextResponse.json({ permissions, role })
    } catch (error) {
        console.error('Error fetching staff permissions:', error)
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
    }
}
