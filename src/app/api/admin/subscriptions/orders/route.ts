/**
 * API Route: Admin Subscription Orders
 * GET  /api/admin/subscriptions/orders — danh sách đơn
 * POST /api/admin/subscriptions/orders — xử lý actions (confirm, assign, cancel)
 */

import { NextResponse } from 'next/server';
import { getRegistrationOrders, confirmPayment, issueQrAndCreate, cancelOrder } from '@/actions/subscription-actions';
import { getStaffSession } from '@/lib/authHelpers';
import { getRolePermissions } from '@/lib/apiPermissions';
import { prisma } from '@/lib/prisma';

async function authorize(permission: 'canViewCustomers' | 'canManageCustomers') {
  const session = await getStaffSession();
  if (!session) return null;
  const role = session.user.role as string;
  if (role === 'ADMIN') return session;
  const permissions = await getRolePermissions(role);
  return permissions[permission] ? session : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || undefined;

    // Customers use this unguessable order id to poll payment status. Return
    // status only; never expose the full admin order payload publicly.
    if (id) {
      const order = await prisma.registrationOrder.findUnique({
        where: { id },
        select: { orderStatus: true },
      });
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      return NextResponse.json(order);
    }

    const session = await authorize('canViewCustomers');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = url.searchParams.get('status') || undefined;
    const branch = url.searchParams.get('branch') || undefined;
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const page = pageParam ? Number.parseInt(pageParam, 10) : undefined;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const orders = await getRegistrationOrders({ status, branch, page, limit });
    return NextResponse.json(orders);
  } catch (err) {
    console.error('[Admin Orders GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize('canManageCustomers');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    switch (body.action) {
      case 'confirm_payment': {
        const result = await confirmPayment(body.orderId, body.paymentRef);
        return NextResponse.json(result);
      }
      case 'issue_qr': {
        const result = await issueQrAndCreate(body.orderId, session.user.name || body.staffName || 'admin');
        return NextResponse.json(result);
      }
      case 'cancel': {
        const result = await cancelOrder(body.orderId, body.reason);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Admin Orders POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
