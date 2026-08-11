import {
  NerdNightDrinkIcon,
  NerdNightEnvelopeIcon,
  NerdNightMedal,
  NerdNightPeopleIcon,
  NerdNightSquiggle,
} from '@/components/nerd-night/NerdNightArtwork'
import NerdNightSiteFooter from '@/components/nerd-night/NerdNightSiteFooter'
import { getNerdNightTheme, NERD_NIGHT_SEASON_ORDER } from '@/lib/nerd-night/constants'
import { formatNerdNightDate, formatVnd } from '@/lib/nerd-night/format'
import {
  getNerdNightDisplayStatus,
  NERD_NIGHT_DISPLAY_STATUS_LABELS,
} from '@/lib/nerd-night/status'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nerd Night',
  description: '5 phút để kể, cả tối để quen nhau tại Nerd Society.',
}

function holdsSeat(registration: {
  status: string
  paymentStatus: string
  paymentExpiresAt: Date | null
}) {
  return (
    registration.status === 'ACTIVE' &&
    (registration.paymentStatus !== 'UNPAID' ||
      !registration.paymentExpiresAt ||
      registration.paymentExpiresAt > new Date())
  )
}

async function getEvents() {
  const events = await prisma.nerdNightEvent.findMany({
    where: { status: { in: ['PUBLISHED', 'COMPLETED', 'CANCELLED'] } },
    include: {
      registrations: {
        select: { status: true, paymentStatus: true, paymentExpiresAt: true, speakerStatus: true },
      },
      reviews: { where: { isVisible: true }, select: { rating: true } },
    },
    orderBy: { startsAt: 'asc' },
  })

  return events.map((event) => {
    const holdingRegistrations = event.registrations.filter(holdsSeat)
    const taken = holdingRegistrations.length
    const speakerTaken = holdingRegistrations.filter((item) => ['PENDING', 'APPROVED'].includes(item.speakerStatus)).length
    const listenerCapacity = event.capacity - event.speakerCapacity
    const listenerTaken = taken - speakerTaken
    const totalRemaining = Math.max(0, event.capacity - taken)
    const listenerRemaining = Math.min(totalRemaining, Math.max(0, listenerCapacity - listenerTaken))
    const speakerRemaining = Math.min(totalRemaining, Math.max(0, event.speakerCapacity - speakerTaken))
    const averageRating = event.reviews.length
      ? event.reviews.reduce((sum, review) => sum + review.rating, 0) / event.reviews.length
      : null
    return { ...event, taken, remaining: totalRemaining, listenerCapacity, listenerRemaining, speakerRemaining, averageRating }
  })
}

function EventCard({ event }: { event: Awaited<ReturnType<typeof getEvents>>[number] }) {
  const theme = getNerdNightTheme(event.themeCode)
  const displayStatus = getNerdNightDisplayStatus(event)
  const statusLabel = NERD_NIGHT_DISPLAY_STATUS_LABELS[displayStatus]

  return (
    <article className="nn-event-card">
      <div className="nn-event-main">
        <div className="nn-event-labels">
          <span className={`nn-theme-tag nn-color-${theme.color}`}>{event.themeCode}</span>
          <span className={`nn-event-status nn-state-${displayStatus.toLowerCase()}`}>{statusLabel}</span>
        </div>
        <h3 className="nn-event-title">{event.title}</h3>
        <div className="nn-event-meta">
          <span><b>{formatNerdNightDate(event.startsAt)}</b></span>
          <span>{event.venueName}</span>
        </div>
      </div>
      <div className="nn-event-side">
        <div className="nn-event-price">{formatVnd(event.price)}</div>
        <div className={`nn-event-slots ${displayStatus === 'OPEN' && event.remaining <= 3 ? 'low' : ''}`}>
          {displayStatus === 'COMPLETED'
            ? event.averageRating
              ? `${event.averageRating.toFixed(1)}/5 · ${event.reviews.length} feedback`
              : 'Đã kết thúc'
            : displayStatus === 'CANCELLED'
              ? 'Đêm này đã hủy'
            : displayStatus === 'ONGOING'
              ? 'Chương trình đang diễn ra'
            : displayStatus === 'UPCOMING'
              ? 'Chưa mở đăng ký'
            : displayStatus === 'OPEN' && (event.listenerRemaining > 0 || event.speakerRemaining > 0)
              ? `còn ${event.listenerRemaining} chỗ nghe · ${event.speakerRemaining} speaker`
              : 'đã hết chỗ'}
        </div>
        <Link href={`/nerd-night/${event.slug}`} className="nn-button nn-button-primary nn-button-small">
          {displayStatus === 'COMPLETED'
            ? 'Xem lại đêm này'
            : displayStatus === 'CANCELLED'
              ? 'Xem thông báo'
            : displayStatus === 'OPEN'
              ? 'Xem & đăng ký'
              : displayStatus === 'ONGOING'
                ? 'Xem chương trình'
                : 'Xem thông tin'}
        </Link>
      </div>
    </article>
  )
}

const steps = [
  {
    number: '01',
    title: 'Đăng ký',
    body: 'Chọn đêm bạn muốn tham dự, đăng ký chỗ trước — một chủ đề, một tối, một cộng đồng.',
  },
  {
    number: '02',
    title: 'Kể chuyện 5–10 phút',
    body: 'Nếu bạn muốn lên chia sẻ — ngắn gọn, đúng chất “mê là kể”. Không cần hoàn hảo.',
  },
  {
    number: '03',
    title: 'Vote và networking game',
    body: 'Cả phòng vote cho phần yêu thích nhất rồi cùng tham gia những hoạt động kết nối do host dẫn dắt.',
  },
  {
    number: '04',
    title: 'Nhận huy hiệu',
    body: 'Người thắng có Nerd Prof Badge và quà. Ai đến cũng về với Nerd Badge riêng của mình.',
  },
]

const perks = [
  {
    icon: <NerdNightDrinkIcon />,
    title: 'Free-flow đồ uống & snack',
    body: 'Tiếp sức để cả buổi thật nhiều năng lượng kể chuyện và lắng nghe.',
    note: 'miễn phí cả đêm',
  },
  {
    icon: <NerdNightEnvelopeIcon />,
    title: 'Phong bì bí mật',
    body: 'Một phần quà nhỏ từ Nerd dành cho mọi người tham gia.',
    note: 'bí mật đến tối mới biết',
  },
  {
    icon: <NerdNightPeopleIcon />,
    title: 'Cơ hội quen người mới',
    body: 'Không hứa hẹn gì to tát, nhưng rất có thể bạn sẽ gặp một người hợp gu hơn cả bạn nghĩ.',
    note: 'cộng đồng Nerdie luôn ở bên bạn',
  },
]

export default async function NerdNightPage() {
  const events = await getEvents()
  const scheduled = events.filter((event) => ['PUBLISHED', 'CANCELLED'].includes(event.status))
  const completed = events.filter((event) => event.status === 'COMPLETED').reverse()
  const roadmapSeason = scheduled[0]?.season || completed[0]?.season || 1

  return (
    <main className="nn-scroll-root">
      <section className="nn-snap-section nn-hero-section">
        <div className="nn-wrap nn-hero">
          <div className="nn-brandline">
            <div className="nn-brand"><b>Nerd</b> Society</div>
            <div className="nn-brand">Hanoi</div>
          </div>

          <Image
            className="nn-hero-illustration"
            src="/images/nerd-night-illustration.png"
            alt="Minh hoạ cộng đồng Nerd Night"
            width={1920}
            height={1080}
            priority
          />
          <span className="nn-eyebrow">5 phút để kể, cả tối để quen nhau</span>
          <h1 className="nn-title">Nerd Night</h1>
          <NerdNightSquiggle />
          <p className="nn-tagline">
            Mỗi đêm một chủ đề. Ai cũng tìm được lý do để ở lại.{' '}
            <b>Không phải để thắng, mà để tìm thấy những người cũng thấy thế giới thú vị như bạn.</b>
          </p>
          <a href="#events" className="nn-button nn-button-ghost nn-hero-cta">
            Xem các đêm sắp tới
          </a>
        </div>
      </section>

      <section className="nn-snap-section">
        <div className="nn-wrap">
          <div className="nn-section-head nn-section-head-left">
            <span className="nn-hand-label">Cách tham gia</span>
            <h2 className="nn-section-title">4 bước, không có gì phức tạp</h2>
          </div>
          <div className="nn-steps">
            {steps.map((step) => (
              <article className="nn-step" key={step.number}>
                <span className="nn-step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nn-snap-section">
        <div className="nn-wrap">
          <div className="nn-section-head nn-section-head-left">
            <div className="nn-kicker">Vé của bạn</div>
            <h2 className="nn-section-title">Vé này bao gồm những gì</h2>
          </div>
          <div className="nn-perks">
            {perks.map((perk) => (
              <article className="nn-perk" key={perk.title}>
                <div className="nn-perk-icon">{perk.icon}</div>
                <div>
                  <h3>{perk.title}</h3>
                  <p>{perk.body}</p>
                  <span>↳ {perk.note}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nn-snap-section">
        <div className="nn-wrap">
          <div className="nn-section-head nn-section-head-left">
            <h2 className="nn-section-title">Ai cũng về nhà với một huy hiệu</h2>
            <span className="nn-hand-label">không ai về tay trắng</span>
          </div>
          <div className="nn-badges">
            <article className="nn-badge-card">
              <NerdNightMedal size={62} />
              <div>
                <h3 className="nn-badge-name">Nerd Badge</h3>
                <p className="nn-muted">Dành cho mọi người có mặt — chỉ cần đến, đã tính là một trong hội.</p>
                <span className="nn-badge-tag">Ai cũng có</span>
              </div>
            </article>
            <article className="nn-badge-card nn-badge-card-prof">
              <NerdNightMedal prof size={62} />
              <div>
                <h3 className="nn-badge-name">Nerd Prof Badge</h3>
                <p className="nn-muted">Dành cho phần trình bày được vote nhiều nhất — kèm sổ tay & bút Nerd.</p>
                <span className="nn-badge-tag">Người thắng cuộc</span>
              </div>
            </article>
          </div>
          <p className="nn-badge-note">chút kỷ niệm về một đêm đáng nhớ</p>
        </div>
      </section>

      <section className="nn-snap-section nn-events-section" id="events">
        <div className="nn-wrap">
          <div className="nn-section-head nn-section-head-left">
            <div className="nn-kicker">Season {roadmapSeason}</div>
            <h2 className="nn-section-title">Lịch các đêm</h2>
            <p className="nn-section-sub">
              Season đi qua sáu chủ đề nối tiếp nhau như một mạch tư duy — từ lý thuyết đến thực hành.
            </p>
          </div>
          <div className="nn-roadmap">
            {NERD_NIGHT_SEASON_ORDER.map((code) => {
              const event = events.find((item) => item.season === roadmapSeason && item.themeCode === code)
              if (event) {
                const theme = getNerdNightTheme(code)
                return (
                  <Link key={code} href={`/nerd-night/${event.slug}`} className={`nn-roadmap-item available nn-color-${theme.color}`}>
                    {code}
                  </Link>
                )
              }
              return (
                <span key={code} className="nn-roadmap-item">{code} · sắp có</span>
              )
            })}
          </div>
          <div className="nn-event-list">
            {scheduled.length
              ? scheduled.map((event) => <EventCard key={event.id} event={event} />)
              : <p className="nn-empty">Chưa có đêm nào được mở đăng ký.</p>}
          </div>
          <p className="nn-events-note">Chọn đêm bạn muốn rồi đến thôi — một chủ đề, một tối, một cộng đồng.</p>
        </div>
      </section>

      {completed.length > 0 && (
        <section className="nn-snap-section nn-archive-section">
          <div className="nn-wrap">
            <div className="nn-section-head nn-section-head-left">
              <div className="nn-kicker">Archive</div>
              <h2 className="nn-section-title">Những đêm đã diễn ra</h2>
            </div>
            <div className="nn-event-list">{completed.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </div>
        </section>
      )}

      <section className="nn-footer-snap" id="site-footer" aria-label="Thông tin Nerd Society">
        <NerdNightSiteFooter />
      </section>
    </main>
  )
}
