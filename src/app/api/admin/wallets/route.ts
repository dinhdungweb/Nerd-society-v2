import { canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { session, hasAccess } = await canView('Wallets')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem ví' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')?.trim()
        const status = searchParams.get('status')?.trim()
        const limit = Math.min(Number(searchParams.get('limit') || 50), 100)

        const where: any = {}
        if (status && status !== 'ALL') where.status = status
        if (query) {
            where.OR = [
                { walletCode: { contains: query, mode: 'insensitive' } },
                { user: { name: { contains: query, mode: 'insensitive' } } },
                { user: { email: { contains: query, mode: 'insensitive' } } },
                { user: { phone: { contains: query } } },
            ]
        }

        const [wallets, aggregate, topupAggregate, debitAggregate, pendingBankCount, recentTransactions] = await Promise.all([
            prisma.wallet.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            subscriber: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    outstandingBalance: true,
                                    mytimeEmpId: true,
                                },
                            },
                        },
                    },
                    _count: { select: { transactions: true } },
                },
            }),
            prisma.wallet.aggregate({
                _sum: { balance: true },
                _count: true,
            }),
            prisma.walletTransaction.aggregate({
                where: { amount: { gt: 0 }, status: 'COMPLETED' },
                _sum: { amount: true },
            }),
            prisma.walletTransaction.aggregate({
                where: { amount: { lt: 0 }, status: 'COMPLETED' },
                _sum: { amount: true },
            }),
            prisma.bankTransaction.count({
                where: { status: { in: ['PENDING', 'ERROR'] } },
            }),
            prisma.walletTransaction.findMany({
                orderBy: { createdAt: 'desc' },
                take: 8,
                include: {
                    wallet: {
                        include: {
                            user: { select: { name: true, email: true } },
                        },
                    },
                },
            }),
        ])

        return NextResponse.json({
            wallets,
            stats: {
                walletCount: aggregate._count,
                totalBalance: aggregate._sum.balance || 0,
                totalTopup: topupAggregate._sum.amount || 0,
                totalDebit: Math.abs(debitAggregate._sum.amount || 0),
                pendingBankCount,
            },
            recentTransactions,
        })
    } catch (error) {
        console.error('[AdminWallets] Error:', error)
        return NextResponse.json({ error: 'Không thể tải danh sách ví' }, { status: 500 })
    }
}
