import 'dotenv/config'
import { AttendanceRecord, getAttendanceList } from '../src/lib/mytime-api'
import { prisma } from '../src/lib/prisma'
import {
  parseAttendanceDateTime,
  parseAttendanceRecordDateTime,
  splitMinutesByLocalDay,
} from '../src/lib/subscription/date-utils'
import {
  calculateDailyCapSessionUsage,
  getSubscriptionDailyCapMin,
} from '../src/lib/subscription/usage-billing'

type Args = {
  sessionId?: string
  checkout?: string
  lookupDays: number
  maxAutoDurationMin: number
  allowLongAuto: boolean
  json: boolean
  list: boolean
  activeOnly: boolean
  search?: string
  minDurationMin?: number
  take: number
  apply: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    allowLongAuto: false,
    apply: false,
    activeOnly: false,
    json: false,
    list: false,
    lookupDays: 14,
    maxAutoDurationMin: 720,
    take: 50,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--session-id') {
      args.sessionId = argv[i + 1]
      i += 1
      continue
    }

    if (arg === '--checkout') {
      args.checkout = argv[i + 1]
      i += 1
      continue
    }

    if (arg === '--lookup-days') {
      args.lookupDays = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--max-auto-duration') {
      args.maxAutoDurationMin = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--allow-long-auto') {
      args.allowLongAuto = true
      continue
    }

    if (arg === '--json') {
      args.json = true
      continue
    }

    if (arg === '--list') {
      args.list = true
      continue
    }

    if (arg === '--active') {
      args.activeOnly = true
      continue
    }

    if (arg === '--search') {
      args.search = argv[i + 1]
      i += 1
      continue
    }

    if (arg === '--min-duration') {
      args.minDurationMin = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--take') {
      args.take = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--apply') {
      args.apply = true
      continue
    }
  }

  return args
}

function usage() {
  console.log(`
Usage:
  npx tsx scripts/repair-subscription-session.ts --session-id <id> --checkout "2026-05-27 03:50:13" --apply
  npx tsx scripts/repair-subscription-session.ts --session-id <id> --apply

Dry run:
  npx tsx scripts/repair-subscription-session.ts --session-id <id> --checkout "2026-05-27 03:50:13"
  npx tsx scripts/repair-subscription-session.ts --session-id <id>

Find session ids:
  npx tsx scripts/repair-subscription-session.ts --list --active
  npx tsx scripts/repair-subscription-session.ts --list --search "Trường Đức Anh"
  npx tsx scripts/repair-subscription-session.ts --list --min-duration 480 --take 100
  npx tsx scripts/repair-subscription-session.ts --list --search "Truong Duc Anh" --json

Supported checkout formats:
  2026-05-27 03:50:13
  27/05/2026 03:50:13

When --checkout is omitted, the script fetches MyTime attendance automatically.
Use --lookup-days <number> to widen the search window. Default: 14.
Auto-detected checkout is blocked when duration exceeds --max-auto-duration. Default: 720 minutes.
Use --checkout for manual repair, or --allow-long-auto only when the long session is confirmed.
`)
}

function roundUp15(minutes: number) {
  return Math.ceil(minutes / 15) * 15
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatLocal(date?: Date | null) {
  if (!date) return '-'

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatMytimeDateTime(date: Date) {
  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
  ].join(' ')
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function attendanceKey(record: AttendanceRecord) {
  return `${record.EmployeeID}|${record.AttDate}|${record.AttTime}`
}

async function fetchAttendanceForSession(
  session: {
    checkInTime: Date
    checkOutTime: Date | null
    subscriber: { fullName: string; cardNo: string | null; mytimeEmpId: string | null }
  },
  lookupDays: number
) {
  const from = new Date(session.checkInTime.getTime() - 2 * 60 * 1000)
  const fallbackTo = new Date(session.checkInTime.getTime() + lookupDays * 24 * 60 * 60 * 1000)
  const now = new Date()
  const to =
    session.checkOutTime && session.checkOutTime > session.checkInTime
      ? session.checkOutTime
      : fallbackTo < now
        ? fallbackTo
        : now
  const employeeIds = uniqueValues([session.subscriber.mytimeEmpId, session.subscriber.cardNo])
  const recordsByKey = new Map<string, AttendanceRecord>()

  for (const employeeId of employeeIds) {
    const response = await getAttendanceList(formatMytimeDateTime(from), formatMytimeDateTime(to), employeeId)
    if (response.result === 'success' && Array.isArray(response.data)) {
      for (const record of response.data.flat()) {
        recordsByKey.set(attendanceKey(record), record)
      }
    }
  }

  if (recordsByKey.size === 0) {
    const response = await getAttendanceList(formatMytimeDateTime(from), formatMytimeDateTime(to), '-1')
    if (response.result === 'success' && Array.isArray(response.data)) {
      for (const record of response.data.flat()) {
        const matchesEmployeeId = employeeIds.includes(record.EmployeeID)
        const matchesName = record.FullName?.trim().toLowerCase() === session.subscriber.fullName.trim().toLowerCase()

        if (matchesEmployeeId || matchesName) {
          recordsByKey.set(attendanceKey(record), record)
        }
      }
    }
  }

  return Array.from(recordsByKey.values()).sort(
    (a, b) => parseAttendanceRecordDateTime(a).getTime() - parseAttendanceRecordDateTime(b).getTime()
  )
}

async function findCheckoutFromMytime(
  session: {
    id: string
    checkInTime: Date
    checkOutTime: Date | null
    subscriber: { fullName: string; cardNo: string | null; mytimeEmpId: string | null }
  },
  lookupDays: number
) {
  const records = await fetchAttendanceForSession(session, lookupDays)
  const minCheckoutTime = new Date(session.checkInTime.getTime() + 60 * 1000)

  for (const record of records) {
    const attTime = parseAttendanceRecordDateTime(record)
    if (Number.isNaN(attTime.getTime())) continue
    if (attTime <= minCheckoutTime) continue

    return { checkoutTime: attTime, record, records }
  }

  return { checkoutTime: null, record: null, records }
}

async function listSessions(args: Args) {
  let subscriberIds: string[] | undefined

  if (args.search) {
    const subscribers = await prisma.subscriber.findMany({
      where: {
        OR: [
          { fullName: { contains: args.search, mode: 'insensitive' } },
          { phone: { contains: args.search } },
          { cardNo: { contains: args.search } },
          { mytimeEmpId: { contains: args.search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 100,
    })

    subscriberIds = subscribers.map((subscriber) => subscriber.id)

    if (subscriberIds.length === 0) {
      console.log(`No subscribers matched search: ${args.search}`)
      return
    }
  }

  const sessions = await prisma.subscriptionSession.findMany({
    where: {
      ...(subscriberIds ? { subscriberId: { in: subscriberIds } } : {}),
      ...(args.activeOnly ? { status: 'ACTIVE', checkOutTime: null } : {}),
    },
    orderBy: { checkInTime: 'desc' },
    take: Number.isFinite(args.take) && args.take > 0 ? args.take : 50,
    include: {
      subscriber: { select: { fullName: true, phone: true, cardNo: true, mytimeEmpId: true } },
      subscription: { select: { planType: true } },
    },
  })

  const now = new Date()
  const rows = sessions
    .map((session) => {
      const actualDurationMin = session.checkOutTime
        ? Math.max(1, Math.round((session.checkOutTime.getTime() - session.checkInTime.getTime()) / 60000))
        : Math.max(1, Math.round((now.getTime() - session.checkInTime.getTime()) / 60000))

      return {
        sessionId: session.id,
        name: session.subscriber.fullName,
        phone: session.subscriber.phone,
        cardNo: session.subscriber.cardNo || '',
        mytimeEmpId: session.subscriber.mytimeEmpId || '',
        plan: session.subscription?.planType || 'WALLET',
        branch: session.branch,
        status: session.status,
        checkIn: formatLocal(session.checkInTime),
        checkOut: formatLocal(session.checkOutTime),
        durationMin: session.durationMin || actualDurationMin,
        source: session.source,
      }
    })
    .filter((row) => !args.minDurationMin || row.durationMin >= args.minDurationMin)

  if (rows.length === 0) {
    console.log('No sessions matched filters.')
    return
  }

  if (args.json) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  console.table(rows)
}

async function rebuildSubscriberUsage(subscriberId: string) {
  const sessions = await prisma.subscriptionSession.findMany({
    where: {
      subscriberId,
      subscriptionId: { not: null },
      status: 'COMPLETED',
      checkOutTime: { not: null },
      durationMin: { not: null },
    },
    orderBy: { checkInTime: 'asc' },
    include: {
      subscription: { select: { dailyLimitMin: true, planType: true } },
    },
  })

  const usedBySubscription = new Map<string, number>()
  const usageByDate = new Map<string, { subscriptionId: string; totalMin: number; usageDate: Date }>()

  for (const session of sessions) {
    if (!session.subscriptionId || !session.checkOutTime || !session.durationMin) continue

    usedBySubscription.set(
      session.subscriptionId,
      (usedBySubscription.get(session.subscriptionId) || 0) + session.durationMin
    )

    const dailyCapMin = getSubscriptionDailyCapMin(session.subscription)
    if (!dailyCapMin) continue

    const segments = splitMinutesByLocalDay(session.checkInTime, session.checkOutTime, session.durationMin)

    for (const segment of segments) {
      const key = dateKey(segment.usageDate)
      const current = usageByDate.get(key)
      const billing = calculateDailyCapSessionUsage({
        durationMin: segment.minutes,
        usedMinBefore: current?.totalMin || 0,
        dailyCapMin,
      })

      if (billing.includedMin > 0) {
        usageByDate.set(key, {
          subscriptionId: current?.subscriptionId || session.subscriptionId,
          usageDate: segment.usageDate,
          totalMin: (current?.totalMin || 0) + billing.includedMin,
        })
      }
    }
  }

  return {
    sessions,
    usedBySubscription,
    usageByDate,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.list) {
    await listSessions(args)
    return
  }

  if (!args.sessionId) {
    usage()
    process.exitCode = 1
    return
  }

  const session = await prisma.subscriptionSession.findUnique({
    where: { id: args.sessionId },
    include: {
      subscriber: { select: { id: true, fullName: true, cardNo: true, mytimeEmpId: true } },
      subscription: { select: { id: true, usedHoursMin: true, planType: true } },
    },
  })

  if (!session) {
    throw new Error(`Session not found: ${args.sessionId}`)
  }

  if (!session.subscriptionId) {
    throw new Error('This repair script only rebuilds subscription sessions, not wallet-only sessions.')
  }

  const autoCheckout = args.checkout
    ? null
    : await findCheckoutFromMytime(
        {
          id: session.id,
          checkInTime: session.checkInTime,
          checkOutTime: session.checkOutTime,
          subscriber: session.subscriber,
        },
        args.lookupDays
      )
  const checkoutTime = args.checkout ? parseAttendanceDateTime(args.checkout) : autoCheckout?.checkoutTime

  if (!checkoutTime || Number.isNaN(checkoutTime.getTime())) {
    console.log({
      sessionId: session.id,
      subscriber: session.subscriber,
      checkInTime: formatLocal(session.checkInTime),
      currentCheckOutTime: formatLocal(session.checkOutTime),
      lookupDays: args.lookupDays,
      matchedAttendanceRecords: autoCheckout?.records.length || 0,
    })
    throw new Error('Could not find checkout time. Pass --checkout manually or increase --lookup-days.')
  }

  if (checkoutTime <= session.checkInTime) {
    throw new Error('Checkout time must be after check-in time.')
  }

  const rawMinutes = (checkoutTime.getTime() - session.checkInTime.getTime()) / 60000
  const repairedDurationMin = roundUp15(Math.max(1, rawMinutes))
  const isLongAutoMatch =
    Boolean(autoCheckout?.record) &&
    !args.checkout &&
    !args.allowLongAuto &&
    Number.isFinite(args.maxAutoDurationMin) &&
    repairedDurationMin > args.maxAutoDurationMin

  console.log('Session repair preview:')
  console.log({
    subscriber: session.subscriber,
    sessionId: session.id,
    oldCheckInTime: session.checkInTime,
    oldCheckOutTime: session.checkOutTime,
    oldDurationMin: session.durationMin,
    repairedCheckOutTime: checkoutTime,
    repairedDurationMin,
    maxAutoDurationMin: args.maxAutoDurationMin,
    autoMatchBlocked: isLongAutoMatch,
    autoMatchedAttendance: autoCheckout?.record || null,
    apply: args.apply,
  })

  if (isLongAutoMatch) {
    throw new Error(
      `Auto-detected checkout would create a ${repairedDurationMin} minute session. Pass --checkout manually, increase --max-auto-duration, or add --allow-long-auto if this is correct.`
    )
  }

  if (!args.apply) {
    console.log('Dry run only. Add --apply to write changes.')
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionSession.update({
      where: { id: session.id },
      data: {
        checkOutTime: checkoutTime,
        durationMin: repairedDurationMin,
        status: 'COMPLETED',
        notes: session.notes
          ? `${session.notes}\nRepaired checkout at ${new Date().toISOString()}`
          : `Repaired checkout at ${new Date().toISOString()}`,
      },
    })
  })

  const rebuilt = await rebuildSubscriberUsage(session.subscriberId)

  await prisma.$transaction(async (tx) => {
    await tx.dailyUsage.deleteMany({ where: { subscriberId: session.subscriberId } })

    for (const [subscriptionId, usedHoursMin] of rebuilt.usedBySubscription.entries()) {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { usedHoursMin },
      })
    }

    for (const usage of rebuilt.usageByDate.values()) {
      await tx.dailyUsage.create({
        data: {
          subscriberId: session.subscriberId,
          subscriptionId: usage.subscriptionId,
          usageDate: usage.usageDate,
          totalMin: usage.totalMin,
        },
      })
    }

    await tx.subscriptionAuditLog.create({
      data: {
        action: 'repair_session_checkout',
        entityType: 'subscription_session',
        entityId: session.id,
        performedBy: 'script',
        details: {
          oldCheckOutTime: session.checkOutTime?.toISOString() || null,
          oldDurationMin: session.durationMin,
          repairedCheckOutTime: checkoutTime.toISOString(),
          repairedDurationMin,
          autoMatchedAttendance: autoCheckout?.record ? { ...autoCheckout.record } : null,
          rebuiltDailyUsageRows: rebuilt.usageByDate.size,
        },
      },
    })
  })

  console.log('Repair applied.')
  console.log({
    rebuiltCompletedSessions: rebuilt.sessions.length,
    rebuiltDailyUsageRows: rebuilt.usageByDate.size,
    rebuiltSubscriptions: rebuilt.usedBySubscription.size,
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
