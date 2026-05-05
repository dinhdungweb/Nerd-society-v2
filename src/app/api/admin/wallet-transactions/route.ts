import { canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
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
            return NextResponse.json({ error: 'Không có quyền xem giao dịch ví' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const source = searchParams.get('source')
        const format = searchParams.get('format')
        const query = searchParams.get('q')?.trim()
        const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

        const where: any = {}
        if (type && type !== 'ALL') where.type = type
        if (source && source !== 'ALL') where.source = source
        if (query) {
            where.OR = [
                { description: { contains: query, mode: 'insensitive' } },
                { note: { contains: query, mode: 'insensitive' } },
                { externalTransactionId: { contains: query, mode: 'insensitive' } },
                { wallet: { walletCode: { contains: query, mode: 'insensitive' } } },
                { wallet: { user: { email: { contains: query, mode: 'insensitive' } } } },
                { wallet: { user: { name: { contains: query, mode: 'insensitive' } } } },
            ]
        }

        const transactions = await prisma.walletTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                wallet: {
                    include: {
                        user: { select: { name: true, email: true, phone: true } },
                    },
                },
                createdBy: { select: { name: true, email: true } },
            },
        })

        if (format === 'csv') {
            const rows = [
                ['createdAt', 'walletCode', 'user', 'email', 'type', 'source', 'amount', 'balanceBefore', 'balanceAfter', 'externalTransactionId', 'description', 'note'],
                ...transactions.map((tx) => [
                    tx.createdAt.toISOString(),
                    tx.wallet.walletCode,
                    tx.wallet.user.name || '',
                    tx.wallet.user.email,
                    tx.type,
                    tx.source,
                    tx.amount,
                    tx.balanceBefore,
                    tx.balanceAfter,
                    tx.externalTransactionId || '',
                    tx.description || '',
                    tx.note || '',
                ]),
            ]
            const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="wallet-transactions.csv"',
                },
            })
        }

        return NextResponse.json({ transactions })
    } catch (error) {
        console.error('[AdminWalletTransactions] Error:', error)
        return NextResponse.json({ error: 'Không thể tải giao dịch ví' }, { status: 500 })
    }
}
