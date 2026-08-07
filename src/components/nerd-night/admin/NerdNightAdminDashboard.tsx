'use client'

import { saveNerdNightEvent, setNerdNightEventStatus } from '@/actions/admin-nerd-night'
import { NERD_NIGHT_SEASON_ORDER } from '@/lib/nerd-night/constants'
import { CalendarDaysIcon, Cog6ToothIcon, MoonIcon, PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'

type EventItem = {
  id: string
  slug: string
  season: number
  episode: number
  themeCode: string
  title: string
  startsAt: string
  venueName: string
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  registrationOpen: boolean
  capacity: number
  activeCount: number
  pendingPayments: number
  pendingSpeakers: number
}

type LocationItem = { id: string; name: string; address: string }

export default function NerdNightAdminDashboard({
  events,
  locations,
  canManage,
  isAdmin,
}: {
  events: EventItem[]
  locations: LocationItem[]
  canManage: boolean
  isAdmin: boolean
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    const startsAt = String(formData.get('startsAt') || '')
    startTransition(async () => {
      const locationId = String(formData.get('locationId') || '')
      const selectedLocation = locations.find((location) => location.id === locationId)
      const result = await saveNerdNightEvent({
        season: Number(formData.get('season')),
        episode: Number(formData.get('episode')),
        themeCode: String(formData.get('themeCode')),
        title: String(formData.get('title') || ''),
        themeDescription: String(formData.get('themeDescription') || ''),
        startsAt: new Date(startsAt).toISOString(),
        locationId: locationId || null,
        venueName: String(formData.get('venueName') || selectedLocation?.name || ''),
        venueAddress: String(formData.get('venueAddress') || selectedLocation?.address || ''),
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
      toast.success('Đã tạo đêm Nerd Night')
      setShowForm(false)
      router.refresh()
    })
  }

  function changeStatus(eventId: string, status: EventItem['status']) {
    startTransition(async () => {
      const result = await setNerdNightEventStatus(eventId, status)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Đã cập nhật trạng thái')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Nerd Night</h1>
          <p className="mt-1 text-neutral-500 dark:text-neutral-400">Quản lý season, người tham dự, speaker, vote và thanh toán.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <Link href="/admin/nerd-night/settings" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"><Cog6ToothIcon className="size-5" />VietQR</Link>}
          {canManage && <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><PlusIcon className="size-5" />Tạo đêm mới</button>}
        </div>
      </div>

      {showForm && (
        <form action={submit} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
          <AdminField label="Season"><input name="season" type="number" min="1" defaultValue="1" required /></AdminField>
          <AdminField label="Số đêm"><input name="episode" type="number" min="1" required /></AdminField>
          <AdminField label="Chủ đề"><select name="themeCode" required>{NERD_NIGHT_SEASON_ORDER.map((item) => <option key={item}>{item}</option>)}</select></AdminField>
          <AdminField label="Tiêu đề (để trống để tự sinh)"><input name="title" placeholder="Đêm 01 — Theory" /></AdminField>
          <AdminField label="Thời gian"><input name="startsAt" type="datetime-local" required /></AdminField>
          <AdminField label="Cơ sở"><select name="locationId" defaultValue=""><option value="">Địa điểm khác</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></AdminField>
          <AdminField label="Tên địa điểm"><input name="venueName" placeholder="Nerd Society, Hồ Tùng Mậu" required /></AdminField>
          <AdminField label="Địa chỉ"><input name="venueAddress" /></AdminField>
          <AdminField label="Giá vé"><input name="price" type="number" min="0" step="1000" defaultValue="120000" required /></AdminField>
          <AdminField label="Sức chứa"><input name="capacity" type="number" min="1" defaultValue="15" required /></AdminField>
          <AdminField label="Số suất chia sẻ"><input name="speakerCapacity" type="number" min="0" defaultValue="6" required /></AdminField>
          <AdminField label="Mô tả theme"><textarea name="themeDescription" rows={3} /></AdminField>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"><input name="registrationOpen" type="checkbox" defaultChecked />Mở đăng ký khi công khai</label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"><input name="speakerRegistrationOpen" type="checkbox" defaultChecked />Mở đăng ký speaker</label>
          <div className="sm:col-span-2"><AdminField label="Ghi chú nội bộ"><textarea name="notes" rows={3} /></AdminField></div>
          <div className="flex gap-3 sm:col-span-2">
            <button disabled={pending} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Đang lưu...' : 'Tạo bản nháp'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700">Huỷ</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">S{event.season}E{String(event.episode).padStart(2, '0')}</span>
                  <StatusBadge status={event.status} />
                </div>
                <h2 className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">{event.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500"><CalendarDaysIcon className="size-4" />{new Date(event.startsAt).toLocaleString('vi-VN')}</p>
              </div>
              <MoonIcon className="size-8 text-primary-500" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Giữ chỗ" value={`${event.activeCount}/${event.capacity}`} />
              <Stat label="Chờ tiền" value={event.pendingPayments} warning={event.pendingPayments > 0} />
              <Stat label="Duyệt topic" value={event.pendingSpeakers} warning={event.pendingSpeakers > 0} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <Link href={`/admin/nerd-night/${event.id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Quản lý chi tiết →</Link>
              {canManage && event.status === 'DRAFT' && <button disabled={pending} onClick={() => changeStatus(event.id, 'PUBLISHED')} className="ml-auto text-sm font-medium text-green-600">Công khai</button>}
              {canManage && event.status === 'PUBLISHED' && <button disabled={pending} onClick={() => changeStatus(event.id, 'COMPLETED')} className="ml-auto text-sm font-medium text-purple-600">Đánh dấu đã diễn ra</button>}
              {canManage && event.status === 'COMPLETED' && <button disabled={pending} onClick={() => changeStatus(event.id, 'PUBLISHED')} className="ml-auto text-sm font-medium text-amber-600">Mở lại</button>}
            </div>
          </article>
        ))}
      </div>
      {!events.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-neutral-700">Chưa có đêm Nerd Night nào.</div>}
    </div>
  )
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}<span className="mt-1 block [&>input]:w-full [&>input]:rounded-lg [&>input]:border-neutral-300 [&>input]:bg-transparent [&>select]:w-full [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-transparent [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border-neutral-300 [&>textarea]:bg-transparent dark:[&>input]:border-neutral-700 dark:[&>select]:border-neutral-700 dark:[&>textarea]:border-neutral-700">{children}</span></label>
}
function Stat({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) { return <div className={`rounded-xl p-3 ${warning ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20' : 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}><div className="text-lg font-bold">{value}</div><div className="text-xs opacity-70">{label}</div></div> }
function StatusBadge({ status }: { status: EventItem['status'] }) { const style = { DRAFT: 'bg-neutral-100 text-neutral-600', PUBLISHED: 'bg-green-100 text-green-700', COMPLETED: 'bg-purple-100 text-purple-700', CANCELLED: 'bg-red-100 text-red-700' }[status]; const label = { DRAFT: 'Bản nháp', PUBLISHED: 'Công khai', COMPLETED: 'Đã diễn ra', CANCELLED: 'Đã huỷ' }[status]; return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span> }
