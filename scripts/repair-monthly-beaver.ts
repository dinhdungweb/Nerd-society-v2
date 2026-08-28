import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { settleRegistrationOrderInTx } from '../src/lib/subscription/order-lifecycle'

const apply = process.argv.includes('--apply')
const mode = apply ? 'APPLY' : 'DRY_RUN'

type RepairReport = {
  mode: string
  paidRenewals: Array<{ orderId: string; orderCode: string; subscriberId: string }>
  duplicateGroups: Array<{
    subscriberId: string
    subscriptionIds: string[]
    planTypes: string[]
    action: 'AUTO_REPAIR' | 'MANUAL_REVIEW'
    reason?: string
  }>
  repairedRenewals: number
  repairedDuplicateGroups: number
}

function inclusiveDays(startDate: Date | null, endDate: Date | null) {
  if (!startDate || !endDate) return null
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
}

async function repairPaidRenewals(report: RepairReport) {
  const orders = await prisma.registrationOrder.findMany({
    where: { subscriberId: { not: null }, orderStatus: 'PAID', subscriptionId: null },
    orderBy: { paidAt: 'asc' },
  })

  for (const order of orders) {
    report.paidRenewals.push({
      orderId: order.id,
      orderCode: order.orderCode,
      subscriberId: order.subscriberId!,
    })
    if (!apply) continue

    await prisma.$transaction((tx) =>
      settleRegistrationOrderInTx(tx, {
        orderId: order.id,
        paidAt: order.paidAt || order.createdAt,
        paymentRef: order.paymentRef,
        performedBy: 'repair-monthly-beaver',
        auditAction: 'repair_paid_renewal',
      })
    )
    report.repairedRenewals += 1
  }
}

async function repairDuplicateSubscriptions(report: RepairReport) {
  const grouped = await prisma.subscription.groupBy({
    by: ['subscriberId'],
    where: { status: 'ACTIVE' },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  })

  for (const group of grouped) {
    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: group.subscriberId, status: 'ACTIVE' },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: { registrationOrders: true },
    })
    const canonical = subscriptions[0]
    const duplicates = subscriptions.slice(1)
    const samePlan = subscriptions.every((subscription) => subscription.planType === canonical.planType)
    const relationsAreClear = duplicates.every(
      (subscription) =>
        subscription.registrationOrders.length > 0 &&
        subscription.registrationOrders.every(
          (order) => order.subscriberId === group.subscriberId && order.orderStatus === 'ACTIVATED'
        )
    )
    const datesAreClear = subscriptions.every(
      (subscription) => inclusiveDays(subscription.startDate, subscription.endDate) !== null
    )
    const canRepair = samePlan && relationsAreClear && datesAreClear

    report.duplicateGroups.push({
      subscriberId: group.subscriberId,
      subscriptionIds: subscriptions.map((subscription) => subscription.id),
      planTypes: subscriptions.map((subscription) => subscription.planType),
      action: canRepair ? 'AUTO_REPAIR' : 'MANUAL_REVIEW',
      ...(!canRepair
        ? {
            reason: !samePlan
              ? 'Các subscription ACTIVE khác plan'
              : !relationsAreClear
                ? 'Thiếu quan hệ registration order rõ ràng'
                : 'Thiếu startDate/endDate để tính thời hạn',
          }
        : {}),
    })
    if (!apply || !canRepair) continue

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly-beaver-repair:${group.subscriberId}`}))`
      const live = await tx.subscription.findMany({
        where: { id: { in: subscriptions.map((subscription) => subscription.id) }, status: 'ACTIVE' },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
        include: { registrationOrders: true },
      })
      if (live.length !== subscriptions.length) throw new Error(`Dữ liệu đã thay đổi cho subscriber ${group.subscriberId}`)

      const liveCanonical = live[0]
      const liveDuplicates = live.slice(1)
      const totalDays = live.reduce((sum, subscription) => {
        const days = inclusiveDays(subscription.startDate, subscription.endDate)
        if (days === null) throw new Error(`Thiếu thời hạn subscription ${subscription.id}`)
        return sum + days
      }, 0)
      const startDate = new Date(liveCanonical.startDate!)
      const endDate = new Date(startDate)
      endDate.setUTCDate(endDate.getUTCDate() + totalDays - 1)

      await tx.subscription.update({
        where: { id: liveCanonical.id },
        data: {
          endDate,
          totalHoursMin: live.reduce((sum, subscription) => sum + (subscription.totalHoursMin || 0), 0) || null,
          usedHoursMin: live.reduce((sum, subscription) => sum + subscription.usedHoursMin, 0),
          carriedHoursMin: live.reduce((sum, subscription) => sum + subscription.carriedHoursMin, 0),
        },
      })

      for (const duplicate of liveDuplicates) {
        await tx.registrationOrder.updateMany({
          where: { subscriptionId: duplicate.id },
          data: { subscriptionId: liveCanonical.id },
        })
        await tx.subscription.update({ where: { id: duplicate.id }, data: { status: 'RENEWED' } })
      }
      await tx.subscriptionAuditLog.create({
        data: {
          action: 'repair_duplicate_active_subscriptions',
          entityType: 'subscriber',
          entityId: group.subscriberId,
          performedBy: 'repair-monthly-beaver',
          details: {
            canonicalSubscriptionId: liveCanonical.id,
            mergedSubscriptionIds: liveDuplicates.map((subscription) => subscription.id),
            totalDays,
            endDate,
          },
        },
      })
    })
    report.repairedDuplicateGroups += 1
  }
}

async function main() {
  if (apply && process.env.REPAIR_MONTHLY_BEAVER_APPLY !== 'YES') {
    throw new Error('Để chạy --apply, đặt REPAIR_MONTHLY_BEAVER_APPLY=YES sau khi đã backup DB và duyệt dry-run.')
  }

  const report: RepairReport = {
    mode,
    paidRenewals: [],
    duplicateGroups: [],
    repairedRenewals: 0,
    repairedDuplicateGroups: 0,
  }
  await repairPaidRenewals(report)
  await repairDuplicateSubscriptions(report)
  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
