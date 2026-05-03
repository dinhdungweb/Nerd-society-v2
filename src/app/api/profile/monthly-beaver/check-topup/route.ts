import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        // Tìm subscriber liên kết với user
        const subscriber = await prisma.subscriber.findUnique({
            where: { userId: session.user.id },
            select: { id: true, walletBalance: true }
        });

        if (!subscriber) {
            return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
        }

        // Tìm giao dịch nạp tiền (TOPUP) mới nhất trong vòng 10 phút qua
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        const latestTopup = await prisma.transaction.findFirst({
            where: {
                subscriberId: subscriber.id,
                type: 'TOPUP',
                createdAt: { gte: tenMinutesAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            success: true,
            hasNewTopup: !!latestTopup,
            latestTopup,
            currentBalance: subscriber.walletBalance
        });

    } catch (error: any) {
        console.error('[API CheckTopup] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
