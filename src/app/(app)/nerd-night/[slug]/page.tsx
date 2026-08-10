import NerdNightEventClient from '@/components/nerd-night/NerdNightEventClient'
import NerdNightSiteFooter from '@/components/nerd-night/NerdNightSiteFooter'
import { authOptions } from '@/lib/auth'
import { getNerdNightTheme } from '@/lib/nerd-night/constants'
import { buildNerdNightQrUrl, formatNerdNightDate, formatVnd } from '@/lib/nerd-night/format'
import { prisma } from '@/lib/prisma'
import { generateOfficialQR } from '@/lib/vietqr'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NerdNightEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  const now = new Date()

  const event = await prisma.nerdNightEvent.findUnique({
    where: { slug },
    include: {
      registrations: {
        select: {
          id: true,
          userId: true,
          attendeeName: true,
          status: true,
          paymentStatus: true,
          paymentExpiresAt: true,
          speakerStatus: true,
          topicTitle: true,
          votesReceived: { select: { id: true } },
        },
      },
      reviews: {
        where: { isVisible: true },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!event || !['PUBLISHED', 'COMPLETED'].includes(event.status)) notFound()

  const currentRegistration = session?.user?.id
    ? await prisma.nerdNightRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
      })
    : null
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, phone: true },
      })
    : null
  let currentPaymentQrUrl = currentRegistration?.paymentQrUrl || null
  if (
    currentRegistration &&
    currentRegistration.status === 'ACTIVE' &&
    currentRegistration.paymentStatus !== 'CONFIRMED' &&
    !currentPaymentQrUrl
  ) {
    currentPaymentQrUrl = await generateOfficialQR({
      amount: currentRegistration.amount,
      description: currentRegistration.transferContent,
      bankCode: currentRegistration.paymentBankCode,
      accountNumber: currentRegistration.paymentAccountNumber,
      accountName: currentRegistration.paymentAccountName,
    })
    await prisma.nerdNightRegistration.update({
      where: { id: currentRegistration.id },
      data: { paymentQrUrl: currentPaymentQrUrl },
    })
  }
  const ownReview = session?.user?.id
    ? event.reviews.find((review) => review.userId === session.user.id) || null
    : null
  const hasVoted = session?.user?.id
    ? Boolean(await prisma.nerdNightVote.findUnique({
        where: { eventId_voterId: { eventId: event.id, voterId: session.user.id } },
        select: { id: true },
      }))
    : false

  const holdingRegistrations = event.registrations.filter(
    (registration) =>
      registration.status === 'ACTIVE' &&
      (registration.paymentStatus !== 'UNPAID' ||
        !registration.paymentExpiresAt ||
        registration.paymentExpiresAt > now),
  )
  const speakers = event.registrations.filter(
    (registration) =>
      registration.status === 'ACTIVE' &&
      registration.paymentStatus === 'CONFIRMED' &&
      registration.speakerStatus === 'APPROVED' &&
      registration.topicTitle,
  )
  const heldSpeakerSlots = event.registrations.filter(
    (registration) =>
      registration.status === 'ACTIVE' &&
      (registration.paymentStatus !== 'UNPAID' ||
        !registration.paymentExpiresAt ||
        registration.paymentExpiresAt > now) &&
      ['PENDING', 'APPROVED'].includes(registration.speakerStatus),
  ).length
  const heldListenerSlots = holdingRegistrations.length - heldSpeakerSlots
  const listenerCapacity = event.capacity - event.speakerCapacity
  const totalRemaining = Math.max(0, event.capacity - holdingRegistrations.length)
  const theme = getNerdNightTheme(event.themeCode)
  const isExpired = Boolean(
    currentRegistration?.paymentStatus === 'UNPAID' &&
    currentRegistration.paymentExpiresAt &&
    currentRegistration.paymentExpiresAt <= now,
  )
  const topicExamples = event.themeCode === 'THEORY'
    ? [
        'Vì sao bài hát cũ luôn “đúng lúc” bật lên khi mình buồn',
        'Lý thuyết riêng về việc tại sao nhóm bạn nào cũng có một người hay trễ giờ',
        'Vì sao đồ ăn tự nấu ngon hơn hẳn dù công thức y hệt ngoài hàng',
        'Một khung giải thích cho thói quen mua sách về rồi không đọc',
        'Vì sao tin nhắn “đã xem” gây áp lực hơn cả cuộc gọi nhỡ',
        'Lý thuyết cá nhân về việc review 1 sao luôn đáng tin hơn 5 sao',
      ]
    : event.topicSuggestions.length > 0
      ? event.topicSuggestions.slice(0, 6)
      : ['Một quan sát nhỏ trong đời sống khiến bạn tò mò và muốn kể lại']

  return (
    <main className="nn-detail">
      <section className="nn-detail-intro">
        <div className="nn-detail-inner">
          <Link href="/nerd-night#events" className="nn-back">← Quay lại danh sách các đêm</Link>
          <header className="nn-detail-head">
            <span className={`nn-theme-tag nn-color-${theme.color}`}>{event.themeCode}</span>
            <h1 className="nn-section-title nn-detail-title">{event.title}</h1>
            <p className="nn-detail-description">{event.themeDescription || theme.description}</p>
            <aside className="nn-topic-callout">
              <p>Nghe hơi trừu tượng? Vài chủ đề đời thường có thể kể theo hướng này:</p>
              <ul>
                {topicExamples.map((topic) => <li key={topic}>{topic}</li>)}
              </ul>
            </aside>
            <div className="nn-detail-facts">
              <span><b>{formatNerdNightDate(event.startsAt)}</b></span>
              <span>{event.venueName}{event.venueAddress ? ` · ${event.venueAddress}` : ''}</span>
              <span><b>{formatVnd(event.price)}</b> / người</span>
            </div>
          </header>
        </div>
      </section>

      <section className="nn-detail-actions" id="event-actions">
        <div className="nn-wrap">
          <NerdNightEventClient
          event={{
            id: event.id,
            status: event.status,
            registrationOpen: event.registrationOpen,
            speakerRegistrationOpen: event.speakerRegistrationOpen,
            votingStatus: event.votingStatus,
            capacity: event.capacity,
            listenerCapacity,
            listenerRemaining: Math.min(totalRemaining, Math.max(0, listenerCapacity - heldListenerSlots)),
            speakerCapacity: event.speakerCapacity,
            speakerRemaining: Math.min(totalRemaining, Math.max(0, event.speakerCapacity - heldSpeakerSlots)),
            topicSuggestions: event.topicSuggestions,
          }}
          isLoggedIn={Boolean(session)}
          loginUrl={`/login?callbackUrl=${encodeURIComponent(`/nerd-night/${event.slug}`)}`}
          user={currentUser ? { name: currentUser.name, phone: currentUser.phone || '' } : null}
          registration={currentRegistration ? {
            id: currentRegistration.id,
            status: currentRegistration.status,
            paymentStatus: currentRegistration.paymentStatus,
            speakerStatus: currentRegistration.speakerStatus,
            amount: currentRegistration.amount,
            transferContent: currentRegistration.transferContent,
            paymentExpiresAt: currentRegistration.paymentExpiresAt?.toISOString() || null,
            isExpired,
            qrUrl: currentPaymentQrUrl || buildNerdNightQrUrl({
              bankCode: currentRegistration.paymentBankCode,
              accountNumber: currentRegistration.paymentAccountNumber,
              accountName: currentRegistration.paymentAccountName,
              amount: currentRegistration.amount,
              content: currentRegistration.transferContent,
            }),
          } : null}
          speakers={speakers.map((speaker) => ({
            id: speaker.id,
            name: speaker.attendeeName,
            topic: speaker.topicTitle!,
            voteCount: event.votingStatus === 'RESULTS' ? speaker.votesReceived.length : null,
          }))}
          reviews={event.reviews.map((review) => ({
            id: review.id,
            name: review.user.name,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
          }))}
          ownReview={ownReview ? { rating: ownReview.rating, comment: ownReview.comment } : null}
          hasVoted={hasVoted}
          />
        </div>
      </section>
      <NerdNightSiteFooter />
    </main>
  )
}
