export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const BUSINESS_UTC_OFFSET_MS = 7 * 60 * 60 * 1000

export function formatBusinessDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Could not format business date')
  }

  return `${year}-${month}-${day}`
}

export function dateOnlyFromYmd(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function businessDateOnly(date: Date = new Date()): Date {
  return dateOnlyFromYmd(formatBusinessDate(date))
}

export function localStartOfDay(date: Date = new Date()): Date {
  return new Date(businessDateOnly(date).getTime() - BUSINESS_UTC_OFFSET_MS)
}

export function localDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime())
}

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const trimmed = value.trim()

  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    }
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    return {
      year: Number(match[3]),
      month: Number(match[2]),
      day: Number(match[1]),
    }
  }

  return null
}

function parseTimeParts(value: string): { hour: number; minute: number; second: number } | null {
  const match = value.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] || '0'),
  }
}

export function parseAttendanceDateTime(value: Date | string): Date {
  if (value instanceof Date) return value

  const trimmed = value.trim()
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  if (hasExplicitZone) return new Date(trimmed)

  let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const [, year, month, day, hour, minute, second = '0'] = match
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), 0)
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T])(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const [, day, month, year, hour, minute, second = '0'] = match
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), 0)
  }

  return new Date(trimmed)
}

export function parseAttendanceRecordDateTime(record: {
  AttDate?: Date | string | null
  AttTime: Date | string
}): Date {
  if (record.AttTime instanceof Date) return record.AttTime

  const attTime = record.AttTime.trim()
  const parsedAttTime = parseAttendanceDateTime(attTime)
  const attTimeHasDate = Boolean(parseDateParts(attTime))

  if (attTimeHasDate && isValidDate(parsedAttTime)) {
    return parsedAttTime
  }

  if (!record.AttDate) {
    return parsedAttTime
  }

  const attDate =
    record.AttDate instanceof Date
      ? {
          year: record.AttDate.getFullYear(),
          month: record.AttDate.getMonth() + 1,
          day: record.AttDate.getDate(),
        }
      : parseDateParts(record.AttDate)
  const time = parseTimeParts(attTime)

  if (!attDate || !time) {
    return parsedAttTime
  }

  return new Date(attDate.year, attDate.month - 1, attDate.day, time.hour, time.minute, time.second, 0)
}

export function splitMinutesByLocalDay(start: Date, end: Date, totalMinutes: number) {
  if (totalMinutes <= 0) return []

  if (end <= start) {
    return [{ usageDate: businessDateOnly(start), minutes: totalMinutes }]
  }

  // Session lengths are stored in whole minutes. Assign each minute using the
  // configured business timezone so deployment server timezone cannot change
  // the day boundary (notably when the server runs in UTC).
  const minuteCountByDate = new Map<string, number>()
  for (let minute = 0; minute < totalMinutes; minute += 1) {
    const instant = new Date(start.getTime() + minute * 60_000)
    const key = formatBusinessDate(instant)
    minuteCountByDate.set(key, (minuteCountByDate.get(key) || 0) + 1)
  }

  return Array.from(minuteCountByDate, ([key, minutes]) => ({
    usageDate: dateOnlyFromYmd(key),
    minutes,
  }))
}
