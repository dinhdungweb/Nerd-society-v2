import { canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const walletStatusLabels: Record<string, string> = {
    ACTIVE: 'Đang hoạt động',
    LOCKED: 'Đang bị khóa',
}

const transactionTypeLabels: Record<string, string> = {
    TOPUP: 'Nạp tiền',
    DEBIT: 'Trừ tiền',
    ADJUSTMENT: 'Điều chỉnh số dư',
    REFUND: 'Hoàn tiền',
    BOOKING_PAYMENT: 'Thanh toán đặt lịch',
    SUBSCRIPTION_PURCHASE: 'Mua gói thành viên',
    SESSION_CHARGE: 'Phí sử dụng không gian',
    OVERAGE_CHARGE: 'Phí quá giờ',
    OVERAGE_PAYMENT: 'Thanh toán công nợ',
}

const transactionSourceLabels: Record<string, string> = {
    SYSTEM: 'Hệ thống',
    VIETQR: 'VietQR',
    MANUAL_ADMIN: 'Quản trị viên',
    BOOKING: 'Đặt lịch',
    SUBSCRIPTION: 'Gói thành viên',
    MONTHLY_BEAVER: 'Monthly Beaver',
}

const transactionStatusLabels: Record<string, string> = {
    PENDING: 'Đang xử lý',
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    REVERSED: 'Đã hoàn tác',
}

function formatCsvDateTime(value: Date | null) {
    if (!value) return ''

    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(value)
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''

    return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}:${part('second')}`
}

function getBankReferenceNumber(rawPayload: unknown) {
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return ''

    const payload = rawPayload as Record<string, unknown>
    const value =
        payload.referencenumber ?? payload.referenceNumber ?? payload.reference_number ?? payload.refNo ?? payload.refno

    return value === null || value === undefined ? '' : String(value)
}

function csvEscape(value: unknown) {
    let text = String(value ?? '')
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
    try {
        const { session, hasAccess } = await canView('Wallets')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem giao dịch ví' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const source = searchParams.get('source')
        const status = searchParams.get('status')
        const format = searchParams.get('format')
        const query = searchParams.get('q')?.trim()
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const requestedPage = Number(searchParams.get('page') || 1)
        const requestedLimit = Number(searchParams.get('limit') || (format === 'csv' ? 500 : 20))
        const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(500, Math.max(1, Math.floor(requestedLimit)))
            : 20

        const where: any = {}
        if (type && type !== 'ALL') where.type = type
        if (source && source !== 'ALL') where.source = source
        if (status && status !== 'ALL') where.status = status
        if (query) {
            where.OR = [
                { description: { contains: query, mode: 'insensitive' } },
                { note: { contains: query, mode: 'insensitive' } },
                { externalTransactionId: { contains: query, mode: 'insensitive' } },
                { wallet: { walletCode: { contains: query, mode: 'insensitive' } } },
                { wallet: { user: { email: { contains: query, mode: 'insensitive' } } } },
                { wallet: { user: { name: { contains: query, mode: 'insensitive' } } } },
                { wallet: { user: { phone: { contains: query, mode: 'insensitive' } } } },
            ]
        }
        const createdAt: { gte?: Date; lte?: Date } = {}
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
            const startDate = new Date(`${from}T00:00:00.000+07:00`)
            if (!Number.isNaN(startDate.getTime())) createdAt.gte = startDate
        }
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
            const endDate = new Date(`${to}T23:59:59.999+07:00`)
            if (!Number.isNaN(endDate.getTime())) createdAt.lte = endDate
        }
        if (Object.keys(createdAt).length > 0) where.createdAt = createdAt

        const [transactions, total] = await Promise.all([
            prisma.walletTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    wallet: {
                        include: {
                            user: { select: { name: true, email: true, phone: true } },
                        },
                    },
                    createdBy: { select: { name: true, email: true } },
                    bankTransaction: {
                        select: {
                            externalTransactionId: true,
                            transactionTime: true,
                            rawPayload: true,
                        },
                    },
                },
            }),
            prisma.walletTransaction.count({ where }),
        ])

        if (format === 'csv') {
            const rows = [
                [
                    'STT',
                    'Thời gian ghi sổ',
                    'Mã ví',
                    'Trạng thái ví',
                    'Tên chủ ví',
                    'Email chủ ví',
                    'Số điện thoại chủ ví',
                    'Loại giao dịch',
                    'Nguồn giao dịch',
                    'Trạng thái giao dịch',
                    'Chiều biến động',
                    'Số tiền (VNĐ)',
                    'Số dư trước (VNĐ)',
                    'Số dư sau (VNĐ)',
                    'Mã giao dịch ngoài của ví',
                    'Loại tham chiếu',
                    'Mã tham chiếu',
                    'Diễn giải',
                    'Ghi chú',
                    'Người tạo giao dịch',
                    'Email người tạo',
                    'Thời gian giao dịch ngân hàng',
                    'Mã giao dịch ngân hàng',
                    'Số giao dịch ngân hàng',
                    'ID giao dịch ví',
                    'ID ví',
                ],
                ...transactions.map((tx, index) => [
                    index + 1,
                    formatCsvDateTime(tx.createdAt),
                    tx.wallet.walletCode,
                    walletStatusLabels[tx.wallet.status] || tx.wallet.status,
                    tx.wallet.user.name || '',
                    tx.wallet.user.email,
                    tx.wallet.user.phone || '',
                    transactionTypeLabels[tx.type] || tx.type,
                    transactionSourceLabels[tx.source] || tx.source,
                    transactionStatusLabels[tx.status] || tx.status,
                    tx.amount > 0 ? 'Tiền vào' : 'Tiền ra',
                    tx.amount,
                    tx.balanceBefore,
                    tx.balanceAfter,
                    tx.externalTransactionId || '',
                    tx.referenceType || '',
                    tx.referenceId || '',
                    tx.description || '',
                    tx.note || '',
                    tx.createdBy?.name || '',
                    tx.createdBy?.email || '',
                    formatCsvDateTime(tx.bankTransaction?.transactionTime || null),
                    tx.bankTransaction?.externalTransactionId || '',
                    getBankReferenceNumber(tx.bankTransaction?.rawPayload),
                    tx.id,
                    tx.walletId,
                ]),
            ]
            const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`
            const exportDate = new Date().toISOString().slice(0, 10)
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="so-giao-dich-vi-${exportDate}.csv"`,
                },
            })
        }

        return NextResponse.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        })
    } catch (error) {
        console.error('[AdminWalletTransactions] Error:', error)
        return NextResponse.json({ error: 'Không thể tải giao dịch ví' }, { status: 500 })
    }
}
