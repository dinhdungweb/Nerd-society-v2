import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMembershipAccess } from '@/lib/subscription/membership-access'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscriber = await prisma.subscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, fullName: true, photoUrl: true },
  })
  if (!subscriber) return NextResponse.json({ error: 'Không tìm thấy hồ sơ hội viên' }, { status: 404 })

  const { credential, payload } = await ensureMembershipAccess(subscriber.id, session.user.id)
  return NextResponse.json({ payload, status: credential.status, memberName: subscriber.fullName, photoUrl: subscriber.photoUrl })
}
