import { canView } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { session, hasAccess } = await canView('Wallets')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền xem ví' }, { status: 403 })
        }

        const { id } = await params
        const wallet = await prisma.wallet.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        createdAt: true,
                        subscriber: {
                            include: {
                                subscriptions: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 5,
                                },
                            },
                        },
                    },
                },
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                    },
                },
                bankTransactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        })

        if (!wallet) {
            return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 })
        }

        return NextResponse.json({ wallet })
    } catch (error) {
        console.error('[AdminWalletDetail] Error:', error)
        return NextResponse.json({ error: 'Không thể tải chi tiết ví' }, { status: 500 })
    }
}
