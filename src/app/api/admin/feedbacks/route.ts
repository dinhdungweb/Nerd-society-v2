import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canView } from '@/lib/apiPermissions'

export const dynamic = 'force-dynamic'

// GET - List all feedbacks (Admin only)
export async function GET(req: Request) {
    try {
        const { session, hasAccess } = await canView('Feedback')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')

        const where: Record<string, unknown> = {}
        if (status) where.status = status
        if (type) where.type = type

        const [feedbacks, total] = await Promise.all([
            prisma.feedback.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.feedback.count({ where }),
        ])

        return NextResponse.json({
            feedbacks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('Error fetching feedbacks:', error)
        return NextResponse.json({ error: 'Failed to fetch feedbacks' }, { status: 500 })
    }
}
