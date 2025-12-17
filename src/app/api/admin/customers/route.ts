import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

// GET - Fetch all customers (ADMIN and STAFF can view)
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const customers = await prisma.user.findMany({
            where: { role: 'CUSTOMER' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                createdAt: true,
                _count: { select: { bookings: true } },
            },
        })

        return NextResponse.json(customers)
    } catch (error) {
        console.error('Error fetching customers:', error)
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }
}
