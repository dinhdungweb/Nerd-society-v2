import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Lấy danh sách Services
export async function GET() {
    try {
        const services = await prisma.service.findMany({
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json(services)
    } catch (error) {
        console.error('Error fetching services:', error)
        return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }
}

// POST - Tạo Service mới
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            name,
            slug,
            type,
            description,
            priceSmall,
            priceLarge,
            priceFirstHour,
            pricePerHour,
            nerdCoinReward,
            minDuration,
            timeStep,
            features,
            icon,
            image,
        } = body

        if (!name || !slug || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: name, slug, type' },
                { status: 400 }
            )
        }

        // Check slug unique
        const existing = await prisma.service.findUnique({ where: { slug } })
        if (existing) {
            return NextResponse.json(
                { error: 'Slug already exists' },
                { status: 400 }
            )
        }

        const service = await prisma.service.create({
            data: {
                name,
                slug,
                type,
                description,
                priceSmall: priceSmall ? parseInt(priceSmall) : null,
                priceLarge: priceLarge ? parseInt(priceLarge) : null,
                priceFirstHour: priceFirstHour ? parseInt(priceFirstHour) : null,
                pricePerHour: pricePerHour ? parseInt(pricePerHour) : null,
                nerdCoinReward: parseInt(nerdCoinReward) || 0,
                minDuration: parseInt(minDuration) || 60,
                timeStep: parseInt(timeStep) || 30,
                features: features || [],
                icon,
                image,
            },
        })

        return NextResponse.json(service, { status: 201 })
    } catch (error) {
        console.error('Error creating service:', error)
        return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
    }
}
