/**
 * API Route: Admin Active Sessions List
 * GET /api/admin/subscriptions/sessions?status=ACTIVE
 */

import { NextResponse } from 'next/server';
import { getActiveSessions } from '@/actions/subscription-actions';
import { canBooking } from '@/lib/apiPermissions';
import { checkoutSubscriptionSession } from '@/lib/subscription/session-manager';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = url.searchParams.get('branch') || undefined;

    // Lấy danh sách session đang hoạt động từ database
    const sessions = await getActiveSessions(branch);
    
    return NextResponse.json(sessions);
  } catch (err) {
    console.error('[Admin Sessions GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, hasAccess } = await canBooking('CheckOut');
    if (!session || !hasAccess) {
      return NextResponse.json({ error: 'Khong co quyen check-out' }, { status: 403 });
    }

    const body = await request.json();

    if (body.action !== 'manual_checkout') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!body.sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const performedBy = session.user?.name || session.user?.email || 'admin';
    const result = await checkoutSubscriptionSession(body.sessionId, {
      source: 'manual_admin',
      performedBy,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Admin Sessions POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
