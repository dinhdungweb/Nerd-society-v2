import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Lấy danh sách jobs active (public)
export async function GET() {
    try {
        const jobs = await prisma.job.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                location: true,
                workShift: true,
                requirements: true,
                benefits: true,
                createdAt: true,
            },
        })

        return NextResponse.json(jobs)
    } catch (error) {
        console.error('Error fetching jobs:', error)
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }
}
