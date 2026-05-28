/**
 * API Route: Staff Dashboard data
 * GET /api/staff/dashboard — lấy dữ liệu live
 * POST /api/staff/dashboard — manual check-in/verify
 */

import { prisma } from '@/lib/prisma';
import { localStartOfDay, splitMinutesByLocalDay } from '@/lib/subscription/date-utils';
import {
  calculateDailyCapSessionUsage,
  calculateOverageCharge,
  getSubscriptionDailyCapMin,
} from '@/lib/subscription/usage-billing';
import { getWarnings, manualCheckIn, verifySession } from '@/lib/subscription-logic';
import { $Enums } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branch = url.searchParams.get('branch') || 'HTM';

    // 1. Active sessions (đang ngồi)
    const activeSessions = await prisma.subscriptionSession.findMany({
      where: { checkOutTime: null, status: 'ACTIVE' },
      orderBy: { checkInTime: 'desc' },
      include: {
        subscriber: true,
        subscription: true,
      },
    });

    // 2. Recent events (10 sự kiện gần nhất)
    const recentEvents = await prisma.subscriptionAuditLog.findMany({
      where: {
        action: { in: ['check_in', 'check_out', 'first_checkin_activation', 'share_rejected'] },
        createdAt: { gte: new Date(Date.now() - 8 * 60 * 60 * 1000) }, // 8h gần nhất
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 3. Warnings
    const warnings = await getWarnings();

    // 4. Stats
    const activeCount = activeSessions.length;
    const todayCheckIns = await prisma.subscriptionSession.count({
      where: {
        checkInTime: { gte: localStartOfDay() },
      },
    });

    return NextResponse.json({
      activeSessions: activeSessions.map(s => ({
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
          return NextResponse.json({ error: 'Thiếu SĐT hoặc branch' }, { status: 400 });
        }
        const result = await manualCheckIn(phone, branch, staffName || 'staff');
        return NextResponse.json(result);
      }

      case 'verify': {
        const { sessionId, verified, staffName } = body;
        if (!sessionId) {
          return NextResponse.json({ error: 'Thiếu sessionId' }, { status: 400 });
        }
        const result = await verifySession(sessionId, verified, staffName || 'staff');
        return NextResponse.json(result);
      }

      case 'manual_checkout': {
        const { sessionId } = body;
        const session = await prisma.subscriptionSession.findUnique({
          where: { id: sessionId },
          include: {
            subscriber: {
              include: {
                user: {
                  select: {
                    wallet: { select: { balance: true } },
                  },
                },
              },
            },
            subscription: true,
          },
        });
        if (!session || session.checkOutTime) {
          return NextResponse.json({ error: 'Session không hợp lệ' }, { status: 400 });
        }

        const checkOutTime = new Date();
        const durationRaw = (checkOutTime.getTime() - session.checkInTime.getTime()) / (1000 * 60);
        const durationMin = Math.ceil(Math.max(1, durationRaw) / 15) * 15;
        let overageMin = 0;
        let amountCharged = 0;

        if (session.subscriptionId) {
          const dailyCapMin = getSubscriptionDailyCapMin(session.subscription);
          if (dailyCapMin) {
            const segments = splitMinutesByLocalDay(session.checkInTime, checkOutTime, durationMin);

            for (const segment of segments) {
              const usageBefore = await prisma.dailyUsage.findUnique({
                where: { subscriberId_usageDate: { subscriberId: session.subscriberId, usageDate: segment.usageDate } },
              });
              const billing = calculateDailyCapSessionUsage({
                durationMin: segment.minutes,
                usedMinBefore: usageBefore?.totalMin || 0,
                dailyCapMin,
              });

              overageMin += billing.overageMin;

              if (billing.includedMin > 0) {
                await prisma.dailyUsage.upsert({
                  where: { subscriberId_usageDate: { subscriberId: session.subscriberId, usageDate: segment.usageDate } },
                  create: {
                    subscriberId: session.subscriberId,
                    subscriptionId: session.subscriptionId,
                    usageDate: segment.usageDate,
                    totalMin: billing.includedMin,
                  },
                  update: { totalMin: { increment: billing.includedMin } },
                });
              }
            }

            amountCharged = calculateOverageCharge(overageMin).overageCharge;
          }

          await prisma.subscription.update({
            where: { id: session.subscriptionId },
            data: { usedHoursMin: { increment: durationMin } },
          });

          if (amountCharged > 0) {
            await prisma.subscriber.update({
              where: { id: session.subscriberId },
              data: { outstandingBalance: { increment: amountCharged } },
            });

            await prisma.transaction.create({
              data: {
                subscriberId: session.subscriberId,
                type: 'OVERAGE_CHARGE' as $Enums.TransactionType,
                amount: -amountCharged,
                balanceBefore: session.subscriber.user?.wallet?.balance || 0,
                balanceAfter: session.subscriber.user?.wallet?.balance || 0,
                reference: session.id,
                description: `Phi qua gio (${overageMin}m)`,
              },
            });
          }
        }

        await prisma.subscriptionSession.update({
          where: { id: sessionId },
          data: { checkOutTime, durationMin, overageMin, amountCharged, source: 'manual', status: 'COMPLETED' },
        });

        return NextResponse.json({ success: true, durationMin, overageMin, amountCharged });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Staff Dashboard POST] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
