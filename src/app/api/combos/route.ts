import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { kebabCase } from 'lodash'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await req.json()
        const { name, duration, price, description, features, sortOrder, isActive, isPopular } = body

        if (!name || !duration || !price || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const combo = await prisma.combo.create({
            data: {
                name,
                slug: kebabCase(name) + '-' + Date.now(),
                duration: parseInt(duration),
                price: parseInt(price),
                description,
                features: Array.isArray(features) ? features : [features],
                sortOrder: sortOrder ? parseInt(sortOrder) : 0,
                isActive: isActive !== undefined ? isActive : true,
                isPopular: isPopular || false,
            },
        })

        return NextResponse.json(combo)
    } catch (error) {
        console.error('Create combo error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
