import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const walletAccount = await ensureUserWalletAccount(session.user.id)
    if (!walletAccount.success) {
        return NextResponse.json({
            success: false,
            reason: walletAccount.reason,
            error: walletAccount.message,
        }, { status: 400 })
    }

    return NextResponse.json({
        success: true,
        walletId: walletAccount.wallet.id,
        walletCode: walletAccount.wallet.walletCode,
        balance: walletAccount.wallet.balance,
        status: walletAccount.wallet.status,
        outstandingBalance: walletAccount.subscriber?.outstandingBalance || 0,
        recentTransactions: await prisma.walletTransaction.findMany({
            where: { walletId: walletAccount.wallet.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
    })
}
