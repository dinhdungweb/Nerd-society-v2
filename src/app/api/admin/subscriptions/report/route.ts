/**
 * API Route: Admin Subscription Report
 */

import { NextResponse } from 'next/server';
import { getMonthlyReport } from '@/actions/subscription-actions';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1));

    const report = await getMonthlyReport(year, month);
    return NextResponse.json(report);
  } catch (err) {
    console.error('[Admin Report GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
