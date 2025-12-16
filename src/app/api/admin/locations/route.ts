import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

// GET - Lấy danh sách locations
export async function GET() {
    try {
        const locations = await prisma.location.findMany({
            orderBy: { name: 'asc' },
        })
        return NextResponse.json(locations)
    } catch (error) {
        console.error('Error fetching locations:', error)
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await req.json()
        const { name, address, phone, mapUrl, image, isActive } = body

        if (!name || !address || !phone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const location = await prisma.location.create({
            data: {
                name,
                address,
                phone,
                mapUrl,
                image,
                isActive: isActive !== undefined ? isActive : true,
            },
        })

        return NextResponse.json(location)
    } catch (error) {
        console.error('Create location error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
