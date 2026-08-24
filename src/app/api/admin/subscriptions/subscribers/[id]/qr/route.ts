import { getStaffSession } from '@/lib/authHelpers'
import { getRolePermissions } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { ensureMembershipQrCredential, rotateMembershipQrCredential } from '@/lib/subscription/qr-credential'
import { NextResponse } from 'next/server'

async function authorizeSubscriber(id: string) {
  const session = await getStaffSession()
  if (!session) return null
  const role = session.user.role as string
  const permissions = await getRolePermissions(role)
  if (role !== 'ADMIN' && !permissions.canManageCustomers) return null
  const subscriber = await prisma.subscriber.findUnique({
    where: { id },
    select: { id: true, fullName: true, phone: true, photoUrl: true },
  })
  return subscriber ? { session, subscriber } : null
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const auth = await authorizeSubscriber(id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 404 })
  const { credential, payload } = await ensureMembershipQrCredential(id)
  return NextResponse.json({ subscriber: auth.subscriber, credential, payload })
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const auth = await authorizeSubscriber(id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 404 })
  const { credential, payload } = await rotateMembershipQrCredential(id)
  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'qr_rotated',
      entityType: 'subscriber',
      entityId: id,
      performedBy: auth.session.user.name || auth.session.user.email || auth.session.user.id,
      details: { credentialId: credential.id, version: credential.version },
    },
  })
  return NextResponse.json({ subscriber: auth.subscriber, credential, payload })
}
