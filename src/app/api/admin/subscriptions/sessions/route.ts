/**
 * API Route: Admin Active Sessions List
 * GET /api/admin/subscriptions/sessions?status=ACTIVE
 */

import { NextResponse } from 'next/server';
import { getActiveSessions } from '@/actions/subscription-actions';
import { canBooking } from '@/lib/apiPermissions';
import { checkoutSubscriptionSession } from '@/lib/subscription/session-manager';
import { prisma } from '@/lib/prisma';

async function staffBranch(userId: string, role: string | null) {
  if (role !== 'STAFF') return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { assignedLocation: { select: { code: true } } },
  });
  return user?.assignedLocation?.code || '__unassigned__';
}

export async function GET(request: Request) {
  try {
    const { session, hasAccess, role } = await canBooking('CheckOut');
    if (!session || !hasAccess) {
      return NextResponse.json({ error: 'Khong co quyen xem session' }, { status: 403 });
    }
    const url = new URL(request.url);
    const requestedBranch = url.searchParams.get('branch') || undefined;
    const assignedBranch = await staffBranch(session.user.id, role);
    if (role === 'STAFF' && requestedBranch && requestedBranch !== assignedBranch) {
      return NextResponse.json({ error: 'Location is not allowed' }, { status: 403 });
    }
    const branch = role === 'STAFF' ? (assignedBranch || '__unassigned__') : requestedBranch;

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
    const { session, hasAccess, role } = await canBooking('CheckOut');
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
    if (role === 'STAFF') {
      const [assignedBranch, targetSession] = await Promise.all([
        staffBranch(session.user.id, role),
        prisma.subscriptionSession.findUnique({ where: { id: body.sessionId }, select: { branch: true } }),
      ]);
      if (!targetSession || targetSession.branch !== assignedBranch) {
        return NextResponse.json({ error: 'Session is not allowed' }, { status: 403 });
      }
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
