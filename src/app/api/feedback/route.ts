import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, email, phone, type, subject, content, images } = body

        // Validation
        if (!name || !content) {
            return NextResponse.json(
                { error: 'Vui lòng điền họ tên và nội dung góp ý' },
                { status: 400 }
            )
        }

        // Get user if logged in
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id || null

        const feedback = await prisma.feedback.create({
            data: {
                userId,
                name,
                email: email || null,
                phone: phone || null,
                type: type || 'OTHER',
                subject: subject || null,
                content,
                images: images || [],
            },
        })

        // TODO: Send email notification to admin

        return NextResponse.json({ success: true, id: feedback.id })
    } catch (error) {
        console.error('Error creating feedback:', error)
        return NextResponse.json(
            { error: 'Không thể gửi góp ý. Vui lòng thử lại sau.' },
            { status: 500 }
        )
    }
}
