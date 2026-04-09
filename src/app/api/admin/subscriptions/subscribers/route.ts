/**
 * API Route: Admin Subscribers List
 */

import { NextResponse } from 'next/server';
import { getSubscribers } from '@/actions/subscription-actions';

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
