'use client'

import { saveNerdNightEvent, setNerdNightEventStatus } from '@/actions/admin-nerd-night'
import { CalendarDaysIcon, MoonIcon, PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import NerdNightEventModal from './NerdNightEventModal'

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
}: {
  events: EventItem[]
  locations: LocationItem[]
  canManage: boolean
}) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    const startsAt = String(formData.get('startsAt') || '')
    startTransition(async () => {
      const result = await saveNerdNightEvent({
        season: Number(formData.get('season')),
        episode: Number(formData.get('episode')),
        themeCode: String(formData.get('themeCode')),
        title: String(formData.get('title') || ''),
        themeDescription: String(formData.get('themeDescription') || ''),
        topicPrompt: String(formData.get('topicPrompt') || ''),
        topicSuggestions: String(formData.get('topicSuggestions') || '')
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
        startsAt: new Date(startsAt).toISOString(),
        locationId: String(formData.get('locationId') || '') || null,
        venueName: String(formData.get('venueName') || ''),
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
      toast.success('Đã tạo đêm Nerd Night')
      setShowCreateModal(false)
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
          {canManage && (
            <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
              <PlusIcon className="size-5" />Thêm sự kiện
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">S{event.season}E{String(event.episode).padStart(2, '0')}</span>
                  <StatusBadge status={event.status} startsAt={event.startsAt} />
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

      {showCreateModal && (
        <NerdNightEventModal
          mode="create"
          locations={locations}
          pending={pending}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submit}
        />
      )}
    </div>
  )
}

function Stat({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return <div className={`rounded-xl p-3 ${warning ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20' : 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}><div className="text-lg font-bold">{value}</div><div className="text-xs opacity-70">{label}</div></div>
}

function StatusBadge({ status, startsAt }: { status: EventItem['status']; startsAt: string }) {
  if (status === 'PUBLISHED' && new Date(startsAt) <= new Date()) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Đang diễn ra</span>
  }
  const style = { DRAFT: 'bg-neutral-100 text-neutral-600', PUBLISHED: 'bg-green-100 text-green-700', COMPLETED: 'bg-purple-100 text-purple-700', CANCELLED: 'bg-red-100 text-red-700' }[status]
  const label = { DRAFT: 'Bản nháp', PUBLISHED: 'Công khai', COMPLETED: 'Đã diễn ra', CANCELLED: 'Đã huỷ' }[status]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>
}
