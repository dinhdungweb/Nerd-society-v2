import { NextResponse } from 'next/server';
import { getSubscribers, deleteSubscriber } from '@/actions/subscription-actions';
import { getStaffSession } from '@/lib/authHelpers';
import { getRolePermissions } from '@/lib/apiPermissions';

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
    const session = await authorize('canViewCustomers');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(url.searchParams.get('limit') || '20', 10);

    const subscribers = await getSubscribers({ search, status, page, limit });
    return NextResponse.json(subscribers);
  } catch (err) {
    console.error('[Admin Subscribers GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await authorize('canManageCustomers');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

