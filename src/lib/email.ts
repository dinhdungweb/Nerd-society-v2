import nodemailer from 'nodemailer'
import { prisma } from './prisma'

// Get SMTP setting from database with fallback to env
async function getSmtpSetting(key: string, envFallback: string | undefined): Promise<string> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key },
        })
        if (setting?.value) return setting.value
    } catch (error) {
        // Ignore error, use fallback
    }
    return envFallback || ''
}

// Create transporter dynamically using DB settings or env fallback
async function createTransporter() {
    const host = await getSmtpSetting('smtpHost', process.env.SMTP_HOST) || 'smtp.gmail.com'
    const port = parseInt(await getSmtpSetting('smtpPort', process.env.SMTP_PORT) || '587')
    const user = await getSmtpSetting('smtpUser', process.env.SMTP_USER)
    const pass = await getSmtpSetting('smtpPass', process.env.SMTP_PASS)

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    })
}

export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string
    subject: string
    html: string
}) {
    try {
        const smtpUser = await getSmtpSetting('smtpUser', process.env.SMTP_USER)

        // Skip if SMTP is not configured
        if (!smtpUser || smtpUser.includes('your-email')) {
            console.log('⚠️ Email SMTP not configured. Skipping email:', { to, subject })
            return
        }

        const transporter = await createTransporter()
        const smtpFrom = await getSmtpSetting('smtpFrom', process.env.SMTP_FROM) || '"Nerd Society" <no-reply@nerdsociety.com.vn>'

        await transporter.sendMail({
            from: smtpFrom,
            to,
            subject,
            html,
        })
        console.log('✅ Email sent to:', to)
    } catch (error) {
        console.error('❌ Email error:', error)
    }
}

// Helper function to get email template from database
async function getEmailTemplate(name: string): Promise<{ subject: string; content: string } | null> {
    try {
        const template = await prisma.emailTemplate.findUnique({
            where: { name },
        })
        if (template && template.isActive) {
            return { subject: template.subject, content: template.content }
        }
    } catch (error) {
        console.error('Error fetching email template:', error)
    }
    return null
}

// Helper function to replace variables in template
function replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
        // Support both $variable and {{variable}} formats
        result = result.replace(new RegExp(`\\$${key}`, 'g'), value)
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return result
}

// Check if email type is enabled in settings
async function isEmailEnabled(settingKey: string): Promise<boolean> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: settingKey },
        })
        // Default to enabled if setting doesn't exist
        if (!setting) return true
        return setting.value === 'true'
    } catch (error) {
        console.error('Error checking email setting:', error)
        return true // Default to enabled on error
    }
}

export async function sendBookingEmail(booking: any) {
    const isConfirmed = booking.status === 'CONFIRMED'
    const settingKey = isConfirmed ? 'emailBookingConfirmation' : 'emailBookingPending'

    // Check if this email type is enabled in settings
    const enabled = await isEmailEnabled(settingKey)
    if (!enabled) {
        console.log(`⚠️ Email type "${settingKey}" is disabled. Skipping.`)
        return
    }

    console.log('📧 Sending email for booking:', booking.bookingCode, {
        status: booking.status,
        paymentMethod: booking.payment?.method,
        paymentStatus: booking.payment?.status
    })

    // Determine recipient email - prefer user email, fallback to customerEmail
    const recipientEmail = booking.user?.email || booking.customerEmail
    if (!recipientEmail) {
        console.log('⚠️ No email address found for booking:', booking.bookingCode)
        return
    }

    // Get name - prefer user name, fallback to customerName
    const customerName = booking.user?.name || booking.customerName || 'Quý khách'

    // Get service name - prefer room, fallback to combo (for backward compatibility)
    const serviceName = booking.room?.name || booking.combo?.name || 'Dịch vụ'

    // Get amount - prefer estimatedAmount, fallback to totalAmount
    const amount = booking.estimatedAmount || booking.totalAmount || 0
    const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

    const templateName = isConfirmed ? 'booking_confirmation' : 'booking_pending'

    // Prepare variables for template
    const variables: Record<string, string> = {
        customerName,
        bookingCode: booking.bookingCode,
        locationName: booking.location?.name || 'N/A',
        serviceName,
        date: new Date(booking.date).toLocaleDateString('vi-VN'),
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount: formattedAmount,
        bookingUrl: `${process.env.NEXTAUTH_URL}/profile/bookings/${booking.id}`,
    }

    // Try to get template from database
    const dbTemplate = await getEmailTemplate(templateName)

    let subject: string
    let html: string

    if (dbTemplate) {
        // Use template from database
        subject = replaceVariables(dbTemplate.subject, variables)
        html = replaceVariables(dbTemplate.content, variables)
        console.log(`📧 Using DB template: ${templateName}`)
    } else {
        // Fallback to default template
        console.log(`📧 No DB template found for "${templateName}", using default`)

        let description = 'Chúng tôi đã nhận được yêu cầu đặt lịch của bạn. Vui lòng thanh toán để hoàn tất.'
        if (isConfirmed) {
            if (booking.payment?.method === 'CASH') {
                description = 'Đặt lịch của bạn đã được xác nhận. Vui lòng thanh toán tại quầy khi đến.'
            } else {
                description = 'Cảm ơn bạn đã thanh toán. Đặt lịch của bạn đã được xác nhận.'
            }
        }

        subject = isConfirmed
            ? `[Nerd Society] Xác nhận đặt lịch #${booking.bookingCode}`
            : `[Nerd Society] Tiếp nhận đặt lịch #${booking.bookingCode}`

        html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">${isConfirmed ? 'Đặt lịch thành công!' : 'Đã nhận yêu cầu đặt lịch'}</h1>
          <p>Xin chào ${customerName},</p>
          <p>${description}</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Thông tin chi tiết:</h3>
            <p><strong>Mã đặt lịch:</strong> ${booking.bookingCode}</p>
            <p><strong>Cơ sở:</strong> ${booking.location?.name || 'N/A'}</p>
            <p><strong>Dịch vụ:</strong> ${serviceName}</p>
            <p><strong>Thời gian:</strong> ${variables.date} | ${booking.startTime} - ${booking.endTime}</p>
            <p><strong>Tổng tiền:</strong> ${formattedAmount}</p>
          </div>

          <p>Bạn có thể xem chi tiết và quản lý đặt lịch tại:</p>
          <a href="${variables.bookingUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Xem chi tiết</a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">Nerd Society - Study & Work Space</p>
        </div>
      `
    }

    await sendEmail({ to: recipientEmail, subject, html })
}

export async function sendPasswordResetEmail(email: string, token: string) {
    // Check if this email type is enabled in settings
    const enabled = await isEmailEnabled('emailPasswordReset')
    if (!enabled) {
        console.log('⚠️ Email type "emailPasswordReset" is disabled. Skipping.')
        return
    }

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

    // Try to get template from database
    const dbTemplate = await getEmailTemplate('password_reset')

    let subject: string
    let html: string

    const variables: Record<string, string> = {
        resetUrl,
        email,
    }

    if (dbTemplate) {
        subject = replaceVariables(dbTemplate.subject, variables)
        html = replaceVariables(dbTemplate.content, variables)
        console.log('📧 Using DB template: password_reset')
    } else {
        console.log('📧 No DB template found for "password_reset", using default')

        subject = '[Nerd Society] Yêu cầu đặt lại mật khẩu'

        html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">Đặt lại mật khẩu</h1>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Nerd Society của bạn.</p>
          <p>Vui lòng nhấn vào nút bên dưới để đặt lại mật khẩu (đường dẫn có hiệu lực trong 1 giờ):</p>
          
          <div style="text-align: left; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Đặt lại mật khẩu</a>
          </div>

          <p>Nếu bạn không yêu cầu thay đổi này, vui lòng bỏ qua email này.</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">Nerd Society - Study & Work Space</p>
        </div>
      `
    }

    await sendEmail({ to: email, subject, html })
}

// Send booking cancelled email
export async function sendBookingCancelledEmail(booking: any) {
    // Check if this email type is enabled in settings
    const enabled = await isEmailEnabled('emailBookingCancelled')
    if (!enabled) {
        console.log('⚠️ Email type "emailBookingCancelled" is disabled. Skipping.')
        return
    }

    console.log('📧 Sending cancellation email for booking:', booking.bookingCode)

    const recipientEmail = booking.user?.email || booking.customerEmail
    if (!recipientEmail) {
        console.log('⚠️ No email address found for booking:', booking.bookingCode)
        return
    }

    const customerName = booking.user?.name || booking.customerName || 'Quý khách'
    const serviceName = booking.room?.name || booking.combo?.name || 'Dịch vụ'
    const amount = booking.estimatedAmount || booking.totalAmount || 0
    const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

    const variables: Record<string, string> = {
        customerName,
        bookingCode: booking.bookingCode,
        locationName: booking.location?.name || 'N/A',
        serviceName,
        date: new Date(booking.date).toLocaleDateString('vi-VN'),
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount: formattedAmount,
    }

    const dbTemplate = await getEmailTemplate('booking_cancelled')

    let subject: string
    let html: string

    if (dbTemplate) {
        subject = replaceVariables(dbTemplate.subject, variables)
        html = replaceVariables(dbTemplate.content, variables)
        console.log('📧 Using DB template: booking_cancelled')
    } else {
        console.log('📧 No DB template found for "booking_cancelled", using default')

        subject = `[Nerd Society] Đặt lịch #${booking.bookingCode} đã bị hủy`

        html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">Đặt lịch đã bị hủy</h1>
          <p>Xin chào ${customerName},</p>
          <p>Đặt lịch của bạn đã bị hủy.</p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin-top: 0; color: #dc2626;">Thông tin đặt lịch đã hủy:</h3>
            <p><strong>Mã đặt lịch:</strong> ${booking.bookingCode}</p>
            <p><strong>Cơ sở:</strong> ${booking.location?.name || 'N/A'}</p>
            <p><strong>Dịch vụ:</strong> ${serviceName}</p>
            <p><strong>Thời gian:</strong> ${variables.date} | ${booking.startTime} - ${booking.endTime}</p>
          </div>

          <p>Nếu bạn đã thanh toán cọc, vui lòng liên hệ với chúng tôi để được hoàn tiền.</p>
          <p>Nếu có thắc mắc, xin liên hệ hotline: <strong>036 848 3689</strong></p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">Nerd Society - Study & Work Space</p>
        </div>
      `
    }

    await sendEmail({ to: recipientEmail, subject, html })
}

// Send check-in reminder email  
export async function sendCheckinReminderEmail(booking: any) {
    // Check if this email type is enabled in settings
    const enabled = await isEmailEnabled('emailCheckinReminder')
    if (!enabled) {
        console.log('⚠️ Email type "emailCheckinReminder" is disabled. Skipping.')
        return
    }

    console.log('📧 Sending check-in reminder for booking:', booking.bookingCode)

    const recipientEmail = booking.user?.email || booking.customerEmail
    if (!recipientEmail) {
        console.log('⚠️ No email address found for booking:', booking.bookingCode)
        return
    }

    const customerName = booking.user?.name || booking.customerName || 'Quý khách'
    const serviceName = booking.room?.name || booking.combo?.name || 'Dịch vụ'

    const variables: Record<string, string> = {
        customerName,
        bookingCode: booking.bookingCode,
        locationName: booking.location?.name || 'N/A',
        serviceName,
        date: new Date(booking.date).toLocaleDateString('vi-VN'),
        startTime: booking.startTime,
        endTime: booking.endTime,
        bookingUrl: `${process.env.NEXTAUTH_URL}/profile/bookings/${booking.id}`,
    }

    const dbTemplate = await getEmailTemplate('checkin_reminder')

    let subject: string
    let html: string

    if (dbTemplate) {
        subject = replaceVariables(dbTemplate.subject, variables)
        html = replaceVariables(dbTemplate.content, variables)
        console.log('📧 Using DB template: checkin_reminder')
    } else {
        console.log('📧 No DB template found for "checkin_reminder", using default')

        subject = `[Nerd Society] Nhắc nhở check-in đặt lịch #${booking.bookingCode}`

        html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">Nhắc nhở check-in</h1>
          <p>Xin chào ${customerName},</p>
          <p>Đây là lời nhắc cho đặt lịch sắp tới của bạn. Đừng quên đến đúng giờ nhé!</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #d97706;">📅 Thông tin đặt lịch:</h3>
            <p><strong>Mã đặt lịch:</strong> ${booking.bookingCode}</p>
            <p><strong>Cơ sở:</strong> ${booking.location?.name || 'N/A'}</p>
            <p><strong>Dịch vụ:</strong> ${serviceName}</p>
            <p><strong>Thời gian:</strong> ${variables.date} | ${booking.startTime} - ${booking.endTime}</p>
          </div>

          <p>📍 Địa chỉ: ${booking.location?.address || 'Xem chi tiết tại link bên dưới'}</p>

          <p>Bạn có thể xem chi tiết đặt lịch tại:</p>
          <a href="${variables.bookingUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Xem chi tiết</a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">Nerd Society - Study & Work Space</p>
        </div>
      `
    }

    await sendEmail({ to: recipientEmail, subject, html })
}
