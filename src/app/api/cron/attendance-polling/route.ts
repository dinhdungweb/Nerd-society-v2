import { NextResponse } from 'next/server';
import { pollAttendanceRecords } from '@/lib/subscription/attendance-polling';

/**
 * API Route để Cron Job gọi định kỳ (ví dụ mỗi 30s)
 * GET /api/cron/attendance-polling
 */
export async function GET(request: Request) {
    // Bảo mật: Chỉ cho phép gọi từ localhost hoặc có Secret Key trong header
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting attendance polling...');
        await pollAttendanceRecords();
        
        return NextResponse.json({ 
            success: true, 
            timestamp: new Date().toISOString() 
        });
    } catch (error: any) {
        console.error('[Cron] Attendance polling failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
