import { NextResponse } from 'next/server';
import { getSubscribers, deleteSubscriber, reassignSubscriberCard } from '@/actions/subscription-actions';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const subscribers = await getSubscribers({ search, status });
    return NextResponse.json(subscribers);
  } catch (err) {
    console.error('[Admin Subscribers GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { subscriberId, newCardNo } = await request.json();
    if (!subscriberId || !newCardNo) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (subscriberId, newCardNo)' }, { status: 400 });
    }

    const result = await reassignSubscriberCard(subscriberId, newCardNo, 'admin');
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Admin Subscribers PUT]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID hội viên' }, { status: 400 });
    }

    const result = await deleteSubscriber(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Admin Subscribers DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

