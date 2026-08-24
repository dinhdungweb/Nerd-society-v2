import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const duplicateOpenSessions = await prisma.$queryRaw<Array<{ subscriberId: string; count: bigint }>>`
    SELECT "subscriberId", count(*) AS count
    FROM "SubscriptionSession"
    WHERE "checkOutTime" IS NULL AND "status" = 'ACTIVE'
    GROUP BY "subscriberId"
    HAVING count(*) > 1
  `
  if (duplicateOpenSessions.length) {
    throw new Error(`Có ${duplicateOpenSessions.length} hội viên có nhiều session mở; cần đối soát trước migration.`)
  }

  const [subscriberRows, credentialCount, legacyCardSessions, missingQuotaRows, missingSubscriptionQuotas] = await Promise.all([
    prisma.subscriber.findMany({
      select: {
        id: true,
        qrCredential: { select: { id: true } },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
          select: { id: true },
          take: 1,
        },
        user: { select: { wallet: { select: { status: true } } } },
      },
    }),
    prisma.membershipQrCredential.count(),
    prisma.subscriptionSession.count({ where: { source: 'card' } }),
    prisma.dailyUsage.count({ where: { quotaMin: null } }),
    prisma.subscription.count({
      where: {
        dailyLimitMin: null,
        planType: { in: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'] },
      },
    }),
  ])
  const eligibleSubscribers = subscriberRows.filter((subscriber) =>
    subscriber.subscriptions.length > 0 || subscriber.user?.wallet?.status === 'ACTIVE'
  )
  const credentialsToCreate = eligibleSubscribers.filter((subscriber) => !subscriber.qrCredential)

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    subscriberCount: subscriberRows.length,
    eligibleSubscriberCount: eligibleSubscribers.length,
    credentialCount,
    credentialsToCreate: credentialsToCreate.length,
    legacyCardSessions,
    missingQuotaRows,
    missingSubscriptionQuotas,
  }, null, 2))
  if (!apply) return

  for (const subscriber of credentialsToCreate) {
    await prisma.membershipQrCredential.create({
      data: { subscriberId: subscriber.id, publicId: randomUUID() },
    })
  }

  await prisma.subscriptionSession.updateMany({ where: { source: 'card' }, data: { source: 'legacy_card' } })
  await prisma.subscription.updateMany({
    where: {
      dailyLimitMin: null,
      planType: { in: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'] },
    },
    data: { dailyLimitMin: 480 },
  })
  const usages = await prisma.dailyUsage.findMany({
    where: { quotaMin: null },
    include: { subscription: { select: { dailyLimitMin: true, planType: true } } },
  })
  for (const usage of usages) {
    const quota = usage.subscription.dailyLimitMin ||
      (['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'].includes(usage.subscription.planType) ? 480 : null)
    if (quota) await prisma.dailyUsage.update({ where: { id: usage.id }, data: { quotaMin: quota } })
  }

  console.log(`Đã tạo ${credentialsToCreate.length} QR credential và chuẩn hóa dữ liệu legacy. Không thay đổi số dư/nợ.`)
}

main().finally(() => prisma.$disconnect())
