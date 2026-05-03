/**
 * API Route: Admin Active Sessions List
 * GET /api/admin/subscriptions/sessions?status=ACTIVE
 */

import { NextResponse } from 'next/server';
import { getActiveSessions } from '@/actions/subscription-actions';

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
