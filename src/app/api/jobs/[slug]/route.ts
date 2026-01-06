import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface RouteParams {
    params: Promise<{ slug: string }>
}

// GET - Lấy chi tiết job theo slug (public)
export async function GET(req: Request, { params }: RouteParams) {
    try {
        const { slug } = await params

        const job = await prisma.job.findUnique({
            where: { slug },
            select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                location: true,
                workShift: true,
                requirements: true,
                benefits: true,
                isActive: true,
                createdAt: true,
            },
        })

        if (!job || !job.isActive) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json(job)
    } catch (error) {
        console.error('Error fetching job:', error)
        return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
    }
}
