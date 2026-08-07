'use client'

import {
  completeNerdNightRefund,
  confirmNerdNightPayment,
  reviewNerdNightSpeaker,
  saveNerdNightEvent,
  setNerdNightEventStatus,
  setNerdNightVotingStatus,
} from '@/actions/admin-nerd-night'
import { NERD_NIGHT_SEASON_ORDER } from '@/lib/nerd-night/constants'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'

type EventData = {
  id: string; slug: string; season: number; episode: number; themeCode: string; title: string
  themeDescription: string | null; startsAt: string; locationId: string | null; venueName: string
  venueAddress: string | null; price: number; capacity: number; speakerCapacity: number
  registrationOpen: boolean; speakerRegistrationOpen: boolean; status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  votingStatus: 'CLOSED' | 'OPEN' | 'RESULTS'; notes: string | null
}
type Registration = {
  id: string; code: string; name: string; phone: string; email: string; status: string
  paymentStatus: string; refundStatus: string; amount: number; paymentReportedAt: string | null
  speakerStatus: string; wantsToShare: boolean; topicTitle: string | null; topicBackup1: string | null
  topicBackup2: string | null; topicDescription: string | null; hasSlides: boolean; interests: string[]; voteCount: number
}
type Location = { id: string; name: string; address: string }
type Review = { id: string; name: string; rating: number; comment: string | null }

function toLocalInput(iso: string) {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function NerdNightAdminDetail({ event, registrations, locations, reviews, canManage, canConfirm }: {
  event: EventData; registrations: Registration[]; locations: Location[]; reviews: Review[]; canManage: boolean; canConfirm: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        toast.error(result.error || 'Có lỗi xảy ra')
        return
      }
      toast.success(successMessage)
      router.refresh()
    })
  }

  function save(formData: FormData) {
    const locationId = String(formData.get('locationId') || '')
    run(() => saveNerdNightEvent({
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
    }), 'Đã cập nhật sự kiện')
    setEditing(false)
  }

  const active = registrations.filter((item) => item.status === 'ACTIVE')
  const speakers = active.filter((item) => item.speakerStatus === 'APPROVED')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><Link href="/admin/nerd-night" className="text-sm text-neutral-500 hover:text-primary-600">← Nerd Night</Link><h1 className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{event.title}</h1><p className="mt-1 text-neutral-500">S{event.season}E{String(event.episode).padStart(2, '0')} · {new Date(event.startsAt).toLocaleString('vi-VN')} · {event.venueName}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/nerd-night/${event.slug}`} target="_blank" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Xem trang public</Link>{canManage && <button onClick={() => setEditing(!editing)} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white">{editing ? 'Đóng form' : 'Sửa sự kiện'}</button>}</div>
      </div>

      {editing && <form action={save} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
        <Field label="Season"><input name="season" type="number" defaultValue={event.season} required /></Field><Field label="Số đêm"><input name="episode" type="number" defaultValue={event.episode} required /></Field>
        <Field label="Theme"><select name="themeCode" defaultValue={event.themeCode}>{NERD_NIGHT_SEASON_ORDER.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Tiêu đề"><input name="title" defaultValue={event.title} required /></Field>
        <Field label="Thời gian"><input name="startsAt" type="datetime-local" defaultValue={toLocalInput(event.startsAt)} required /></Field><Field label="Cơ sở"><select name="locationId" defaultValue={event.locationId || ''}><option value="">Địa điểm khác</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Tên địa điểm"><input name="venueName" defaultValue={event.venueName} required /></Field><Field label="Địa chỉ"><input name="venueAddress" defaultValue={event.venueAddress || ''} /></Field>
        <Field label="Giá vé"><input name="price" type="number" defaultValue={event.price} required /></Field><Field label="Sức chứa"><input name="capacity" type="number" defaultValue={event.capacity} required /></Field>
        <Field label="Số suất speaker"><input name="speakerCapacity" type="number" defaultValue={event.speakerCapacity} required /></Field><Field label="Mô tả"><textarea name="themeDescription" defaultValue={event.themeDescription || ''} rows={3} /></Field>
        <label className="flex items-center gap-2 text-sm"><input name="registrationOpen" type="checkbox" defaultChecked={event.registrationOpen} />Mở đăng ký</label><label className="flex items-center gap-2 text-sm"><input name="speakerRegistrationOpen" type="checkbox" defaultChecked={event.speakerRegistrationOpen} />Mở đăng ký speaker</label>
        <div className="sm:col-span-2"><Field label="Ghi chú"><textarea name="notes" defaultValue={event.notes || ''} rows={3} /></Field></div><button disabled={pending} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white sm:col-span-2">Lưu thay đổi</button>
      </form>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Người đang giữ chỗ" value={`${active.length}/${event.capacity}`} /><Stat label="Đã xác nhận" value={active.filter((x) => x.paymentStatus === 'CONFIRMED').length} /><Stat label="Speaker đã duyệt" value={`${speakers.length}/${event.speakerCapacity}`} /><Stat label="Feedback" value={reviews.length} /></div>

      {canManage && <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold text-neutral-900 dark:text-white">Điều khiển chương trình</h2><div className="mt-4 flex flex-wrap gap-3"><select value={event.status} onChange={(e) => run(() => setNerdNightEventStatus(event.id, e.target.value as EventData['status']), 'Đã đổi trạng thái sự kiện')} disabled={pending} className="rounded-lg border-neutral-300 bg-transparent text-sm dark:border-neutral-700"><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Công khai</option><option value="COMPLETED">Đã diễn ra</option><option value="CANCELLED">Đã huỷ</option></select><select value={event.votingStatus} onChange={(e) => run(() => setNerdNightVotingStatus(event.id, e.target.value as EventData['votingStatus']), 'Đã cập nhật vote')} disabled={pending} className="rounded-lg border-neutral-300 bg-transparent text-sm dark:border-neutral-700"><option value="CLOSED">Đóng vote</option><option value="OPEN">Mở vote</option><option value="RESULTS">Công bố kết quả</option></select></div></section>}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"><div className="border-b border-neutral-200 p-5 dark:border-neutral-800"><h2 className="font-semibold text-neutral-900 dark:text-white">Người tham dự ({registrations.length})</h2></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950"><tr><th className="px-4 py-3">Người tham dự</th><th className="px-4 py-3">Chủ đề</th><th className="px-4 py-3">Thanh toán</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">{registrations.map((registration) => <tr key={registration.id} className={registration.status !== 'ACTIVE' ? 'opacity-55' : ''}><td className="px-4 py-4"><div className="font-medium text-neutral-900 dark:text-white">{registration.name}</div><div className="text-xs text-neutral-500">{registration.phone} · {registration.email}</div><div className="mt-1 font-mono text-[11px] text-neutral-400">{registration.code}</div></td><td className="max-w-xs px-4 py-4"><div>{registration.topicTitle || 'Người nghe'}</div>{registration.topicTitle && <div className="mt-1 text-xs text-neutral-500">{registration.hasSlides ? 'Có slide' : 'Không slide'} · {registration.interests.join(', ')}</div>}<SpeakerBadge status={registration.speakerStatus} /></td><td className="px-4 py-4"><PaymentBadge status={registration.paymentStatus} />{registration.refundStatus === 'PENDING' && <div className="mt-1 text-xs font-medium text-red-600">Cần hoàn tiền</div>}</td><td className="px-4 py-4">{registration.status}</td><td className="px-4 py-4"><div className="flex justify-end gap-2">{canManage && registration.speakerStatus === 'PENDING' && <><button onClick={() => run(() => reviewNerdNightSpeaker(registration.id, 'APPROVED'), 'Đã duyệt speaker')} className="text-green-600">Duyệt topic</button><button onClick={() => run(() => reviewNerdNightSpeaker(registration.id, 'REJECTED'), 'Đã từ chối topic')} className="text-red-600">Từ chối</button></>}{canConfirm && registration.paymentStatus === 'PENDING' && <button onClick={() => run(() => confirmNerdNightPayment(registration.id, true), 'Đã xác nhận thanh toán')} className="text-primary-600">Xác nhận tiền</button>}{canConfirm && registration.paymentStatus === 'CONFIRMED' && <button onClick={() => { const reason = prompt('Lý do bỏ xác nhận?'); if (reason) run(() => confirmNerdNightPayment(registration.id, false, reason), 'Đã bỏ xác nhận') }} className="text-amber-600">Bỏ xác nhận</button>}{canConfirm && registration.refundStatus === 'PENDING' && <button onClick={() => run(() => completeNerdNightRefund(registration.id), 'Đã ghi nhận hoàn tiền')} className="text-purple-600">Đã hoàn tiền</button>}</div></td></tr>)}</tbody></table></div></section>

      {event.votingStatus === 'RESULTS' && speakers.length > 0 && <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Kết quả vote</h2><div className="mt-4 space-y-2">{[...speakers].sort((a, b) => b.voteCount - a.voteCount).map((speaker, index) => <div key={speaker.id} className="flex justify-between rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800"><span>{index === 0 ? '🏅 ' : ''}{speaker.name} — {speaker.topicTitle}</span><b>{speaker.voteCount}</b></div>)}</div></section>}

      {reviews.length > 0 && <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h2 className="font-semibold">Feedback</h2><div className="mt-4 space-y-3">{reviews.map((review) => <div key={review.id} className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800"><div className="flex justify-between"><b>{review.name}</b><span className="text-amber-500">{'★'.repeat(review.rating)}</span></div>{review.comment && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{review.comment}</p>}</div>)}</div></section>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}<span className="mt-1 block [&>input]:w-full [&>input]:rounded-lg [&>input]:border-neutral-300 [&>input]:bg-transparent [&>select]:w-full [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-transparent [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border-neutral-300 [&>textarea]:bg-transparent dark:[&>input]:border-neutral-700 dark:[&>select]:border-neutral-700 dark:[&>textarea]:border-neutral-700">{children}</span></label> }
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><div className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</div><div className="text-sm text-neutral-500">{label}</div></div> }
function PaymentBadge({ status }: { status: string }) { const cls = status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : status === 'PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{status}</span> }
function SpeakerBadge({ status }: { status: string }) { if (status === 'NONE') return null; const cls = status === 'APPROVED' ? 'text-green-600' : status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'; return <div className={`mt-1 text-xs font-medium ${cls}`}>{status}</div> }
