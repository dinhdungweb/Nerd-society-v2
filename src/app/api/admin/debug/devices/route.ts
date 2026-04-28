import { getDeviceList } from '@/lib/mytime-api';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const devices = await getDeviceList();
    return NextResponse.json(devices);
  } catch (error: any) {
    return NextResponse.json({ result: 'error', reason: error.message }, { status: 500 });
  }
}
