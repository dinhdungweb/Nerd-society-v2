/**
 * API Route: Staff Dashboard data
 * GET /api/staff/dashboard
 * POST /api/staff/dashboard
 */

import { prisma } from '@/lib/prisma';
import { localStartOfDay } from '@/lib/subscription/date-utils';
import { checkInSubscriber, checkoutSubscriptionSession } from '@/lib/subscription/session-manager';
import { getWarnings, verifySession } from '@/lib/subscription/staff-session-tools';
import { getStaffSession } from '@/lib/authHelpers';
import { getRolePermissions } from '@/lib/apiPermissions';
import { NextResponse } from 'next/server';

async function authorizeDashboard() {
  const session = await getStaffSession();
  if (!session) return null;
  const role = session.user.role as string;
  const permissions = await getRolePermissions(role);
  if (role !== 'ADMIN' && (!permissions.canCheckIn || !permissions.canCheckOut)) return null;
  return { session, role };
}

async function resolveBranch(userId: string, role: string, requestedBranch: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { assignedLocationId: true },
  });
  const location = await prisma.location.findFirst({
    where: { code: requestedBranch, isActive: true },
    select: { id: true, code: true },
  });
  if (!location) return null;
  if (role === 'STAFF' && user?.assignedLocationId !== location.id) return null;
  return location.code;
}

async function canAccessSession(userId: string, role: string, sessionId: string) {
  const session = await prisma.subscriptionSession.findUnique({
    where: { id: sessionId },
    select: { branch: true },
  });
  if (!session) return false;
  return Boolean(await resolveBranch(userId, role, session.branch));
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeDashboard();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const requestedBranch = url.searchParams.get('branch') || 'HTM';
    const branch = await resolveBranch(auth.session.user.id, auth.role, requestedBranch);
    if (!branch) return NextResponse.json({ error: 'Location is not allowed' }, { status: 403 });

    const activeSessions = await prisma.subscriptionSession.findMany({
      where: { checkOutTime: null, status: 'ACTIVE', branch },
      orderBy: { checkInTime: 'desc' },
      include: {
        subscriber: true,
        subscription: true,
      },
    });

    const recentEvents = await prisma.subscriptionAuditLog.findMany({
      where: {
        action: { in: ['check_in', 'check_out', 'first_checkin_activation', 'share_rejected'] },
        createdAt: { gte: new Date(Date.now() - 8 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const warnings = await getWarnings(branch);
    const activeCount = activeSessions.length;
    const todayCheckIns = await prisma.subscriptionSession.count({
      where: {
        checkInTime: { gte: localStartOfDay() },
        branch,
      },
    });

    return NextResponse.json({
      activeSessions: activeSessions.map((s) => ({
        id: s.id,
        subscriberName: s.subscriber.fullName,
        subscriberPhoto: s.subscriber.photoUrl,
        planType: s.subscription?.planType || 'WALLET',
        branch: s.branch,
        checkInTime: s.checkInTime,
        durationSoFar: Math.round((Date.now() - s.checkInTime.getTime()) / (1000 * 60)),
        remainingMin: s.subscription?.totalHoursMin
          ? s.subscription.totalHoursMin + s.subscription.carriedHoursMin - s.subscription.usedHoursMin
          : null,
        dailyLimitMin: s.subscription?.dailyLimitMin || null,
        isUnlimited: !s.subscription?.totalHoursMin,
        staffVerified: s.staffVerified,
        needsVerification: s.subscription?.planType === 'MONTHLY_UNLIMITED' && !s.staffVerified,
      })),
      recentEvents,
      warnings,
      stats: {
        activeCount,
        todayCheckIns,
        branch,
      },
    });
  } catch (err) {
    console.error('[Staff Dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeDashboard();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'manual_checkin': {
        const { phone, branch, staffName } = body;
        if (!phone || !branch) {
          return NextResponse.json({ error: 'Thieu SDT hoac branch' }, { status: 400 });
        }

        const allowedBranch = await resolveBranch(auth.session.user.id, auth.role, branch);
        if (!allowedBranch) return NextResponse.json({ error: 'Location is not allowed' }, { status: 403 });
        const subscriber = await prisma.subscriber.findUnique({ where: { phone }, select: { id: true } });
        if (!subscriber) return NextResponse.json({ success: false, errorType: 'NOT_FOUND', message: 'Không tìm thấy hội viên.' }, { status: 404 });
        const result = await checkInSubscriber(subscriber.id, allowedBranch, {
          source: 'manual',
          performedBy: auth.session.user.name || staffName || 'staff',
        });
        return NextResponse.json(result);
      }

      case 'verify': {
        const { sessionId, verified, staffName } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'Thieu sessionId' }, { status: 400 });
        }
        if (!(await canAccessSession(auth.session.user.id, auth.role, sessionId))) {
          return NextResponse.json({ error: 'Session is not allowed' }, { status: 403 });
        }

        const result = await verifySession(sessionId, verified, auth.session.user.name || staffName || 'staff');
        return NextResponse.json(result);
      }

      case 'manual_checkout': {
        const { sessionId, staffName } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'Thieu sessionId' }, { status: 400 });
        }
        if (!(await canAccessSession(auth.session.user.id, auth.role, sessionId))) {
          return NextResponse.json({ error: 'Session is not allowed' }, { status: 403 });
        }

        const result = await checkoutSubscriptionSession(sessionId, {
          source: 'manual',
          performedBy: auth.session.user.name || staffName || 'staff',
        });

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Staff Dashboard POST] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
