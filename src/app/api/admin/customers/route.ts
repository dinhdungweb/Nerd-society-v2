import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { canView } from '@/lib/apiPermissions'

export const dynamic = 'force-dynamic'

// GET - Fetch all customers (requires canViewCustomers permission)
export async function GET() {
    try {
        const { session, hasAccess } = await canView('Customers')

        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem khách hàng' }, { status: 403 })
        }

        const customers = await prisma.user.findMany({
            where: {
                role: {
                    in: ['CUSTOMER', 'STAFF', 'MANAGER', 'CONTENT_EDITOR']
                }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                createdAt: true,
                isLocked: true,
                // V2 Member Profile fields
                region: true,
                occupation: true,
                profileCompletedAt: true,
                _count: { select: { bookings: true } },
            },
        })

        return NextResponse.json(customers)
    } catch (error) {
        console.error('Error fetching customers:', error)
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }
}
