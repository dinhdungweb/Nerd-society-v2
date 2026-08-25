import {
    ADMIN_PERMISSION_KEYS,
    AdminPermissions,
    ConfigurableAdminRole,
    DEFAULT_ROLE_PERMISSIONS,
} from '@/config/admin'
import { authOptions } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

const PERMISSION_KEY_PREFIX = 'role_permissions_'

function isConfigurableRole(role: unknown): role is ConfigurableAdminRole {
    return role === 'MANAGER' || role === 'STAFF' || role === 'CONTENT_EDITOR'
}

function normalizePermissions(role: ConfigurableAdminRole, value: unknown): AdminPermissions {
    const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const overrides = Object.fromEntries(
        ADMIN_PERMISSION_KEYS
            .filter((key) => typeof input[key] === 'boolean')
            .map((key) => [key, input[key]]),
    ) as Partial<AdminPermissions>

    return { ...DEFAULT_ROLE_PERMISSIONS[role], ...overrides }
}

async function getStoredPermissions(role: ConfigurableAdminRole): Promise<AdminPermissions> {
    const setting = await prisma.setting.findUnique({
        where: { key: `${PERMISSION_KEY_PREFIX}${role}` },
    })

    if (!setting) return DEFAULT_ROLE_PERMISSIONS[role]

    try {
        return normalizePermissions(role, JSON.parse(setting.value))
    } catch {
        return DEFAULT_ROLE_PERMISSIONS[role]
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const role = searchParams.get('role')

        if (role) {
            if (!isConfigurableRole(role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
            }

            return NextResponse.json({
                role,
                permissions: await getStoredPermissions(role),
                defaults: DEFAULT_ROLE_PERMISSIONS[role],
            })
        }

        const entries = await Promise.all(
            (Object.keys(DEFAULT_ROLE_PERMISSIONS) as ConfigurableAdminRole[])
                .map(async (roleKey) => [roleKey, await getStoredPermissions(roleKey)] as const),
        )

        return NextResponse.json({
            permissions: Object.fromEntries(entries),
            defaults: DEFAULT_ROLE_PERMISSIONS,
        })
    } catch (error) {
        console.error('Error fetching permissions:', error)
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await req.json()
        if (!isConfigurableRole(body.role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const permissions = normalizePermissions(body.role, body.permissions)
        await prisma.setting.upsert({
            where: { key: `${PERMISSION_KEY_PREFIX}${body.role}` },
            update: { value: JSON.stringify(permissions) },
            create: { key: `${PERMISSION_KEY_PREFIX}${body.role}`, value: JSON.stringify(permissions) },
        })

        await audit.update(
            session.user.id || 'unknown',
            session.user.name || session.user.email || 'Admin',
            'permissions',
            body.role,
            { role: body.role, permissions },
        )

        return NextResponse.json({ success: true, role: body.role, permissions })
    } catch (error) {
        console.error('Error updating permissions:', error)
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }
}
