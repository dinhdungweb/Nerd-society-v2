import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

interface RouteParams {
    params: Promise<{ id: string }>
}

// Check if user has permission based on saved role settings
async function hasNerdCoinPermission(role: string): Promise<boolean> {
    if (role === 'ADMIN') return true

    try {
        const setting = await prisma.setting.findUnique({
            where: { key: `role_permissions_${role}` },
        })

        if (setting) {
            const permissions = JSON.parse(setting.value)
            return permissions.canViewNerdCoin === true
        }

        // Default permissions
        if (role === 'MANAGER') return true
        return false
    } catch {
        return false
    }
}

// GET - Fetch transaction history for a customer
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const role = session.user.role as string
        const hasAccess = await hasNerdCoinPermission(role)

        if (!hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem lịch sử Nerd Coin' }, { status: 403 })
        }

        const { id } = await params

        const transactions = await prisma.nerdCoinTransaction.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                nerdCoinBalance: true,
                nerdCoinTier: true,
            },
        })

        return NextResponse.json({ user, transactions })
    } catch (error) {
        console.error('Error fetching transactions:', error)
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }
}
