'use client'

import {
  registerForNerdNight,
  reportNerdNightPayment,
  submitNerdNightReview,
  voteForNerdNightSpeaker,
} from '@/actions/nerd-night'
import { NERD_NIGHT_INTERESTS } from '@/lib/nerd-night/constants'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { NerdNightMedal } from './NerdNightArtwork'

type Registration = {
  id: string
  status: string
  paymentStatus: string
  speakerStatus: string
  amount: number
  transferContent: string
  qrUrl: string
  paymentExpiresAt: string | null
  isExpired: boolean
}

type Speaker = {
  id: string
  name: string
  topic: string
  voteCount: number | null
}

type Review = {
  id: string
  name: string
  rating: number
  comment: string | null
  createdAt: string
}

export interface NerdNightEventClientProps {
  event: {
    id: string
    status: string
    hasStarted: boolean
    registrationOpen: boolean
    speakerRegistrationOpen: boolean
    votingStatus: string
    capacity: number
    listenerCapacity: number
    listenerRemaining: number
    speakerCapacity: number
    speakerRemaining: number
    topicSuggestions: string[]
  }
  isLoggedIn: boolean
  user: { name: string; phone: string } | null
  registration: Registration | null
  speakers: Speaker[]
  reviews: Review[]
  ownReview: { rating: number; comment: string | null } | null
  hasVoted: boolean
  loginUrl: string
}

export default function NerdNightEventClient({
  event,
  isLoggedIn,
  user,
  registration,
  speakers,
  reviews,
  ownReview,
  hasVoted,
  loginUrl,
}: NerdNightEventClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'register' | 'vote' | 'feedback'>(
    event.status === 'COMPLETED' ? 'feedback' : 'register',
  )
  const [pending, startTransition] = useTransition()
  const [wantsToShare, setWantsToShare] = useState(
    event.listenerRemaining <= 0 && event.speakerRegistrationOpen && event.speakerRemaining > 0,
  )
  const [hasSlides, setHasSlides] = useState(false)
  const [interests, setInterests] = useState<string[]>([])
  const [rating, setRating] = useState(ownReview?.rating || 0)
  const [message, setMessage] = useState('')
  const activeRegistration = registration && registration.status === 'ACTIVE' && !registration.isExpired

  useEffect(() => {
    if (!activeRegistration || registration.paymentStatus === 'CONFIRMED') return

    const interval = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [activeRegistration, registration?.paymentStatus, router])

  useEffect(() => {
    if (!wantsToShare && event.listenerRemaining <= 0 && event.speakerRegistrationOpen && event.speakerRemaining > 0) {
      setWantsToShare(true)
    } else if (wantsToShare && (!event.speakerRegistrationOpen || event.speakerRemaining <= 0) && event.listenerRemaining > 0) {
      setWantsToShare(false)
    }
  }, [event.listenerRemaining, event.speakerRegistrationOpen, event.speakerRemaining, wantsToShare])

  const canReview =
    event.status === 'COMPLETED' &&
    registration?.status === 'ACTIVE' &&
    registration.paymentStatus === 'CONFIRMED'
  const canVote =
    event.votingStatus === 'OPEN' &&
    registration?.status === 'ACTIVE' &&
    registration.paymentStatus === 'CONFIRMED' &&
    !hasVoted

  const sortedSpeakers = useMemo(
    () => [...speakers].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0)),
    [speakers],
  )
  const topVoteCount = Math.max(0, ...sortedSpeakers.map((speaker) => speaker.voteCount || 0))

  function toggleInterest(value: string) {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length < 3
          ? [...current, value]
          : current,
    )
  }

  function handleRegister(formData: FormData) {
    setMessage('')
    startTransition(async () => {
      const result = await registerForNerdNight({
        eventId: event.id,
        attendeeName: String(formData.get('attendeeName') || ''),
        attendeePhone: String(formData.get('attendeePhone') || ''),
        wantsToShare,
        topicTitle: String(formData.get('topicTitle') || ''),
        topicBackup1: String(formData.get('topicBackup1') || ''),
        topicBackup2: String(formData.get('topicBackup2') || ''),
        topicDescription: String(formData.get('topicDescription') || ''),
        hasSlides,
        interests: interests as (typeof NERD_NIGHT_INTERESTS)[number][],
      })
      if (!result.success) return setMessage(result.error)
      if (result.message) toast(result.message)
      else toast.success('Đã giữ chỗ! Hoàn tất chuyển khoản để Nerd Society xác nhận vé.')
      router.refresh()
    })
  }

  function handleReportPayment() {
    if (!registration) return
    startTransition(async () => {
      const result = await reportNerdNightPayment(registration.id)
      if (!result.success) return setMessage(result.error)
      toast.success('Đã báo chuyển khoản. Hệ thống đang tự động đối soát giao dịch.')
      router.refresh()
    })
  }

  function handleVote(speakerId: string) {
    if (!canVote) return
    startTransition(async () => {
      const result = await voteForNerdNightSpeaker(event.id, speakerId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Vote của bạn đã được ghi nhận!')
      setTab('feedback')
      router.refresh()
    })
  }

  function handleReview(formData: FormData) {
    startTransition(async () => {
      const result = await submitNerdNightReview({
        eventId: event.id,
        rating,
        comment: String(formData.get('comment') || ''),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(ownReview ? 'Đã cập nhật feedback' : 'Cảm ơn feedback của bạn!')
      router.refresh()
    })
  }

  return (
    <>
      <div className="nn-tabs" role="tablist" aria-label="Nerd Night">
        <button className={`nn-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Đăng ký</button>
        <button className={`nn-tab ${tab === 'vote' ? 'active' : ''}`} onClick={() => setTab('vote')}>Vote</button>
        <button className={`nn-tab ${tab === 'feedback' ? 'active' : ''}`} onClick={() => setTab('feedback')}>Feedback</button>
      </div>

      {tab === 'register' && (
        <div className="nn-panel">
          {event.status === 'CANCELLED' ? (
            <div className="nn-status">
              <NerdNightMedal size={72} />
              <p className="nn-badge-name">Đêm này đã hủy</p>
              <p className="nn-muted">Nerd Society sẽ liên hệ với người đã đăng ký để hỗ trợ các bước tiếp theo.</p>
            </div>
          ) : activeRegistration ? (
            <RegistrationStatus registration={registration!} pending={pending} onReportPayment={handleReportPayment} />
          ) : event.hasStarted ? (
            <div className="nn-status">
              <NerdNightMedal size={72} />
              <p className="nn-badge-name">Đêm này đang diễn ra</p>
              <p className="nn-muted">Đăng ký đã đóng từ giờ bắt đầu chương trình. Hẹn bạn ở đêm Nerd Night tiếp theo nhé!</p>
            </div>
          ) : !isLoggedIn ? (
            <div className="nn-status">
              <NerdNightMedal size={72} />
              <p className="nn-badge-name">Đăng nhập để giữ chỗ</p>
              <p className="nn-muted">Bạn vẫn có thể xem lịch, speaker và feedback mà không cần đăng nhập.</p>
              <a className="nn-button nn-button-primary nn-button-block" style={{ marginTop: 20 }} href={loginUrl}>Đăng nhập</a>
            </div>
          ) : !event.registrationOpen || event.status !== 'PUBLISHED' ? (
            <p className="nn-empty">Đêm này hiện không mở đăng ký.</p>
          ) : event.listenerRemaining <= 0 && (!event.speakerRegistrationOpen || event.speakerRemaining <= 0) ? (
            <p className="nn-empty">Đêm này đã đủ {event.capacity} người rồi — hẹn bạn ở đêm sau nhé!</p>
          ) : (
            <form action={handleRegister}>
              <p className="nn-muted" style={{ textAlign: 'center', marginBottom: 18 }}>
                Còn {event.listenerRemaining}/{event.listenerCapacity} chỗ người nghe
                {event.speakerRegistrationOpen && ` · ${event.speakerRemaining}/${event.speakerCapacity} suất speaker`}.
              </p>
              {registration?.isExpired && <p className="nn-message error">Lần giữ chỗ trước đã hết hạn. Bạn có thể đăng ký lại bên dưới.</p>}
              <div className="nn-field">
                <label htmlFor="attendeeName">Tên</label>
                <input id="attendeeName" name="attendeeName" defaultValue={user?.name} required />
              </div>
              <div className="nn-field">
                <label htmlFor="attendeePhone">Số điện thoại</label>
                <input id="attendeePhone" name="attendeePhone" type="tel" defaultValue={user?.phone} required />
              </div>
              <div className="nn-field">
                <label>Bạn có muốn lên chia sẻ 5–10 phút không?</label>
                <div className="nn-toggle-row">
                  <button type="button" className={`nn-toggle ${wantsToShare ? 'selected' : ''}`} onClick={() => setWantsToShare(true)} disabled={!event.speakerRegistrationOpen || event.speakerRemaining <= 0}>Có, mình muốn chia sẻ</button>
                  <button type="button" className={`nn-toggle ${!wantsToShare ? 'selected' : ''}`} onClick={() => setWantsToShare(false)} disabled={event.listenerRemaining <= 0}>Không, mình đến nghe thôi</button>
                </div>
                {event.speakerRegistrationOpen && <p className="nn-muted" style={{ marginTop: 6 }}>Còn {event.speakerRemaining} suất chia sẻ.</p>}
              </div>
              {wantsToShare && (
                <>
                  <p className="nn-muted" style={{ marginBottom: 16 }}>Bạn có 5–10 phút để chia sẻ. Chủ đề sẽ được staff duyệt trước khi hiển thị công khai.</p>
                  <div className="nn-field">
                    <label htmlFor="topicTitle">Chủ đề chính bạn sẽ kể</label>
                    <input id="topicTitle" name="topicTitle" required placeholder="VD: Con tàu Theseus" />
                    {event.topicSuggestions.length > 0 && <p className="nn-muted" style={{ marginTop: 6 }}>Gợi ý: {event.topicSuggestions.slice(0, 4).join(' · ')}</p>}
                  </div>
                  <div className="nn-field"><label htmlFor="topicBackup1">Chủ đề dự bị 1</label><input id="topicBackup1" name="topicBackup1" /></div>
                  <div className="nn-field"><label htmlFor="topicBackup2">Chủ đề dự bị 2</label><input id="topicBackup2" name="topicBackup2" /><p className="nn-muted" style={{ marginTop: 6 }}>Nếu chủ đề chính bị trùng, Nerd Society sẽ ưu tiên trao đổi để chuyển sang chủ đề dự bị.</p></div>
                  <div className="nn-field"><label htmlFor="topicDescription">Mô tả ngắn</label><textarea id="topicDescription" name="topicDescription" /></div>
                  <div className="nn-field">
                    <label>Bạn có dùng slide không?</label>
                    <div className="nn-toggle-row">
                      <button type="button" className={`nn-toggle ${hasSlides ? 'selected' : ''}`} onClick={() => setHasSlides(true)}>Có, mình có slide</button>
                      <button type="button" className={`nn-toggle ${!hasSlides ? 'selected' : ''}`} onClick={() => setHasSlides(false)}>Không cần slide</button>
                    </div>
                  </div>
                </>
              )}
              <div className="nn-field">
                <label>Lĩnh vực bạn quan tâm nhất (chọn 1–3)</label>
                <p className="nn-muted" style={{ margin: '-2px 0 10px' }}>Dùng để xếp bạn ngồi gần người có cùng mối quan tâm.</p>
                <div className="nn-chips">
                  {NERD_NIGHT_INTERESTS.map((interest) => <button key={interest} type="button" className={`nn-chip ${interests.includes(interest) ? 'selected' : ''}`} onClick={() => toggleInterest(interest)}>{interest}</button>)}
                </div>
              </div>
              <button className="nn-button nn-button-primary nn-button-block" disabled={pending || interests.length === 0}>{pending ? 'Đang giữ chỗ...' : 'Đăng ký'}</button>
              {message && <p className="nn-message error">{message}</p>}
            </form>
          )}
        </div>
      )}

      {tab === 'vote' && (
        <div className="nn-panel">
          {event.votingStatus === 'CLOSED' ? <p className="nn-empty">Vote chưa mở. Staff sẽ mở vote trong đêm diễn ra.</p> : speakers.length === 0 ? <p className="nn-empty">Chưa có speaker được duyệt cho đêm này.</p> : (
            <>
              <p className="nn-muted" style={{ textAlign: 'center', marginBottom: 18 }}>
                {event.votingStatus === 'RESULTS' ? 'Kết quả bình chọn' : hasVoted ? 'Bạn đã vote cho đêm này.' : canVote ? 'Chọn một phần chia sẻ bạn yêu thích nhất.' : 'Chỉ vé đã xác nhận mới được vote.'}
              </p>
              <div className="nn-speakers">
                {sortedSpeakers.map((speaker) => (
                  <button key={speaker.id} type="button" className={`nn-speaker ${event.votingStatus === 'RESULTS' && topVoteCount > 0 && speaker.voteCount === topVoteCount ? 'selected' : ''}`} onClick={() => handleVote(speaker.id)} disabled={!canVote || pending}>
                    <div className="nn-speaker-name">{event.votingStatus === 'RESULTS' && topVoteCount > 0 && speaker.voteCount === topVoteCount ? '🏅 ' : ''}{speaker.name}</div>
                    <div className="nn-speaker-topic">{speaker.topic}{speaker.voteCount !== null ? ` · ${speaker.voteCount} vote` : ''}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div className="nn-panel">
          {!canReview ? <p className="nn-empty">Feedback mở sau khi đêm kết thúc cho người có vé đã xác nhận.</p> : (
            <form action={handleReview}>
              <p className="nn-muted" style={{ textAlign: 'center' }}>Cho Nerd Society xin ý kiến về đêm này nhé 🙂</p>
              <div className="nn-rating">
                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={rating === value ? 'selected' : ''} onClick={() => setRating(value)}>{value}</button>)}
              </div>
              <div className="nn-field"><label htmlFor="comment">Điều gì bạn thích nhất / muốn cải thiện?</label><textarea id="comment" name="comment" defaultValue={ownReview?.comment || ''} /></div>
              <button className="nn-button nn-button-primary nn-button-block" disabled={pending || !rating}>{pending ? 'Đang gửi...' : ownReview ? 'Cập nhật feedback' : 'Gửi feedback'}</button>
            </form>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <section className="nn-reviews">
          <div className="nn-section-head"><div className="nn-kicker">Community notes</div><h2 className="nn-section-title">Mọi người nói gì?</h2></div>
          {reviews.map((review) => (
            <article className="nn-review" key={review.id}>
              <div className="nn-review-head"><b>{review.name}</b><span className="nn-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
              {review.comment && <p className="nn-muted" style={{ marginTop: 8 }}>{review.comment}</p>}
            </article>
          ))}
        </section>
      )}
    </>
  )
}

function RegistrationStatus({ registration, pending, onReportPayment }: { registration: Registration; pending: boolean; onReportPayment: () => void }) {
  if (registration.paymentStatus === 'UNPAID') {
    return (
      <div className="nn-qr">
        <p className="nn-muted">Quét mã để chuyển khoản, giữ chỗ của bạn:</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={registration.qrUrl} alt="VietQR Nerd Night" />
        <div className="nn-qr-amount">{registration.amount.toLocaleString('vi-VN')}đ</div>
        <div className="nn-code">{registration.transferContent}</div>
        <p className="nn-muted" style={{ marginBottom: 16 }}>Giữ nguyên nội dung chuyển khoản để hệ thống tự động xác nhận vé. Chỗ được giữ trong 30 phút.</p>
        <button className="nn-button nn-button-primary nn-button-block" onClick={onReportPayment} disabled={pending}>{pending ? 'Đang gửi...' : 'Đã chuyển nhưng vé chưa cập nhật'}</button>
      </div>
    )
  }

  return (
    <div className="nn-status">
      <NerdNightMedal prof={registration.paymentStatus === 'CONFIRMED'} size={72} />
      <p className="nn-badge-name">{registration.paymentStatus === 'CONFIRMED' ? 'Vé đã xác nhận!' : 'Đang chờ xác nhận'}</p>
      <p className="nn-muted">{registration.paymentStatus === 'CONFIRMED' ? 'Hẹn gặp bạn ở Nerd Night. Bạn có thể xem vé trong trang tài khoản.' : 'Hệ thống đang tự động đối soát. Nếu giao dịch chưa cập nhật, Nerd Society sẽ kiểm tra thủ công.'}</p>
      {registration.speakerStatus === 'PENDING' && <p className="nn-message ok" style={{ textAlign: 'center' }}>Chủ đề chia sẻ của bạn đang chờ staff duyệt.</p>}
      {registration.speakerStatus === 'APPROVED' && <p className="nn-message ok" style={{ textAlign: 'center' }}>Chủ đề chia sẻ đã được duyệt.</p>}
      {registration.speakerStatus === 'REJECTED' && <p className="nn-message error" style={{ textAlign: 'center' }}>Chủ đề chia sẻ chưa được duyệt. Nerd Society sẽ hỗ trợ xóa đăng ký và hoàn Ví Nerd nếu đã nhận tiền.</p>}
    </div>
  )
}
