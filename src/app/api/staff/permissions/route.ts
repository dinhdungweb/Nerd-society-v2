import { ConfigurableAdminRole, DEFAULT_ROLE_PERMISSIONS } from '@/config/admin'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const PERMISSION_KEY_PREFIX = 'role_permissions_'

function isConfigurableRole(role: string): role is ConfigurableAdminRole {
    return role === 'MANAGER' || role === 'STAFF' || role === 'CONTENT_EDITOR'
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const role = session.user.role as string
        if (!isConfigurableRole(role)) {
            return NextResponse.json({ permissions: {} })
        }

        const setting = await prisma.setting.findUnique({
            where: { key: `${PERMISSION_KEY_PREFIX}${role}` },
        })

        const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role]
        const permissions = setting
            ? { ...defaultPermissions, ...JSON.parse(setting.value) }
            : defaultPermissions

        return NextResponse.json({ permissions, role })
    } catch (error) {
        console.error('Error fetching staff permissions:', error)
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
    }
}
