export type NerdNightDisplayStatus =
  | 'UPCOMING'
  | 'OPEN'
  | 'FULL'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED'

type EventStatusInput = {
  status: string
  startsAt: Date | string
  registrationOpen: boolean
  remaining: number
}

export const NERD_NIGHT_DISPLAY_STATUS_LABELS: Record<NerdNightDisplayStatus, string> = {
  UPCOMING: 'Sắp mở',
  OPEN: 'Đang mở đăng ký',
  FULL: 'Hết chỗ',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
}

export function getNerdNightDisplayStatus(
  event: EventStatusInput,
  now = new Date(),
): NerdNightDisplayStatus {
  if (event.status === 'COMPLETED') return 'COMPLETED'
  if (event.status === 'CANCELLED') return 'CANCELLED'
  if (event.status === 'PUBLISHED' && new Date(event.startsAt) <= now) return 'ONGOING'
  if (event.remaining <= 0) return 'FULL'
  if (event.registrationOpen) return 'OPEN'
  return 'UPCOMING'
}
