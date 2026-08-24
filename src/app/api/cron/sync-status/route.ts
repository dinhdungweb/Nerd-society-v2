import { NextResponse } from 'next/server';
import { runSubscriptionMaintenance } from '@/lib/subscription/maintenance';

/**
 * API Route để Cron Job (hàng ngày) gọi đồng bộ trạng thái hội viên
 * GET /api/cron/sync-status
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting All Subscribers Status Sync...');
        const results = await runSubscriptionMaintenance();
        
        return NextResponse.json({ 
            success: true, 
            results,
            timestamp: new Date().toISOString() 
        });
    } catch (error: any) {
        console.error('[Cron] Sync status failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
