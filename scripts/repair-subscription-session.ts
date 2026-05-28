import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { parseAttendanceDateTime, splitMinutesByLocalDay } from '../src/lib/subscription/date-utils'

type Args = {
  sessionId?: string
  checkout?: string
  apply: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false }

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

Dry run:
  npx tsx scripts/repair-subscription-session.ts --session-id <id> --checkout "2026-05-27 03:50:13"

Supported checkout formats:
  2026-05-27 03:50:13
  27/05/2026 03:50:13
`)
}

function roundUp15(minutes: number) {
  return Math.ceil(minutes / 15) * 15
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
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
  })

  const usedBySubscription = new Map<string, number>()
  const usageByDate = new Map<string, { subscriptionId: string; totalMin: number; usageDate: Date }>()

  for (const session of sessions) {
    if (!session.subscriptionId || !session.checkOutTime || !session.durationMin) continue

    usedBySubscription.set(
      session.subscriptionId,
      (usedBySubscription.get(session.subscriptionId) || 0) + session.durationMin
    )

    for (const segment of splitMinutesByLocalDay(session.checkInTime, session.checkOutTime, session.durationMin)) {
      const key = dateKey(segment.usageDate)
      const current = usageByDate.get(key)

      usageByDate.set(key, {
        subscriptionId: current?.subscriptionId || session.subscriptionId,
        usageDate: segment.usageDate,
        totalMin: (current?.totalMin || 0) + segment.minutes,
      })
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

  if (!args.sessionId || !args.checkout) {
    usage()
    process.exitCode = 1
    return
  }

  const checkoutTime = parseAttendanceDateTime(args.checkout)
  if (Number.isNaN(checkoutTime.getTime())) {
    throw new Error(`Invalid checkout time: ${args.checkout}`)
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

  if (checkoutTime <= session.checkInTime) {
    throw new Error('Checkout time must be after check-in time.')
  }

  const rawMinutes = (checkoutTime.getTime() - session.checkInTime.getTime()) / 60000
  const repairedDurationMin = roundUp15(Math.max(1, rawMinutes))

  console.log('Session repair preview:')
  console.log({
    subscriber: session.subscriber,
    sessionId: session.id,
    oldCheckInTime: session.checkInTime,
    oldCheckOutTime: session.checkOutTime,
    oldDurationMin: session.durationMin,
    repairedCheckOutTime: checkoutTime,
    repairedDurationMin,
    apply: args.apply,
  })

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
