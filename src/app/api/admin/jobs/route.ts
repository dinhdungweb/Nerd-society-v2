import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canView, canManage } from '@/lib/apiPermissions'
import { audit } from '@/lib/audit'

// GET - Lấy tất cả jobs (admin)
export async function GET() {
    try {
        const { session, hasAccess } = await canView('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
        }

        const jobs = await prisma.job.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: { select: { applications: true } },
            },
        })

        return NextResponse.json(jobs)
    } catch (error) {
        console.error('Error fetching jobs:', error)
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }
}

// POST - Tạo job mới (admin)
export async function POST(req: Request) {
    try {
        const { session, hasAccess } = await canManage('Recruitment')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền tạo job' }, { status: 403 })
        }

        const body = await req.json()
        const { title, description, location, workShift, requirements, benefits, isActive, sortOrder } = body

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')

        // Check if slug exists
        const existingJob = await prisma.job.findUnique({ where: { slug } })
        const finalSlug = existingJob ? `${slug}-${Date.now()}` : slug

        const job = await prisma.job.create({
            data: {
                title,
                slug: finalSlug,
                description,
                location,
                workShift,
                requirements,
                benefits,
                isActive: isActive ?? true,
                sortOrder: sortOrder ?? 0,
            },
        })

        // Audit Log
        await audit.create(
            session.user.id,
            session.user.name || 'Admin',
            'job',
            job.id,
            { title: job.title, slug: job.slug }
        )

        return NextResponse.json(job)
    } catch (error) {
        console.error('Error creating job:', error)
        return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }
}
