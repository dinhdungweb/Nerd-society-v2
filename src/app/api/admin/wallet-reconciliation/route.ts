import { canManage, canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { applyWalletTransaction } from '@/lib/wallet-ledger'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const bankTransactionStatusLabels: Record<string, string> = {
    PENDING: 'Chờ đối soát',
    MATCHED: 'Đã đối soát',
    DUPLICATE: 'Trùng giao dịch',
    IGNORED: 'Đã bỏ qua',
    ERROR: 'Lỗi đối soát',
}

const walletTransactionTypeLabels: Record<string, string> = {
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

const walletTransactionSourceLabels: Record<string, string> = {
    SYSTEM: 'Hệ thống',
    VIETQR: 'VietQR',
    MANUAL_ADMIN: 'Quản trị viên',
    BOOKING: 'Đặt lịch',
    SUBSCRIPTION: 'Gói thành viên',
    MONTHLY_BEAVER: 'Monthly Beaver',
}

const walletTransactionStatusLabels: Record<string, string> = {
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

function getTransactionDirectionLabel(value: string | null) {
    if (value === 'C') return 'Tiền vào'
    if (value === 'D') return 'Tiền ra'
    return value || 'Không xác định'
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
            return NextResponse.json({ error: 'Không có quyền xem đối soát ví' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const query = searchParams.get('q')?.trim()
        const format = searchParams.get('format')
        const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

        const where: any = {}
        if (status && status !== 'ALL') where.status = status
        if (query) {
            where.OR = [
                { externalTransactionId: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
                { note: { contains: query, mode: 'insensitive' } },
                { matchedWallet: { walletCode: { contains: query, mode: 'insensitive' } } },
            ]
        }

        const bankTransactions = await prisma.bankTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                matchedWallet: {
                    include: {
                        user: { select: { name: true, email: true, phone: true } },
                    },
                },
                matchedTransaction: true,
            },
        })

        if (format === 'csv') {
            const rows = [
                [
                    'STT',
                    'Thời gian giao dịch ngân hàng',
                    'Thời gian hệ thống ghi nhận',
                    'Thời gian cập nhật đối soát',
                    'Mã giao dịch ngân hàng',
                    'Số giao dịch ngân hàng',
                    'Tài khoản ngân hàng',
                    'Chiều giao dịch',
                    'Số tiền (VNĐ)',
                    'Nội dung chuyển khoản',
                    'Trạng thái đối soát',
                    'Ghi chú đối soát',
                    'Mã ví',
                    'Tên chủ ví',
                    'Email chủ ví',
                    'Số điện thoại chủ ví',
                    'ID giao dịch ví',
                    'Loại giao dịch ví',
                    'Nguồn giao dịch ví',
                    'Trạng thái giao dịch ví',
                    'Biến động ví (VNĐ)',
                    'Số dư trước (VNĐ)',
                    'Số dư sau (VNĐ)',
                    'Mã giao dịch ngoài của ví',
                    'Loại tham chiếu',
                    'Mã tham chiếu',
                    'Diễn giải giao dịch ví',
                    'Ghi chú giao dịch ví',
                    'ID bản ghi đối soát',
                    'ID ví',
                ],
                ...bankTransactions.map((tx, index) => [
                    index + 1,
                    formatCsvDateTime(tx.transactionTime),
                    formatCsvDateTime(tx.createdAt),
                    formatCsvDateTime(tx.updatedAt),
                    tx.externalTransactionId,
                    getBankReferenceNumber(tx.rawPayload),
                    tx.bankAccount || '',
                    getTransactionDirectionLabel(tx.transType),
                    tx.amount,
                    tx.content || '',
                    bankTransactionStatusLabels[tx.status] || tx.status,
                    tx.note || '',
                    tx.matchedWallet?.walletCode || '',
                    tx.matchedWallet?.user.name || '',
                    tx.matchedWallet?.user.email || '',
                    tx.matchedWallet?.user.phone || '',
                    tx.matchedTransaction?.id || '',
                    tx.matchedTransaction
                        ? walletTransactionTypeLabels[tx.matchedTransaction.type] || tx.matchedTransaction.type
                        : '',
                    tx.matchedTransaction
                        ? walletTransactionSourceLabels[tx.matchedTransaction.source] || tx.matchedTransaction.source
                        : '',
                    tx.matchedTransaction
                        ? walletTransactionStatusLabels[tx.matchedTransaction.status] || tx.matchedTransaction.status
                        : '',
                    tx.matchedTransaction?.amount ?? '',
                    tx.matchedTransaction?.balanceBefore ?? '',
                    tx.matchedTransaction?.balanceAfter ?? '',
                    tx.matchedTransaction?.externalTransactionId || '',
                    tx.matchedTransaction?.referenceType || '',
                    tx.matchedTransaction?.referenceId || '',
                    tx.matchedTransaction?.description || '',
                    tx.matchedTransaction?.note || '',
                    tx.id,
                    tx.matchedWalletId || '',
                ]),
            ]
            const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`
            const exportDate = new Date().toISOString().slice(0, 10)
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="doi-soat-vi-${exportDate}.csv"`,
                },
            })
        }

        return NextResponse.json({ bankTransactions })
    } catch (error) {
        console.error('[WalletReconciliation] Error:', error)
        return NextResponse.json({ error: 'Không thể tải giao dịch đối soát' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { session, hasAccess } = await canManage('Wallets')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền đối soát ví' }, { status: 403 })
        }

        const body = await request.json()
        const action = String(body.action || '').toUpperCase()
        const bankTransactionId = String(body.bankTransactionId || '')
        const note = String(body.note || '').trim()

        const bankTransaction = await prisma.bankTransaction.findUnique({
            where: { id: bankTransactionId },
        })

        if (!bankTransaction) {
            return NextResponse.json({ error: 'Không tìm thấy giao dịch ngân hàng' }, { status: 404 })
        }

        if (action === 'IGNORE') {
            const updated = await prisma.bankTransaction.update({
                where: { id: bankTransaction.id },
                data: { status: 'IGNORED', note: note || 'Ignored by admin' },
            })
            return NextResponse.json({ success: true, bankTransaction: updated })
        }

        if (action !== 'MATCH') {
            return NextResponse.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
        }

        const walletId = String(body.walletId || '')
        if (!walletId) {
            return NextResponse.json({ error: 'Thiếu walletId' }, { status: 400 })
        }

        if (bankTransaction.status === 'MATCHED') {
            return NextResponse.json({ error: 'Giao dịch ngân hàng đã được đối soát' }, { status: 400 })
        }

        if (bankTransaction.transType && bankTransaction.transType !== 'C') {
            return NextResponse.json({ error: 'Chỉ có thể đối soát giao dịch tiền vào' }, { status: 400 })
        }

        if (bankTransaction.amount <= 0) {
            return NextResponse.json({ error: 'Số tiền giao dịch ngân hàng không hợp lệ' }, { status: 400 })
        }

        const walletTransaction = await applyWalletTransaction({
            walletId,
            type: 'TOPUP',
            amount: bankTransaction.amount,
            source: 'VIETQR',
            referenceType: 'bank_transaction',
            referenceId: bankTransaction.id,
            externalTransactionId: bankTransaction.externalTransactionId,
            description: 'Admin đối soát nạp ví từ giao dịch ngân hàng',
            note,
            createdById: session.user.id,
            rawPayload: bankTransaction.rawPayload,
        })

        const updated = await prisma.bankTransaction.update({
            where: { id: bankTransaction.id },
            data: {
                status: walletTransaction.alreadyProcessed ? 'DUPLICATE' : 'MATCHED',
                matchedWalletId: walletId,
                matchedTransactionId: walletTransaction.transaction.id,
                note: note || bankTransaction.note,
            },
        })

        return NextResponse.json({
            success: true,
            bankTransaction: updated,
            walletTransaction,
        })
    } catch (error: any) {
        console.error('[WalletReconciliationAction] Error:', error)
        return NextResponse.json({ error: error.message || 'Không thể đối soát giao dịch' }, { status: 500 })
    }
}
