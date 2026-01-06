import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canView } from '@/lib/apiPermissions'

// GET - Lấy danh sách đơn ứng tuyển (admin)
export async function GET(req: Request) {
    try {
        const { session, hasAccess } = await canView('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const jobId = searchParams.get('jobId')
        const status = searchParams.get('status')

        const applications = await prisma.application.findMany({
            where: {
                ...(jobId && { jobId }),
                ...(status && { status: status as any }),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                job: {
                    select: { id: true, title: true },
                },
            },
        })

        return NextResponse.json(applications)
    } catch (error) {
        console.error('Error fetching applications:', error)
        return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }
}
