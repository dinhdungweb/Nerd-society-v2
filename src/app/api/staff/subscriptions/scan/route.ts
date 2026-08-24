import { getRolePermissions } from '@/lib/apiPermissions'
import { getStaffSession } from '@/lib/authHelpers'
import { sendZaloNotification, type ZaloTemplateType } from '@/lib/external/zalo-oa'
import { prisma } from '@/lib/prisma'
import { processMembershipQrScan } from '@/lib/subscription/membership-scan'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const scanSchema = z.object({
  requestId: z.string().uuid(),
  payload: z.string().trim().min(10).max(500),
  locationId: z.string().min(1),
})

async function notifyScanResult(result: Awaited<ReturnType<typeof processMembershipQrScan>>) {
  if (!result.subscriberId) return
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: result.subscriberId },
    select: { phone: true },
  })
  if (!subscriber?.phone) return

  const usesWallet = !result.planType
  let type: ZaloTemplateType | null = null
  if (result.code === 'CHECK_IN_SUCCESS') type = usesWallet ? 'CHECK_IN_WALLET' : 'CHECK_IN_SUB'
  if (result.code === 'CHECK_OUT_SUCCESS') type = usesWallet ? 'CHECK_OUT_WALLET' : 'CHECK_OUT_SUB'
  if (result.code.startsWith('BLOCK_')) type = 'BLOCK_CHECKIN'
  if (!type) return

  await sendZaloNotification(subscriber.phone, type, {
    CustomerName: result.subscriberName || 'Khách hàng',
    Branch: result.branch || result.locationCode,
    RemainingTime: result.remainingMin === undefined ? '' : String(result.remainingMin),
    Duration: result.durationMin === undefined ? '' : String(result.durationMin),
    AmountCharged: String(result.amountCharged || 0),
    Message: result.message,
  })
}

async function authorize() {
  const session = await getStaffSession()
  if (!session) return null
  const role = session.user.role as string
  const permissions = await getRolePermissions(role)
  if (role !== 'ADMIN' && (!permissions.canCheckIn || !permissions.canCheckOut)) return null
  return { session, role }
}

async function allowedLocation(userId: string, role: string, locationId: string) {
  const [user, location] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { assignedLocationId: true } }),
    prisma.location.findUnique({ where: { id: locationId } }),
  ])
  if (!location?.isActive || !location.code) return null
  if (role === 'STAFF' && user?.assignedLocationId !== location.id) return null
  return location
}

export async function GET() {
  const auth = await authorize()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = auth.session.user.id as string
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { assignedLocationId: true } })
  const locations = await prisma.location.findMany({
    where: {
      isActive: true,
      ...(auth.role === 'STAFF' ? { id: user?.assignedLocationId || '__unassigned__' } : {}),
    },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ locations, assignedLocationId: user?.assignedLocationId || null })
}

export async function POST(request: Request) {
  if ((process.env.CHECKIN_PROVIDER || 'qr').toLowerCase() !== 'qr') {
    return NextResponse.json({ error: 'QR check-in is not active' }, { status: 503 })
  }

  const auth = await authorize()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = scanSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scan request', issues: parsed.error.issues }, { status: 400 })
  }

  const userId = auth.session.user.id as string
  const location = await allowedLocation(userId, auth.role, parsed.data.locationId)
  if (!location) return NextResponse.json({ error: 'Location is not allowed' }, { status: 403 })

  try {
    const result = await processMembershipQrScan({
      ...parsed.data,
      locationCode: location.code,
      performedById: userId,
      performedByName: auth.session.user.name || auth.session.user.email || userId,
    })
    // Notification runs after the database transaction. Its failure must not
    // roll back or change the result of an accepted check-in/out.
    void notifyScanResult(result).catch((error) => console.error('[Membership QR Zalo]', error))
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Membership QR Scan]', error)
    return NextResponse.json({ error: 'Không thể xử lý lần quét. Vui lòng thử lại.' }, { status: 500 })
  }
}
