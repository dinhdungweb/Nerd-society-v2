import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canView, canManage } from '@/lib/apiPermissions'
import { audit } from '@/lib/audit'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET - Lấy chi tiết đơn ứng tuyển (admin)
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canView('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const { id } = await params

        const application = await prisma.application.findUnique({
            where: { id },
            include: {
                job: {
                    select: { id: true, title: true, location: true },
                },
            },
        })

        if (!application) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        return NextResponse.json(application)
    } catch (error) {
        console.error('Error fetching application:', error)
        return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 })
    }
}

// PUT - Cập nhật status/notes đơn ứng tuyển (admin)
export async function PUT(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền cập nhật' }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json()
        const { status, notes } = body

        const application = await prisma.application.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(notes !== undefined && { notes }),
            },
        })

        // Audit Log
        if (status || notes !== undefined) {
            await audit.update(
                session.user.id,
                session.user.name || 'Admin',
                'application',
                id,
                { status, notes }
            )
        }

        return NextResponse.json(application)
    } catch (error) {
        console.error('Error updating application:', error)
        return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }
}
