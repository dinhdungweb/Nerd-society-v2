/**
 * API Route: Staff Dashboard data
 * GET /api/staff/dashboard
 * POST /api/staff/dashboard
 */

import { prisma } from '@/lib/prisma';
import { localStartOfDay } from '@/lib/subscription/date-utils';
import { checkoutSubscriptionSession } from '@/lib/subscription/session-manager';
import { getWarnings, manualCheckIn, verifySession } from '@/lib/subscription-logic';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = url.searchParams.get('branch') || 'HTM';

    const activeSessions = await prisma.subscriptionSession.findMany({
      where: { checkOutTime: null, status: 'ACTIVE' },
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

    const warnings = await getWarnings();
    const activeCount = activeSessions.length;
    const todayCheckIns = await prisma.subscriptionSession.count({
      where: {
        checkInTime: { gte: localStartOfDay() },
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
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'manual_checkin': {
        const { phone, branch, staffName } = body;
        if (!phone || !branch) {
          return NextResponse.json({ error: 'Thieu SDT hoac branch' }, { status: 400 });
        }

        const result = await manualCheckIn(phone, branch, staffName || 'staff');
        return NextResponse.json(result);
      }

      case 'verify': {
        const { sessionId, verified, staffName } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'Thieu sessionId' }, { status: 400 });
        }

        const result = await verifySession(sessionId, verified, staffName || 'staff');
        return NextResponse.json(result);
      }

      case 'manual_checkout': {
        const { sessionId, staffName } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'Thieu sessionId' }, { status: 400 });
        }

        const result = await checkoutSubscriptionSession(sessionId, {
          source: 'manual',
          performedBy: staffName || 'staff',
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
