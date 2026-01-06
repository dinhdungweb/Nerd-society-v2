import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canView, canManage } from '@/lib/apiPermissions'
import { audit } from '@/lib/audit'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET - Lấy chi tiết job (admin)
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canView('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const { id } = await params

        const job = await prisma.job.findUnique({
            where: { id },
            include: {
                _count: { select: { applications: true } },
            },
        })

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json(job)
    } catch (error) {
        console.error('Error fetching job:', error)
        return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
    }
}

// PUT - Cập nhật job (admin)
export async function PUT(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền cập nhật job' }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json()
        const { title, description, location, workShift, requirements, benefits, isActive, sortOrder } = body

        const job = await prisma.job.update({
            where: { id },
            data: {
                title,
                description,
                location,
                workShift,
                requirements,
                benefits,
                isActive,
                sortOrder,
            },
        })

        // Audit Log
        await audit.update(
            session.user.id,
            session.user.name || 'Admin',
            'job',
            job.id,
            { title: job.title, updates: body }
        )

        return NextResponse.json(job)
    } catch (error) {
        console.error('Error updating job:', error)
        return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }
}

// DELETE - Xóa job (admin)
export async function DELETE(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xóa job' }, { status: 403 })
        }

        const { id } = await params

        await prisma.job.delete({ where: { id } })

        // Audit Log
        await audit.delete(
            session.user.id,
            session.user.name || 'Admin',
            'job',
            id,
            { deletedAt: new Date() }
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting job:', error)
        return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }
}
