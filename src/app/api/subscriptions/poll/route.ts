/**
 * API Route: Polling MyTime attendance data
 * Chạy mỗi 30 giây (trigger từ n8n hoặc cron)
 * GET /api/subscriptions/poll
 */

import { NextResponse } from 'next/server';
import { getAttendanceList } from '@/lib/mytime-api';
import { processAttendanceRecord, autoCheckOutStaleSessions } from '@/lib/subscription-logic';
import { prisma } from '@/lib/prisma';

// Store processed attendance times to avoid duplicates
// In production, use Redis or DB-backed cache
const processedKeys = new Set<string>();

export async function GET(request: Request) {
  try {
    // Auth check (simple token)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (token !== process.env.SUBSCRIPTION_POLL_TOKEN && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch attendance from MyTime
    let records: Array<{
      AttTime: string;
      EmployeeID: string;
      FullName: string;
      MachineAlias: string;
      sn: string;
    }> = [];

    try {
      const response = await getAttendanceList(today, today);
      if (response.result === 'success' && Array.isArray(response.data)) {
        records = response.data;
      }
    } catch (err) {
      console.error('[Poll] MyTime API unreachable:', err);
      // Non-fatal: MyTime/PC có thể đang tắt, sẽ poll lại lần sau
      return NextResponse.json({
        status: 'mytime_offline',
        message: 'Không kết nối được MyTime',
        autoCheckouts: [],
      });
    }

    // 2. Process new records only
    const events = [];
    for (const record of records) {
      const key = `${record.EmployeeID}-${record.AttTime}`;
      if (processedKeys.has(key)) continue;

      // Also check DB to avoid processing on restart
      const existing = await prisma.subscriptionAuditLog.findFirst({
        where: {
          action: { in: ['check_in', 'check_out', 'first_checkin_activation'] },
          details: {
            path: ['attTime'],
            equals: record.AttTime,
          },
        },
      });
      if (existing) {
        processedKeys.add(key);
        continue;
      }

      try {
        const result = await processAttendanceRecord(record);
        events.push(result);
        processedKeys.add(key);
      } catch (err) {
        console.error('[Poll] Error processing record:', record, err);
        events.push({ type: 'ERROR', record, error: String(err) });
      }
    }

    // 3. Auto-checkout stale sessions
    const autoCheckouts = await autoCheckOutStaleSessions();

    // 4. Cleanup old keys (keep last 24h only)
    if (processedKeys.size > 10000) {
      processedKeys.clear();
    }

    return NextResponse.json({
      status: 'ok',
      processed: events.length,
      events,
      autoCheckouts: autoCheckouts.length,
      totalRecords: records.length,
    });
  } catch (err) {
    console.error('[Poll] Fatal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
