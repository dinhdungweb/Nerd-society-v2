import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'

// GET - Export bookings to CSV
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') || 'bookings'
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        if (type === 'bookings') {
            // Export bookings
            const whereClause: any = {}
            if (startDate && endDate) {
                whereClause.date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                }
            }

            const bookings = await prisma.booking.findMany({
                where: whereClause,
                include: {
                    user: { select: { name: true, email: true, phone: true } },
                    location: { select: { name: true } },
                    room: { select: { name: true, type: true } },
                },
                orderBy: { date: 'desc' },
            })

            // Generate CSV
            const headers = [
                'Mã booking',
                'Ngày',
                'Giờ bắt đầu',
                'Giờ kết thúc',
                'Khách hàng',
                'SĐT',
                'Email',
                'Phòng',
                'Cơ sở',
                'Số khách',
                'Tổng tiền (ước tính)',
                'Tiền cọc',
                'Trạng thái',
                'Ngày tạo',
            ]

            const rows = bookings.map(b => [
                b.bookingCode,
                format(new Date(b.date), 'dd/MM/yyyy'),
                b.startTime,
                b.endTime,
                b.customerName || b.user?.name || '',
                b.customerPhone || b.user?.phone || '',
                b.customerEmail || b.user?.email || '',
                b.room?.name || '',
                b.location.name,
                b.guests.toString(),
                b.estimatedAmount.toString(),
                b.depositAmount.toString(),
                b.status,
                format(new Date(b.createdAt), 'dd/MM/yyyy HH:mm'),
            ])

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
            ].join('\n')

            // Add BOM for Excel UTF-8 compatibility
            const bom = '\uFEFF'
            return new Response(bom + csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="bookings_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`,
                },
            })
        }

        if (type === 'customers') {
            // Export customers
            const customers = await prisma.user.findMany({
                where: { role: 'CUSTOMER' },
                include: {
                    _count: { select: { bookings: true } },
                },
                orderBy: { createdAt: 'desc' },
            })

            const headers = [
                'Tên',
                'Email',
                'SĐT',
                'Giới tính',
                'Địa chỉ',
                'Số lần booking',
                'Ngày đăng ký',
            ]

            const rows = customers.map(c => [
                c.name,
                c.email,
                c.phone || '',
                c.gender || '',
                c.address || '',
                c._count.bookings.toString(),
                format(new Date(c.createdAt), 'dd/MM/yyyy'),
            ])

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
            ].join('\n')

            const bom = '\uFEFF'
            return new Response(bom + csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="customers_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`,
                },
            })
        }

        if (type === 'revenue') {
            // Export revenue report
            const payments = await prisma.payment.findMany({
                where: {
                    status: 'COMPLETED',
                    ...(startDate && endDate
                        ? {
                            paidAt: {
                                gte: new Date(startDate),
                                lte: new Date(endDate),
                            },
                        }
                        : {}),
                },
                include: {
                    booking: {
                        select: {
                            bookingCode: true,
                            customerName: true,
                            location: { select: { name: true } },
                            room: { select: { name: true } },
                        },
                    },
                },
                orderBy: { paidAt: 'desc' },
            })

            const headers = [
                'Ngày thanh toán',
                'Mã booking',
                'Khách hàng',
                'Phòng',
                'Cơ sở',
                'Loại thanh toán',
                'Phương thức',
                'Số tiền',
            ]

            const rows = payments.map(p => [
                p.paidAt ? format(new Date(p.paidAt), 'dd/MM/yyyy HH:mm') : '',
                p.booking.bookingCode,
                p.booking.customerName || '',
                p.booking.room?.name || '',
                p.booking.location.name,
                p.type === 'DEPOSIT' ? 'Cọc' : 'Thanh toán',
                p.method,
                p.amount.toString(),
            ])

            // Calculate totals
            const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
            rows.push(['', '', '', '', '', '', 'TỔNG CỘNG', totalAmount.toString()])

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
            ].join('\n')

            const bom = '\uFEFF'
            return new Response(bom + csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="revenue_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`,
                },
            })
        }

        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    } catch (error) {
        console.error('Error exporting data:', error)
        return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
    }
}
