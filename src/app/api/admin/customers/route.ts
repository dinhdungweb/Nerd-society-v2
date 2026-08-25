import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { canView } from '@/lib/apiPermissions'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const CUSTOMER_ROLES = ['CUSTOMER', 'STAFF', 'MANAGER', 'CONTENT_EDITOR'] as const

// GET - Fetch a paginated, filterable customer list.
export async function GET(req: Request) {
    try {
        const { session, hasAccess } = await canView('Customers')

        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem khách hàng' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const page = Math.max(1, Number(searchParams.get('page')) || 1)
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize')) || 10))
        const search = searchParams.get('q')?.trim() || ''
        const region = searchParams.get('region')?.trim() || ''
        const occupation = searchParams.get('occupation')?.trim() || ''
        const profile = searchParams.get('profile') || 'all'
        const sortBy = searchParams.get('sortBy') || 'createdAt'
        const sortOrder: Prisma.SortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

        const baseWhere: Prisma.UserWhereInput = {
            role: { in: [...CUSTOMER_ROLES] },
        }
        const where: Prisma.UserWhereInput = {
            ...baseWhere,
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                ],
            } : {}),
            ...(region ? { region } : {}),
            ...(occupation ? { occupation } : {}),
            ...(profile === 'completed' ? { profileCompletedAt: { not: null } } : {}),
            ...(profile === 'incomplete' ? { profileCompletedAt: null } : {}),
        }

        const orderBy: Prisma.UserOrderByWithRelationInput = sortBy === 'name'
            ? { name: sortOrder }
            : sortBy === 'bookings'
                ? { bookings: { _count: sortOrder } }
                : { createdAt: sortOrder }

        const [customers, filteredTotal, total, completed, regionGroups, occupationGroups] = await Promise.all([
            prisma.user.findMany({
            where,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                createdAt: true,
                isLocked: true,
                // V2 Member Profile fields
                region: true,
                occupation: true,
                school: true,
                visitPurpose: true,
                profileCompletedAt: true,
                dateOfBirth: true,
                _count: { select: { bookings: true } },
            },
            }),
            prisma.user.count({ where }),
            prisma.user.count({ where: baseWhere }),
            prisma.user.count({ where: { ...baseWhere, profileCompletedAt: { not: null } } }),
            prisma.user.groupBy({
                by: ['region'],
                where: { ...baseWhere, region: { not: null } },
                orderBy: { region: 'asc' },
            }),
            prisma.user.groupBy({
                by: ['occupation'],
                where: { ...baseWhere, occupation: { not: null } },
                orderBy: { occupation: 'asc' },
            }),
        ])

        return NextResponse.json({
            data: customers,
            pagination: {
                page,
                pageSize,
                total: filteredTotal,
                totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
            },
            stats: {
                total,
                completed,
                incomplete: total - completed,
                regions: regionGroups.map((item) => item.region).filter(Boolean),
                occupations: occupationGroups.map((item) => item.occupation).filter(Boolean),
            },
        })
    } catch (error) {
        console.error('Error fetching customers:', error)
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }
}
