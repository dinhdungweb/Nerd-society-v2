import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * API tạm thời để cập nhật dữ liệu gói tháng cũ trên Server
 * Truy cập: /api/admin/migration?secret=YOUR_CRON_SECRET
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Bảo mật cơ bản bằng CRON_SECRET
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Starting production migration for Monthly Subscribers...');

    const result = await prisma.subscription.updateMany({
      where: {
        planType: {
          in: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED']
        }
      },
      data: {
        totalHoursMin: null,
        dailyLimitMin: 480,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${result.count} monthly subscriptions to 8h/day cap.`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Migration API Error]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
