'use client'

import {
  completeNerdNightRefund,
  confirmNerdNightPayment,
  deleteRejectedNerdNightSpeaker,
  deleteNerdNightEvent,
  deleteNerdNightRegistration,
  resetNerdNightVotes,
  reviewNerdNightSpeaker,
  saveNerdNightEvent,
  setNerdNightEventStatus,
  setNerdNightVotingStatus,
} from '@/actions/admin-nerd-night'
import {
  BanknotesIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import NerdNightEventModal from './NerdNightEventModal'

type EventData = {
  id: string
  slug: string
  season: number
  episode: number
  themeCode: string
  title: string
  themeDescription: string | null
  startsAt: string
  locationId: string | null
  venueName: string
  venueAddress: string | null
  price: number
  capacity: number
  speakerCapacity: number
  registrationOpen: boolean
  speakerRegistrationOpen: boolean
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  votingStatus: 'CLOSED' | 'OPEN' | 'RESULTS'
  notes: string | null
}

type Registration = {
  id: string
  code: string
  name: string
  phone: string
  email: string
  status: string
  paymentStatus: string
  refundStatus: string
  amount: number
  paymentReportedAt: string | null
  paymentConfirmedAt: string | null
  paymentTransactionId: string | null
  paymentReceivedAmount: number | null
  speakerStatus: string
  wantsToShare: boolean
  topicTitle: string | null
  topicBackup1: string | null
  topicBackup2: string | null
  topicDescription: string | null
  hasSlides: boolean
  interests: string[]
  voteCount: number
}

type Location = { id: string; name: string; address: string }
type Review = { id: string; name: string; rating: number; comment: string | null }
type AdminTab = 'participants' | 'speakers' | 'feedback' | 'settings'

export default function NerdNightAdminDetail({
  event,
  registrations,
  locations,
  reviews,
  canManage,
  canConfirm,
}: {
  event: EventData
  registrations: Registration[]
  locations: Location[]
  reviews: Review[]
  canManage: boolean
  canConfirm: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('participants')
  const [query, setQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const activeRegistrations = registrations.filter((item) => item.status === 'ACTIVE')
  const confirmedRegistrations = activeRegistrations.filter((item) => item.paymentStatus === 'CONFIRMED')
  const pendingPayments = activeRegistrations.filter((item) => item.paymentStatus === 'PENDING')
  const speakerRegistrations = registrations.filter(
    (item) => item.topicTitle || item.wantsToShare || item.speakerStatus !== 'NONE',
  )
  const approvedSpeakers = speakerRegistrations.filter((item) => item.speakerStatus === 'APPROVED')
  const totalVotes = speakerRegistrations.reduce((sum, item) => sum + item.voteCount, 0)

  const filteredRegistrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return registrations.filter((registration) => {
      const matchesQuery = !normalizedQuery || [
        registration.name,
        registration.email,
        registration.phone,
        registration.code,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      const matchesPayment = paymentFilter === 'ALL' || registration.paymentStatus === paymentFilter
      return matchesQuery && matchesPayment
    })
  }, [paymentFilter, query, registrations])

  function run(
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
    afterSuccess?: () => void,
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        toast.error(result.error || 'Có lỗi xảy ra')
        return
      }
      toast.success(result.message || successMessage)
      afterSuccess?.()
      router.refresh()
    })
  }

  function save(formData: FormData) {
    const locationId = String(formData.get('locationId') || '')
    startTransition(async () => {
      const result = await saveNerdNightEvent({
        id: event.id,
        season: Number(formData.get('season')),
        episode: Number(formData.get('episode')),
        themeCode: String(formData.get('themeCode')),
        title: String(formData.get('title')),
        themeDescription: String(formData.get('themeDescription') || ''),
        startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
        locationId: locationId || null,
        venueName: String(formData.get('venueName')),
        venueAddress: String(formData.get('venueAddress') || ''),
        price: Number(formData.get('price')),
        capacity: Number(formData.get('capacity')),
        speakerCapacity: Number(formData.get('speakerCapacity')),
        registrationOpen: formData.get('registrationOpen') === 'on',
        speakerRegistrationOpen: formData.get('speakerRegistrationOpen') === 'on',
        notes: String(formData.get('notes') || ''),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Đã cập nhật sự kiện')
      setEditing(false)
      router.refresh()
    })
  }

  function removeEvent() {
    if (!window.confirm(`Xóa vĩnh viễn “${event.title}” và toàn bộ dữ liệu chưa thanh toán?`)) return
    startTransition(async () => {
      const result = await deleteNerdNightEvent(event.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Đã xóa đêm Nerd Night')
      router.push('/admin/nerd-night')
      router.refresh()
    })
  }

  function removeRegistration(registration: Registration) {
    if (!window.confirm(`Xóa slot của ${registration.name} (${registration.code})?`)) return
    run(() => deleteNerdNightRegistration(registration.id), 'Đã xóa slot đăng ký')
  }

  function deleteRejectedSpeaker(registration: Registration) {
    const refundAmount = registration.paymentReceivedAmount || registration.amount
    const willRefund = ['PENDING', 'CONFIRMED'].includes(registration.paymentStatus) && registration.refundStatus !== 'COMPLETED'
    const refundMessage = willRefund
      ? `, xác nhận đã nhận ${formatCurrency(refundAmount)} và hoàn số tiền này vào Ví Nerd`
      : ''
    if (!window.confirm(`Xóa toàn bộ đăng ký Speaker của ${registration.name}${refundMessage}? Người này có thể đăng ký lại sau đó.`)) return
    run(() => deleteRejectedNerdNightSpeaker(registration.id), 'Đã xóa đăng ký Speaker')
  }

  function undoPayment(registration: Registration) {
    const reason = window.prompt('Nhập lý do bỏ xác nhận thanh toán:')
    if (reason) {
      run(
        () => confirmNerdNightPayment(registration.id, false, reason),
        'Đã bỏ xác nhận thanh toán',
      )
    }
  }

  function resetVotes() {
    if (!window.confirm(`Xóa toàn bộ ${totalVotes} lượt vote của đêm này để mọi người có thể vote lại?`)) return
    run(() => resetNerdNightVotes(event.id), 'Đã reset toàn bộ lượt vote')
  }

  const tabs: Array<{ id: AdminTab; label: string; count?: number }> = [
    { id: 'participants', label: 'Người tham dự', count: registrations.length },
    { id: 'speakers', label: 'Speaker & Vote', count: speakerRegistrations.length },
    { id: 'feedback', label: 'Feedback', count: reviews.length },
    { id: 'settings', label: 'Cài đặt' },
  ]

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
        <Link href="/admin/nerd-night" className="text-sm font-medium text-neutral-500 hover:text-primary-600">
          ← Danh sách Nerd Night
        </Link>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge status={event.status} />
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                S{event.season}E{String(event.episode).padStart(2, '0')} · {event.themeCode}
              </span>
              <VotingStatusBadge status={event.votingStatus} />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">{event.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
              <span>{formatDate(event.startsAt)}</span>
              <span>{event.venueName}</span>
              <span>{formatCurrency(event.price)} / người</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/nerd-night/${event.slug}`} target="_blank" className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">
              Xem trang public ↗
            </Link>
            {canManage && (
              <>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
                  <PencilSquareIcon className="size-4" /> Chỉnh sửa
                </button>
                <button type="button" onClick={removeEvent} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30">
                  <TrashIcon className="size-4" /> Xóa
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UserGroupIcon} label="Đang giữ chỗ" value={`${activeRegistrations.length}/${event.capacity}`} note={`${Math.max(0, event.capacity - activeRegistrations.length)} chỗ còn lại`} onClick={() => setTab('participants')} />
        <MetricCard icon={CheckCircleIcon} label="Vé đã xác nhận" value={confirmedRegistrations.length} note={pendingPayments.length ? `${pendingPayments.length} giao dịch chờ` : 'Không có giao dịch chờ'} tone={pendingPayments.length ? 'amber' : 'green'} onClick={() => setTab('participants')} />
        <MetricCard icon={MicrophoneIcon} label="Speaker đã duyệt" value={`${approvedSpeakers.length}/${event.speakerCapacity}`} note={`${totalVotes} lượt vote`} onClick={() => setTab('speakers')} />
        <MetricCard icon={ChatBubbleBottomCenterTextIcon} label="Feedback" value={reviews.length} note={event.status === 'COMPLETED' ? 'Đang nhận phản hồi' : 'Mở sau khi kết thúc'} onClick={() => setTab('feedback')} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white px-2 dark:border-neutral-800 dark:bg-neutral-900">
        <nav className="flex min-w-max gap-1" aria-label="Quản trị Nerd Night">
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative px-4 py-4 text-sm font-medium transition-colors ${tab === item.id ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}>
              {item.label}
              {typeof item.count === 'number' && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{item.count}</span>}
              {tab === item.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary-600" />}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'participants' && (
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-white">Danh sách người tham dự</h2>
              <p className="mt-1 text-sm text-neutral-500">Theo dõi giữ chỗ, thanh toán và trạng thái từng vé.</p>
            </div>
            <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto lg:grid-cols-[18rem_auto]">
              <label className="relative block min-w-0">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, email, SĐT, mã vé..." className="w-full rounded-xl border-neutral-300 py-2.5 pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full shrink-0 rounded-xl border-neutral-300 bg-transparent py-2.5 pl-3 pr-10 text-sm sm:w-auto dark:border-neutral-700">
                <option value="ALL">Tất cả thanh toán</option>
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="PENDING">Chờ xác nhận</option>
                <option value="CONFIRMED">Đã xác nhận</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="px-5 py-3">Người tham dự</th>
                  <th className="px-5 py-3">Loại vé</th>
                  <th className="px-5 py-3">Thanh toán</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredRegistrations.map((registration) => (
                  <tr key={registration.id} className={registration.status !== 'ACTIVE' ? 'bg-neutral-50/70 text-neutral-500 dark:bg-neutral-950/40' : ''}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-neutral-900 dark:text-white">{registration.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">{registration.phone} · {registration.email}</div>
                      <div className="mt-1 font-mono text-[11px] text-neutral-400">{registration.code}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-neutral-700 dark:text-neutral-200">{registration.topicTitle ? 'Speaker' : 'Người nghe'}</div>
                      {registration.topicTitle && <SpeakerStatusBadge status={registration.speakerStatus} />}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={registration.paymentStatus} />
                      {registration.paymentTransactionId && <div className="mt-1 max-w-40 truncate font-mono text-[10px] text-neutral-400" title={registration.paymentTransactionId}>VietQR · {registration.paymentTransactionId}</div>}
                      {registration.refundStatus === 'PENDING' && <div className="mt-1 text-xs font-semibold text-red-600">Cần hoàn tiền</div>}
                    </td>
                    <td className="px-5 py-4"><RegistrationStatusBadge status={registration.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-36 flex-col items-end gap-1.5">
                        {canConfirm && registration.paymentStatus === 'PENDING' && <ActionButton onClick={() => run(() => confirmNerdNightPayment(registration.id, true), 'Đã xác nhận thanh toán')} tone="green">Xác nhận tiền</ActionButton>}
                        {canConfirm && registration.paymentStatus === 'CONFIRMED' && <ActionButton onClick={() => undoPayment(registration)} tone="amber">Bỏ xác nhận</ActionButton>}
                        {canConfirm && registration.refundStatus === 'PENDING' && <ActionButton onClick={() => run(() => completeNerdNightRefund(registration.id), 'Đã ghi nhận hoàn tiền')} tone="purple">Đã hoàn tiền</ActionButton>}
                        {canManage && registration.speakerStatus === 'REJECTED' && (!['PENDING', 'CONFIRMED'].includes(registration.paymentStatus) || registration.refundStatus === 'COMPLETED' || canConfirm) && <ActionButton onClick={() => deleteRejectedSpeaker(registration)} tone="red">{['PENDING', 'CONFIRMED'].includes(registration.paymentStatus) && registration.refundStatus !== 'COMPLETED' ? 'Xóa & hoàn Ví Nerd' : 'Xóa đăng ký'}</ActionButton>}
                        {canManage && registration.speakerStatus !== 'REJECTED' && registration.paymentStatus === 'UNPAID' && registration.refundStatus !== 'PENDING' && <ActionButton onClick={() => removeRegistration(registration)} tone="red">Xóa slot</ActionButton>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRegistrations.length === 0 && <EmptyState title="Không tìm thấy người tham dự" description="Thử đổi từ khóa hoặc bộ lọc thanh toán." />}
        </section>
      )}

      {tab === 'speakers' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2"><MicrophoneIcon className="size-5 text-primary-600" /><h2 className="font-semibold text-neutral-900 dark:text-white">Điều khiển bình chọn</h2></div>
                <p className="mt-1 text-sm text-neutral-500">{confirmedRegistrations.length} người đủ điều kiện vote · {totalVotes} lượt đã ghi nhận.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-neutral-500">Trạng thái vote</label>
                <select value={event.votingStatus} onChange={(e) => run(() => setNerdNightVotingStatus(event.id, e.target.value as EventData['votingStatus']), 'Đã cập nhật trạng thái vote')} disabled={!canManage || pending} className="rounded-xl border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700">
                  <option value="CLOSED">Đóng vote</option>
                  <option value="OPEN">Mở vote</option>
                  <option value="RESULTS">Công bố kết quả</option>
                </select>
                {canManage && totalVotes > 0 && <button type="button" onClick={resetVotes} disabled={pending} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30">Reset {totalVotes} vote</button>}
              </div>
            </div>
          </section>

          {speakerRegistrations.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {[...speakerRegistrations].sort((a, b) => b.voteCount - a.voteCount).map((speaker, index) => (
                <article key={speaker.id} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpeakerStatusBadge status={speaker.speakerStatus} />
                        {event.votingStatus === 'RESULTS' && index === 0 && speaker.voteCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Dẫn đầu</span>}
                      </div>
                      <h3 className="mt-3 font-semibold text-neutral-900 dark:text-white">{speaker.name}</h3>
                      <p className="mt-1 text-lg font-medium text-primary-700 dark:text-primary-400">{speaker.topicTitle || 'Chưa nhập chủ đề'}</p>
                    </div>
                    <div className="rounded-xl bg-primary-50 px-4 py-3 text-center dark:bg-primary-950/30">
                      <div className="text-2xl font-bold text-primary-700 dark:text-primary-400">{speaker.voteCount}</div>
                      <div className="text-xs text-primary-600">vote</div>
                    </div>
                  </div>
                  {speaker.topicDescription && <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{speaker.topicDescription}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">{speaker.hasSlides ? 'Có slide' : 'Không slide'}</span>
                    {speaker.interests.map((interest) => <span key={interest} className="rounded-full bg-neutral-100 px-2.5 py-1 dark:bg-neutral-800">{interest}</span>)}
                  </div>
                  {(speaker.topicBackup1 || speaker.topicBackup2) && <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-950"><b>Chủ đề dự bị:</b> {[speaker.topicBackup1, speaker.topicBackup2].filter(Boolean).join(' · ')}</div>}
                  {canManage && speaker.speakerStatus === 'PENDING' && (
                    <div className="mt-5 flex gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                      <button type="button" onClick={() => run(() => reviewNerdNightSpeaker(speaker.id, 'APPROVED'), 'Đã duyệt speaker')} disabled={pending} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Duyệt speaker</button>
                      <button type="button" onClick={() => run(() => reviewNerdNightSpeaker(speaker.id, 'REJECTED'), 'Đã từ chối speaker')} disabled={pending} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Từ chối</button>
                    </div>
                  )}
                  {canManage && speaker.speakerStatus === 'REJECTED' && (
                    <div className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                      {['PENDING', 'CONFIRMED'].includes(speaker.paymentStatus) && speaker.refundStatus !== 'COMPLETED' && !canConfirm ? (
                        <p className="text-sm text-amber-600">Bạn cần quyền xác nhận thanh toán để hoàn tiền vào Ví Nerd.</p>
                      ) : (
                        <button type="button" onClick={() => deleteRejectedSpeaker(speaker)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30">
                          <TrashIcon className="size-4" /> {['PENDING', 'CONFIRMED'].includes(speaker.paymentStatus) && speaker.refundStatus !== 'COMPLETED' ? 'Xóa & hoàn Ví Nerd' : 'Xóa đăng ký'}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : <EmptyState title="Chưa có đăng ký speaker" description="Các chủ đề gửi lên sẽ xuất hiện tại đây để duyệt và theo dõi vote." />}
        </div>
      )}

      {tab === 'feedback' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold text-neutral-900 dark:text-white">Feedback sau sự kiện</h2><p className="mt-1 text-sm text-neutral-500">Phản hồi từ người có vé đã xác nhận.</p></div>
            {reviews.length > 0 && <div className="text-right"><div className="text-2xl font-bold text-amber-500">{(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)}</div><div className="text-xs text-neutral-500">điểm trung bình</div></div>}
          </div>
          {reviews.length > 0 ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"><div className="flex items-center justify-between"><b className="text-neutral-900 dark:text-white">{review.name}</b><span className="text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.comment ? <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{review.comment}</p> : <p className="mt-3 text-sm italic text-neutral-400">Không để lại nhận xét.</p>}</article>)}</div> : <EmptyState title="Chưa có feedback" description="Feedback sẽ mở cho người tham dự sau khi đêm được đánh dấu đã diễn ra." />}
        </section>
      )}

      {tab === 'settings' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-neutral-100 p-2.5 dark:bg-neutral-800"><Cog6ToothIcon className="size-5" /></div><div><h2 className="font-semibold text-neutral-900 dark:text-white">Vận hành sự kiện</h2><p className="mt-1 text-sm text-neutral-500">Thay đổi trạng thái sẽ đóng/mở các chức năng tương ứng trên trang public.</p></div></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><span className="block text-sm font-medium text-neutral-900 dark:text-white">Trạng thái đêm</span><span className="mt-1 block text-xs text-neutral-500">Công khai để khách xem và đăng ký; hoàn thành để mở feedback.</span><select value={event.status} onChange={(e) => run(() => setNerdNightEventStatus(event.id, e.target.value as EventData['status']), 'Đã đổi trạng thái sự kiện')} disabled={!canManage || pending} className="mt-3 w-full rounded-xl border-neutral-300 bg-transparent text-sm dark:border-neutral-700"><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Công khai</option><option value="COMPLETED">Đã diễn ra</option><option value="CANCELLED">Đã hủy</option></select></label>
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><span className="block text-sm font-medium text-neutral-900 dark:text-white">Trạng thái đăng ký</span><div className="mt-3 flex flex-wrap gap-2"><BooleanBadge active={event.registrationOpen} label="Đăng ký tham dự" /><BooleanBadge active={event.speakerRegistrationOpen} label="Đăng ký speaker" /></div><button type="button" onClick={() => setEditing(true)} disabled={!canManage} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-600 disabled:opacity-50"><PencilSquareIcon className="size-4" /> Chỉnh trong thông tin sự kiện</button></div>
            </div>
            {event.notes && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><b>Ghi chú nội bộ:</b> {event.notes}</div>}
          </section>
        </div>
      )}

      {editing && <NerdNightEventModal mode="edit" initial={event} locations={locations} pending={pending} onClose={() => setEditing(false)} onSubmit={save} />}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, note, tone = 'neutral', onClick }: { icon: typeof UserGroupIcon; label: string; value: string | number; note: string; tone?: 'neutral' | 'green' | 'amber'; onClick: () => void }) {
  const toneClass = tone === 'green' ? 'text-green-600 bg-green-50 dark:bg-green-950/30' : tone === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' : 'text-primary-600 bg-primary-50 dark:bg-primary-950/30'
  return <button type="button" onClick={onClick} className="group rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-start justify-between"><div><div className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</div><div className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</div></div><div className={`rounded-xl p-2.5 ${toneClass}`}><Icon className="size-5" /></div></div><div className="mt-3 text-xs text-neutral-500">{note}</div></button>
}

function ActionButton({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: 'green' | 'amber' | 'purple' | 'red' }) {
  const classes = { green: 'text-green-700 hover:bg-green-50 dark:text-green-400', amber: 'text-amber-700 hover:bg-amber-50 dark:text-amber-400', purple: 'text-purple-700 hover:bg-purple-50 dark:text-purple-400', red: 'text-red-700 hover:bg-red-50 dark:text-red-400' }[tone]
  return <button type="button" onClick={onClick} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${classes}`}>{children}</button>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900"><p className="font-medium text-neutral-900 dark:text-white">{title}</p><p className="mt-1 text-sm text-neutral-500">{description}</p></div>
}

function EventStatusBadge({ status }: { status: EventData['status'] }) {
  const config = { DRAFT: ['Bản nháp', 'bg-neutral-100 text-neutral-600'], PUBLISHED: ['Công khai', 'bg-green-100 text-green-700'], COMPLETED: ['Đã diễn ra', 'bg-purple-100 text-purple-700'], CANCELLED: ['Đã hủy', 'bg-red-100 text-red-700'] }[status]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config[1]}`}>{config[0]}</span>
}

function VotingStatusBadge({ status }: { status: EventData['votingStatus'] }) {
  const config = { CLOSED: ['Vote đang đóng', 'bg-neutral-100 text-neutral-600'], OPEN: ['Đang mở vote', 'bg-blue-100 text-blue-700'], RESULTS: ['Đã công bố vote', 'bg-amber-100 text-amber-700'] }[status]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config[1]}`}>{config[0]}</span>
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, [string, string]> = { UNPAID: ['Chưa thanh toán', 'bg-amber-100 text-amber-700'], PENDING: ['Chờ xác nhận', 'bg-blue-100 text-blue-700'], CONFIRMED: ['Đã xác nhận', 'bg-green-100 text-green-700'] }
  const [label, classes] = config[status] || [status, 'bg-neutral-100 text-neutral-600']
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

function RegistrationStatusBadge({ status }: { status: string }) {
  const config: Record<string, [string, string]> = { ACTIVE: ['Đang hiệu lực', 'bg-green-50 text-green-700'], EXPIRED: ['Hết hạn', 'bg-neutral-100 text-neutral-600'], CANCELLED: ['Đã hủy', 'bg-red-100 text-red-700'] }
  const [label, classes] = config[status] || [status, 'bg-neutral-100 text-neutral-600']
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>
}

function SpeakerStatusBadge({ status }: { status: string }) {
  const config: Record<string, [string, string]> = { PENDING: ['Chờ duyệt', 'bg-amber-100 text-amber-700'], APPROVED: ['Đã duyệt', 'bg-green-100 text-green-700'], REJECTED: ['Từ chối', 'bg-red-100 text-red-700'], NONE: ['Người nghe', 'bg-neutral-100 text-neutral-600'] }
  const [label, classes] = config[status] || [status, 'bg-neutral-100 text-neutral-600']
  return <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}>{label}</span>
}

function BooleanBadge({ active, label }: { active: boolean; label: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>{label}: {active ? 'Mở' : 'Đóng'}</span>
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
