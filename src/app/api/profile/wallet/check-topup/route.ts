import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

/**
 * Poll giao dịch nạp Ví Nerd mới nhất.
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const walletAccount = await ensureUserWalletAccount(session.user.id)
        if (!walletAccount.success) {
            return NextResponse.json({ error: walletAccount.message }, { status: 400 })
        }

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
        const latestTopup = await prisma.walletTransaction.findFirst({
            where: {
                walletId: walletAccount.wallet.id,
                type: 'TOPUP',
                createdAt: { gte: tenMinutesAgo },
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({
            success: true,
            hasNewTopup: !!latestTopup,
            latestTopup,
            currentBalance: walletAccount.wallet.balance,
        })
    } catch (error: any) {
        console.error('[API WalletCheckTopup] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
