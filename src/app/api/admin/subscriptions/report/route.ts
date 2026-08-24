/**
 * API Route: Admin Subscription Report
 */

import { NextResponse } from 'next/server';
import { getMonthlyReport } from '@/actions/subscription-actions';
import { getStaffSession } from '@/lib/authHelpers';
import { getRolePermissions } from '@/lib/apiPermissions';

export async function GET(request: Request) {
  try {
    const session = await getStaffSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session.user.role as string;
    const permissions = await getRolePermissions(role);
    if (role !== 'ADMIN' && !permissions.canViewReports) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
