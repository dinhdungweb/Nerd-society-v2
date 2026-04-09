import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { topUpWallet } from '@/lib/subscription/wallet-actions';
import { verifyVietQRWebhook } from '@/lib/vietqr';

/**
 * Webhook nhận thông báo biến động số dư từ VietQR/Casso/Napas
 * POST /api/webhooks/vietqr
 */
export async function POST(request: Request) {
    const body = await request.json();
    const signature = request.headers.get('x-signature');

    // 1. Xác thực Webhook (Nếu có secret)
    if (!verifyVietQRWebhook(body, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    try {
        console.log('[Webhook] Received VietQR signal:', body);

        // Giả sử payload từ VietQR.vn hoặc Casso có trường 'content' (nội dung ck) và 'amount'
        // Format mong đợi: "TU NS001" (Top Up NS001)
        const content = (body.content || body.description || '').toUpperCase();
        const amount = Number(body.amount);

        if (!content.includes('TU') || isNaN(amount) || amount <= 0) {
            return NextResponse.json({ message: 'Ignore: Not a top-up transaction or invalid amount' });
        }

        // Tìm Mã hội viên trong nội dung (ví dụ: NS001)
        const match = content.match(/TU\s+(NS\d+)/);
        if (!match) {
            return NextResponse.json({ message: 'Ignore: No Subscriber ID found in content' });
        }

        const empId = match[1];
        const subscriber = await prisma.subscriber.findUnique({
            where: { mytimeEmpId: empId }
        });

        if (!subscriber) {
            console.error(`[Webhook] Subscriber ${empId} not found for top-up`);
            return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
        }

        // 2. Thực hiện nạp tiền tự động
        const result = await topUpWallet(
            subscriber.id, 
            amount, 
            body.transactionid || body.id, 
            `Nạp tiền tự động qua VietQR: ${content}`
        );

        if (result.success) {
            console.log(`[Webhook] Successfully topped up ${amount} for ${empId}`);
            return NextResponse.json({ success: true, newBalance: result.newBalance });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[Webhook] Error processing VietQR webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
