const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'Asia/Ho_Chi_Minh'

export function formatBusinessDate(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    const day = parts.find(part => part.type === 'day')?.value

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
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    return start
}

export function localDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

export function parseAttendanceDateTime(value: Date | string): Date {
    if (value instanceof Date) return value

    const trimmed = value.trim()
    const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
    if (hasExplicitZone) return new Date(trimmed)

    const match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?/
    )
    if (!match) return new Date(trimmed)

    const [, year, month, day, hour, minute, second = '0'] = match
    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        0
    )
}

export function splitMinutesByLocalDay(start: Date, end: Date, totalMinutes: number) {
    if (totalMinutes <= 0) return []

    if (end <= start) {
        return [{ usageDate: localDateOnly(start), minutes: totalMinutes }]
    }

    const segments: Array<{ usageDate: Date; rawMinutes: number }> = []
    let cursor = new Date(start)

    while (cursor < end) {
        const nextMidnight = new Date(cursor)
        nextMidnight.setHours(24, 0, 0, 0)

        const segmentEnd = nextMidnight < end ? nextMidnight : end
        const rawMinutes = Math.max(0, Math.round((segmentEnd.getTime() - cursor.getTime()) / 60000))

        if (rawMinutes > 0) {
            segments.push({
                usageDate: localDateOnly(cursor),
                rawMinutes,
            })
        }

        cursor = segmentEnd
    }

    if (segments.length === 0) {
        return [{ usageDate: localDateOnly(start), minutes: totalMinutes }]
    }

    let assigned = 0
    return segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        const minutes = isLast ? Math.max(0, totalMinutes - assigned) : segment.rawMinutes
        assigned += minutes

        return {
            usageDate: segment.usageDate,
            minutes,
        }
    }).filter(segment => segment.minutes > 0)
}
