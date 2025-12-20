import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { audit } from '@/lib/audit'

// GET - List all staff
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const staff = await prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'MANAGER', 'STAFF', 'CONTENT_EDITOR'] },
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                assignedLocationId: true,
                assignedLocation: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        })

        const locations = await prisma.location.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        })

        return NextResponse.json({ staff, locations })
    } catch (error) {
        console.error('Error fetching staff:', error)
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
    }
}

// POST - Create new staff
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { name, email, phone, password, role, assignedLocationId } = await req.json()

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        })

        if (existingUser) {
            return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                phone,
                password: hashedPassword,
                role: role || 'STAFF',
                assignedLocationId: assignedLocationId || null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                assignedLocationId: true,
                createdAt: true,
            },
        })

        // Audit logging
        await audit.create(
            session.user.id || 'unknown',
            session.user.name || session.user.email || 'Admin',
            'user',
            user.id,
            { name: user.name, email: user.email, role: user.role }
        )

        return NextResponse.json(user)
    } catch (error) {
        console.error('Error creating staff:', error)
        return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
    }
}

// PATCH - Update staff
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { id, name, phone, role, assignedLocationId, password } = await req.json()

        if (!id) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
        }

        const updateData: any = {}
        if (name) updateData.name = name
        if (phone !== undefined) updateData.phone = phone
        if (role) updateData.role = role
        if (assignedLocationId !== undefined) updateData.assignedLocationId = assignedLocationId || null
        if (password) {
            updateData.password = await bcrypt.hash(password, 12)
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                assignedLocationId: true,
                assignedLocation: {
                    select: { id: true, name: true },
                },
                createdAt: true,
            },
        })

        // Audit logging
        await audit.update(
            session.user.id || 'unknown',
            session.user.name || session.user.email || 'Admin',
            'user',
            user.id,
            { name: user.name, email: user.email, role: user.role }
        )

        return NextResponse.json(user)
    } catch (error) {
        console.error('Error updating staff:', error)
        return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
    }
}

// DELETE - Delete staff
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
        }

        // Prevent self-deletion
        const currentUser = await prisma.user.findUnique({
            where: { email: session.user.email! },
            select: { id: true },
        })

        if (currentUser?.id === id) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
        }

        // Get user info before deletion for audit
        const userToDelete = await prisma.user.findUnique({
            where: { id },
            select: { name: true, email: true }
        })

        await prisma.user.delete({
            where: { id },
        })

        // Audit logging
        await audit.delete(
            session.user.id || 'unknown',
            session.user.name || session.user.email || 'Admin',
            'user',
            id,
            { name: userToDelete?.name, email: userToDelete?.email }
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting staff:', error)
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
    }
}
