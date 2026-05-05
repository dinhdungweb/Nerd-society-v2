import { canManage, canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { applyWalletTransaction } from '@/lib/wallet-ledger'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function csvEscape(value: unknown) {
    const text = String(value ?? '')
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
                ['createdAt', 'externalTransactionId', 'amount', 'transType', 'content', 'status', 'walletCode', 'note'],
                ...bankTransactions.map((tx) => [
                    tx.createdAt.toISOString(),
                    tx.externalTransactionId,
                    tx.amount,
                    tx.transType || '',
                    tx.content || '',
                    tx.status,
                    tx.matchedWallet?.walletCode || '',
                    tx.note || '',
                ]),
            ]
            const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="wallet-reconciliation.csv"',
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
