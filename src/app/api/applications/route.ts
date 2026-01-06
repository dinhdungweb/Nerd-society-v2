import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { sendApplicationEmail, sendAdminNewApplicationEmail } from '@/lib/email'

// POST - Gửi đơn ứng tuyển (public)
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { jobId, name, phone, email, preferredLocation, cvUrl, availability } = body

        // Validate required fields
        if (!jobId || !name || !phone || !preferredLocation) {
            return NextResponse.json(
                { error: 'Vui lòng điền đầy đủ thông tin bắt buộc' },
                { status: 400 }
            )
        }

        // Check if job exists and is active
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: { id: true, title: true, isActive: true },
        })

        if (!job || !job.isActive) {
            return NextResponse.json(
                { error: 'Vị trí tuyển dụng không tồn tại hoặc đã đóng' },
                { status: 404 }
            )
        }

        // Create application
        const application = await prisma.application.create({
            data: {
                jobId,
                name,
                phone,
                email: email || null,
                preferredLocation,
                cvUrl: cvUrl || null,
                availability: availability || null,
            },
        })

        // Prepare application data with job title for emails
        const applicationWithJob = {
            ...application,
            job: { title: job.title }
        }

        // Send emails asynchronously (don't block response)
        Promise.all([
            sendApplicationEmail(applicationWithJob),
            sendAdminNewApplicationEmail(applicationWithJob)
        ]).catch(err => console.error('Error sending application emails:', err))

        return NextResponse.json({
            success: true,
            message: 'Đã gửi đơn ứng tuyển thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.',
            applicationId: application.id,
        })
    } catch (error) {
        console.error('Error creating application:', error)
        return NextResponse.json(
            { error: 'Không thể gửi đơn ứng tuyển. Vui lòng thử lại sau.' },
            { status: 500 }
        )
    }
}
