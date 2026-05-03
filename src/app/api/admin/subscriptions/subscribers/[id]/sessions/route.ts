import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/subscriptions/subscribers/[id]/sessions
 * Lấy lịch sử check-in/check-out của 1 hội viên
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = { subscriberId: id };

    if (from || to) {
      where.checkInTime = {};
      if (from) where.checkInTime.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1); // Include the entire "to" day
        where.checkInTime.lte = toDate;
      }
    }

    const sessions = await prisma.subscriptionSession.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      take: 500,
      include: {
        subscriber: {
          select: { fullName: true, cardNo: true, phone: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('[API] Subscriber sessions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
