'use client'

import {
  NERD_NIGHT_DEFAULT_THEORY_EXAMPLES,
  NERD_NIGHT_DEFAULT_TOPIC_PROMPT,
  NERD_NIGHT_SEASON_ORDER,
} from '@/lib/nerd-night/constants'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

export type NerdNightEventFormData = {
  season: number
  episode: number
  themeCode: string
  title: string
  themeDescription: string | null
  topicPrompt: string | null
  topicSuggestions: string[]
  startsAt: string
  locationId: string | null
  venueName: string
  venueAddress: string | null
  price: number
  capacity: number
  speakerCapacity: number
  registrationOpen: boolean
  speakerRegistrationOpen: boolean
  notes: string | null
}

type LocationItem = { id: string; name: string; address: string }

function toLocalInput(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function NerdNightEventModal({
  mode,
  initial,
  locations,
  pending,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initial?: NerdNightEventFormData
  locations: LocationItem[]
  pending: boolean
  onClose: () => void
  onSubmit: (formData: FormData) => void
}) {
  const [locationId, setLocationId] = useState(initial?.locationId || '')
  const [venueName, setVenueName] = useState(initial?.venueName || '')
  const [venueAddress, setVenueAddress] = useState(initial?.venueAddress || '')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, pending])

  function selectLocation(id: string) {
    setLocationId(id)
    const location = locations.find((item) => item.id === id)
    if (location) {
      setVenueName(location.name)
      setVenueAddress(location.address)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nerd-night-event-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900 sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:px-6">
          <div>
            <h2 id="nerd-night-event-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
              {mode === 'create' ? 'Thêm sự kiện Nerd Night' : 'Sửa sự kiện Nerd Night'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {mode === 'create' ? 'Tạo một đêm mới ở trạng thái bản nháp.' : 'Cập nhật thông tin đang hiển thị của sự kiện.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label="Đóng modal"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-neutral-50/60 px-5 py-5 dark:bg-neutral-950/40 sm:px-6">
            <FormSection title="Thông tin cơ bản" description="Định danh đêm trong season và tiêu đề hiển thị trên trang public.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Season">
                  <input name="season" type="number" min="1" defaultValue={initial?.season || 1} required autoFocus />
                </Field>
                <Field label="Số đêm">
                  <input name="episode" type="number" min="1" defaultValue={initial?.episode} required />
                </Field>
                <Field label="Chủ đề">
                  <select name="themeCode" defaultValue={initial?.themeCode || NERD_NIGHT_SEASON_ORDER[0]} required>
                    {NERD_NIGHT_SEASON_ORDER.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label={mode === 'create' ? 'Tiêu đề (có thể để trống)' : 'Tiêu đề'}>
                  <input name="title" defaultValue={initial?.title || ''} placeholder="Đêm 01 — Theory" required={mode === 'edit'} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Thời gian & địa điểm">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Thời gian bắt đầu">
                  <input name="startsAt" type="datetime-local" defaultValue={toLocalInput(initial?.startsAt)} required />
                </Field>
                <Field label="Cơ sở">
                  <select name="locationId" value={locationId} onChange={(event) => selectLocation(event.target.value)}>
                    <option value="">Địa điểm khác</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </Field>
                <Field label="Tên địa điểm">
                  <input name="venueName" value={venueName} onChange={(event) => setVenueName(event.target.value)} placeholder="Nerd Society, Hồ Tùng Mậu" required />
                </Field>
                <Field label="Địa chỉ">
                  <input name="venueAddress" value={venueAddress} onChange={(event) => setVenueAddress(event.target.value)} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Vé & sức chứa" description="Số chỗ người nghe được tính bằng sức chứa trừ số slot speaker.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Giá vé">
                  <input name="price" type="number" min="0" step="1000" defaultValue={initial?.price ?? 120000} required />
                </Field>
                <Field label="Sức chứa">
                  <input name="capacity" type="number" min="1" defaultValue={initial?.capacity ?? 15} required />
                </Field>
                <Field label="Slot speaker">
                  <input name="speakerCapacity" type="number" min="0" defaultValue={initial?.speakerCapacity ?? 6} required />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Nội dung hiển thị" description="Nội dung giới thiệu theme và khung gợi ý trên trang chi tiết sự kiện.">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Mô tả theme">
                  <textarea name="themeDescription" defaultValue={initial?.themeDescription || ''} rows={4} />
                </Field>
                <Field label="Dòng mở đầu khung gợi ý">
                  <textarea name="topicPrompt" defaultValue={initial?.topicPrompt || NERD_NIGHT_DEFAULT_TOPIC_PROMPT} rows={4} maxLength={240} />
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Các chủ đề gợi ý (mỗi dòng một chủ đề)">
                    <textarea
                      name="topicSuggestions"
                      defaultValue={(initial ? initial.topicSuggestions : NERD_NIGHT_DEFAULT_THEORY_EXAMPLES).join('\n')}
                      rows={7}
                      placeholder="Nhập tối đa 12 chủ đề, mỗi chủ đề trên một dòng"
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title="Trạng thái đăng ký">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 transition hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  <input className="mt-0.5" name="registrationOpen" type="checkbox" defaultChecked={initial?.registrationOpen ?? true} />
                  <span><b className="block font-semibold text-neutral-900 dark:text-white">Đăng ký tham dự</b><span className="mt-1 block text-xs text-neutral-500">Cho phép người nghe giữ chỗ khi sự kiện công khai.</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 transition hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  <input className="mt-0.5" name="speakerRegistrationOpen" type="checkbox" defaultChecked={initial?.speakerRegistrationOpen ?? true} />
                  <span><b className="block font-semibold text-neutral-900 dark:text-white">Đăng ký speaker</b><span className="mt-1 block text-xs text-neutral-500">Cho phép gửi chủ đề chia sẻ nếu vẫn còn slot speaker.</span></span>
                </label>
              </div>
            </FormSection>

            <FormSection title="Ghi chú nội bộ" description="Chỉ staff thấy nội dung này.">
              <Field label="Ghi chú">
                <textarea name="notes" defaultValue={initial?.notes || ''} rows={3} />
              </Field>
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={pending} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700">
              Huỷ
            </button>
            <button disabled={pending} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {pending ? 'Đang lưu...' : mode === 'create' ? 'Tạo bản nháp' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      <span className="mt-1 block [&>input]:w-full [&>input]:rounded-lg [&>input]:border-neutral-300 [&>input]:bg-transparent [&>select]:w-full [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-transparent [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border-neutral-300 [&>textarea]:bg-transparent dark:[&>input]:border-neutral-700 dark:[&>select]:border-neutral-700 dark:[&>textarea]:border-neutral-700">
        {children}
      </span>
    </label>
  )
}
