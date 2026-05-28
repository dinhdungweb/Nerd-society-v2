import { autoCheckOutStaleSessions } from '@/lib/subscription-logic'
import { pollAttendanceRecords } from '@/lib/subscription/attendance-polling'
import { NextResponse } from 'next/server'

/**
 * API Route để Cron Job gọi định kỳ (ví dụ mỗi 30s)
 * GET /api/cron/attendance-polling
 */
export async function GET(request: Request) {
  // Bảo mật: Chỉ cho phép gọi từ localhost hoặc có Secret Key trong header
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron] Starting attendance polling...')
    await pollAttendanceRecords()
    const autoCheckouts = await autoCheckOutStaleSessions()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      autoCheckouts: autoCheckouts.length,
    })
  } catch (error: any) {
    console.error('[Cron] Attendance polling failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
