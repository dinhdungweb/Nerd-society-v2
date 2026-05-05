import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureUserWalletAccount } from '@/lib/wallet-account';

/**
 * API kiểm tra xem có giao dịch nạp tiền mới nhất không
 * Dùng cho Polling ở Frontend (TopupModal)
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const walletAccount = await ensureUserWalletAccount(session.user.id);
        if (!walletAccount.success) {
            return NextResponse.json({ error: walletAccount.message }, { status: 400 });
        }

        // Tìm giao dịch nạp tiền (TOPUP) mới nhất trong vòng 10 phút qua
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        const latestTopup = await prisma.walletTransaction.findFirst({
            where: {
                walletId: walletAccount.wallet.id,
                type: 'TOPUP',
                createdAt: { gte: tenMinutesAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            success: true,
            hasNewTopup: !!latestTopup,
            latestTopup,
            currentBalance: walletAccount.wallet.balance
        });

    } catch (error: any) {
        console.error('[API CheckTopup] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
