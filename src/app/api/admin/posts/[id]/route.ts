import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit'

// GET /api/admin/posts/[id] - Get a single post
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                author: {
                    select: { id: true, name: true, email: true },
                },
            },
        })

        if (!post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        }

        return NextResponse.json(post)
    } catch (error) {
        console.error('Error fetching post:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// PUT /api/admin/posts/[id] - Update a post
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()

        const existingPost = await prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        }

        const {
            title,
            slug,
            type,
            excerpt,
            content,
            thumbnail,
            images,
            status,
            eventDate,
            eventTime,
            eventLocation,
            featured,
        } = body

        // Check if new slug conflicts with another post
        if (slug && slug !== existingPost.slug) {
            const slugExists = await prisma.post.findUnique({
                where: { slug },
            })
            if (slugExists) {
                return NextResponse.json(
                    { error: 'Slug already exists' },
                    { status: 400 }
                )
            }
        }

        // Determine publishedAt
        let publishedAt = existingPost.publishedAt
        if (status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED') {
            publishedAt = new Date()
        } else if (status !== 'PUBLISHED') {
            publishedAt = null
        }

        const post = await prisma.post.update({
            where: { id },
            data: {
                title,
                slug,
                type,
                excerpt,
                content,
                thumbnail,
                images,
                status,
                publishedAt,
                eventDate: eventDate ? new Date(eventDate) : null,
                eventTime,
                eventLocation,
                featured,
            },
            include: {
                author: {
                    select: { id: true, name: true, email: true },
                },
            },
        })

        // Audit logging
        await audit.update(
            user.id,
            user.name || user.email || 'Admin',
            'post',
            post.id,
            { title: post.title, type: post.type, status: post.status }
        )

        return NextResponse.json(post)
    } catch (error) {
        console.error('Error updating post:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE /api/admin/posts/[id] - Delete a post
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params

        const existingPost = await prisma.post.findUnique({
            where: { id },
        })

        if (!existingPost) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        }

        await prisma.post.delete({
            where: { id },
        })

        // Audit logging
        await audit.delete(
            user.id,
            user.name || user.email || 'Admin',
            'post',
            id,
            { title: existingPost.title, type: existingPost.type }
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting post:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
