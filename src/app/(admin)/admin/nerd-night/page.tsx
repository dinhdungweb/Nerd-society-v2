import NerdNightAdminDashboard from '@/components/nerd-night/admin/NerdNightAdminDashboard'
import { checkApiPermission } from '@/lib/apiPermissions'
import { holdsNerdNightSeat } from '@/lib/nerd-night/registration-state'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NerdNightAdminPage() {
  const { session, hasAccess } = await checkApiPermission('canViewNerdNight')
  if (!session || !hasAccess) redirect('/admin?error=access_denied')

  const [events, locations] = await Promise.all([
    prisma.nerdNightEvent.findMany({
      include: {
        registrations: {
          select: {
            status: true,
            paymentStatus: true,
            paymentExpiresAt: true,
            paymentTransactionId: true,
            paymentReceivedAmount: true,
            speakerStatus: true,
          },
        },
      },
      orderBy: [{ season: 'desc' }, { episode: 'desc' }],
    }),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } }),
  ])
  const manageAccess = await checkApiPermission('canManageNerdNight')

  return (
    <NerdNightAdminDashboard
      canManage={manageAccess.hasAccess}
      locations={locations}
      events={events.map((event) => ({
        id: event.id,
        slug: event.slug,
        season: event.season,
        episode: event.episode,
        themeCode: event.themeCode,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        venueName: event.venueName,
        status: event.status,
        registrationOpen: event.registrationOpen,
        capacity: event.capacity,
        activeCount: event.registrations.filter((item) => holdsNerdNightSeat(item)).length,
        pendingPayments: event.registrations.filter((item) => item.paymentStatus === 'PENDING' && holdsNerdNightSeat(item)).length,
        pendingSpeakers: event.registrations.filter((item) => item.speakerStatus === 'PENDING' && holdsNerdNightSeat(item)).length,
      }))}
    />
  )
}
