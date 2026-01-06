import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canManage } from '@/lib/apiPermissions'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET - Get single feedback detail
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Settings')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const { id } = await params

        const feedback = await prisma.feedback.findUnique({
            where: { id },
        })

        if (!feedback) {
            return NextResponse.json({ error: 'Không tìm thấy góp ý' }, { status: 404 })
        }

        return NextResponse.json(feedback)
    } catch (error) {
        console.error('Error fetching feedback:', error)
        return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
    }
}

// PATCH - Update feedback status/notes
export async function PATCH(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Settings')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền chỉnh sửa' }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json()
        const { status, adminNote } = body

        const feedback = await prisma.feedback.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(adminNote !== undefined && { adminNote }),
            },
        })

        return NextResponse.json(feedback)
    } catch (error) {
        console.error('Error updating feedback:', error)
        return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
    }
}

// DELETE - Remove feedback
export async function DELETE(req: Request, { params }: RouteParams) {
    try {
        const { session, hasAccess } = await canManage('Settings')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 })
        }

        const { id } = await params

        await prisma.feedback.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting feedback:', error)
        return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
    }
}
