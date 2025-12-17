import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Lấy chi tiết phòng
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const room = await prisma.room.findUnique({
            where: { id },
            include: {
                location: true,
                bookings: {
                    take: 10,
                    orderBy: { date: 'desc' },
                },
            },
        })

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }

        return NextResponse.json(room)
    } catch (error) {
        console.error('Error fetching room:', error)
        return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 })
    }
}

// PUT - Cập nhật phòng (ADMIN only)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Chỉ Admin mới có thể sửa phòng' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { name, type, description, capacity, amenities, image, isActive, locationId } = body

        const room = await prisma.room.update({
            where: { id },
            data: {
                name,
                type,
                description,
                capacity: capacity ? parseInt(capacity) : undefined,
                amenities,
                image,
                isActive,
                locationId,
            },
            include: {
                location: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        return NextResponse.json(room)
    } catch (error) {
        console.error('Error updating room:', error)
        return NextResponse.json({ error: 'Failed to update room' }, { status: 500 })
    }
}

// DELETE - Xóa phòng (ADMIN only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Chỉ Admin mới có thể xóa phòng' }, { status: 403 })
        }

        const { id } = await params

        // Check if room has bookings
        const bookingsCount = await prisma.booking.count({
            where: { roomId: id },
        })

        if (bookingsCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete room with existing bookings. Deactivate it instead.' },
                { status: 400 }
            )
        }

        await prisma.room.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting room:', error)
        return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 })
    }
}
