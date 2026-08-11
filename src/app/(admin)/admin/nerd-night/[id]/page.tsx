import NerdNightAdminDetail from '@/components/nerd-night/admin/NerdNightAdminDetail'
import { checkApiPermission } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NerdNightAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await checkApiPermission('canViewNerdNight')
  if (!access.session || !access.hasAccess) redirect('/admin?error=access_denied')
  const [event, locations, manageAccess, confirmAccess] = await Promise.all([
    prisma.nerdNightEvent.findUnique({
      where: { id },
      include: {
        registrations: {
          include: { user: { select: { email: true } }, votesReceived: { select: { id: true } } },
          orderBy: { createdAt: 'desc' },
        },
        reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true } }),
    checkApiPermission('canManageNerdNight'),
    checkApiPermission('canConfirmNerdNightPayments'),
  ])
  if (!event) notFound()

  return <NerdNightAdminDetail
    canManage={manageAccess.hasAccess}
    canConfirm={confirmAccess.hasAccess}
    locations={locations}
    event={{ id: event.id, slug: event.slug, season: event.season, episode: event.episode, themeCode: event.themeCode, title: event.title, themeDescription: event.themeDescription, topicPrompt: event.topicPrompt, topicSuggestions: event.topicSuggestions, startsAt: event.startsAt.toISOString(), locationId: event.locationId, venueName: event.venueName, venueAddress: event.venueAddress, price: event.price, capacity: event.capacity, speakerCapacity: event.speakerCapacity, registrationOpen: event.registrationOpen, speakerRegistrationOpen: event.speakerRegistrationOpen, status: event.status, votingStatus: event.votingStatus, notes: event.notes }}
    registrations={event.registrations.map((item) => ({ id: item.id, code: item.registrationCode, name: item.attendeeName, phone: item.attendeePhone, email: item.user.email, status: item.status, paymentStatus: item.paymentStatus, refundStatus: item.refundStatus, amount: item.amount, paymentReportedAt: item.paymentReportedAt?.toISOString() || null, paymentConfirmedAt: item.paymentConfirmedAt?.toISOString() || null, paymentExpiresAt: item.paymentExpiresAt?.toISOString() || null, paymentTransactionId: item.paymentTransactionId, paymentReceivedAmount: item.paymentReceivedAmount, speakerStatus: item.speakerStatus, wantsToShare: item.wantsToShare, topicTitle: item.topicTitle, topicBackup1: item.topicBackup1, topicBackup2: item.topicBackup2, topicDescription: item.topicDescription, hasSlides: item.hasSlides, interests: item.interests, voteCount: item.votesReceived.length }))}
    reviews={event.reviews.map((review) => ({ id: review.id, name: review.user.name, rating: review.rating, comment: review.comment }))}
  />
}
