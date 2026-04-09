/**
 * API Route: Admin Subscription Orders
 * GET  /api/admin/subscriptions/orders — danh sách đơn
 * POST /api/admin/subscriptions/orders — xử lý actions (confirm, assign, cancel)
 */

import { NextResponse } from 'next/server';
import { getRegistrationOrders, confirmPayment, assignCardAndCreate, cancelOrder } from '@/actions/subscription-actions';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const branch = url.searchParams.get('branch') || undefined;

    const orders = await getRegistrationOrders({ id, status, branch });
    return NextResponse.json(orders);
  } catch (err) {
    console.error('[Admin Orders GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    switch (body.action) {
      case 'confirm_payment': {
        const result = await confirmPayment(body.orderId, body.paymentRef);
        return NextResponse.json(result);
      }
      case 'assign_card': {
        const result = await assignCardAndCreate(body.orderId, body.cardNo, body.staffName || 'admin');
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
