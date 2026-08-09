import { isMonthlyBeaverRegistrationOpen } from '@/lib/monthly-beaver-registration'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const registrationOpen = await isMonthlyBeaverRegistrationOpen()

  return NextResponse.json(
    { registrationOpen },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
