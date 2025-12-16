import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

// GET - Lấy thông tin 1 location
export async function GET(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    try {
        const location = await prisma.location.findUnique({
            where: { id: params.id },
        })

        if (!location) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 })
        }

        return NextResponse.json(location)
    } catch (error) {
        console.error('Error fetching location:', error)
        return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 })
    }
}

// PUT - Cập nhật location
export async function PUT(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await req.json()
        const { name, address, phone, mapUrl, image, isActive } = body

        const location = await prisma.location.update({
            where: { id: params.id },
            data: {
                ...(name && { name }),
                ...(address && { address }),
                ...(phone && { phone }),
                ...(mapUrl !== undefined && { mapUrl }),
                ...(image !== undefined && { image }),
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json(location)
    } catch (error) {
        console.error('Update location error:', error)
        return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
    }
}

// DELETE - Xóa location
export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Check if location has rooms
        const roomCount = await prisma.room.count({
            where: { locationId: params.id }
        })

        if (roomCount > 0) {
            return NextResponse.json(
                { error: 'Không thể xóa cơ sở có phòng. Vui lòng xóa hoặc chuyển phòng trước.' },
                { status: 400 }
            )
        }

        await prisma.location.delete({
            where: { id: params.id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete location error:', error)
        return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
    }
}
