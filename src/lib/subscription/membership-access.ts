import { prisma } from '@/lib/prisma'
import { businessDateOnly } from '@/lib/subscription/date-utils'
import { getPlanEndDate, PLAN_HOURS_MIN } from '@/lib/subscription/order-lifecycle'
import { buildMembershipQrPayload, ensureMembershipQrCredentialInTx } from '@/lib/subscription/qr-credential'
import { Prisma, type Subscription } from '@prisma/client'

const PAID_ORDER_STATUSES = ['PAID', 'QR_ISSUED', 'CARD_ASSIGNED', 'ACTIVATED'] as const

export async function ensureMembershipAccessInTx(
  tx: Prisma.TransactionClient,
  subscriberId: string,
  performedBy: string
) {
  const subscriber = await tx.subscriber.findUniqueOrThrow({
    where: { id: subscriberId },
    include: {
      qrCredential: true,
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
        orderBy: { createdAt: 'desc' },
        include: { registrationOrders: { orderBy: { createdAt: 'desc' } } },
      },
    },
  })

  let subscription: Subscription | null = subscriber.subscriptions.find((item) => item.status === 'ACTIVE') || null
  let activationKind: 'ALREADY_ACTIVE' | 'ACTIVATED_PENDING' | 'PENDING_UNVERIFIED' | 'WALLET_ONLY' = subscription
    ? 'ALREADY_ACTIVE'
    : 'WALLET_ONLY'

  if (!subscription) {
    const pending = subscriber.subscriptions.find((item) => item.status === 'PENDING_ACTIVATION')
    if (pending) {
      const paidOrder = pending.registrationOrders.find(
        (order) =>
          PAID_ORDER_STATUSES.includes(order.orderStatus as (typeof PAID_ORDER_STATUSES)[number]) &&
          order.amount === pending.pricePaid
      )
      const paymentEvidence = paidOrder
        ? `order:${paidOrder.orderCode}:${paidOrder.orderStatus}`
        : pending.pricePaid > 0 && pending.paymentRef
          ? `subscription-payment-ref:${pending.paymentRef}`
          : null

      if (subscriber.status === 'ACTIVE' && paymentEvidence) {
        const activatedAt =
          pending.activationDate ||
          paidOrder?.assignedAt ||
          subscriber.qrCredential?.issuedAt ||
          paidOrder?.paidAt ||
          pending.purchasedAt
        const startDate = pending.startDate || businessDateOnly(activatedAt)
        const endDate = pending.endDate || getPlanEndDate(startDate, pending.planType)
        const planHoursMin = PLAN_HOURS_MIN[pending.planType]

        subscription = await tx.subscription.update({
          where: { id: pending.id },
          data: {
            status: 'ACTIVE',
            activationDate: activatedAt,
            startDate,
            endDate,
            activationDeadline: null,
            totalHoursMin: planHoursMin > 0 ? Math.max(pending.totalHoursMin || 0, planHoursMin) : null,
            dailyLimitMin: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'].includes(pending.planType)
              ? 480
              : pending.dailyLimitMin,
          },
        })
        await tx.registrationOrder.updateMany({
          where: {
            subscriptionId: pending.id,
            orderStatus: { in: [...PAID_ORDER_STATUSES] },
          },
          data: {
            orderStatus: 'ACTIVATED',
            subscriberId,
            assignedBy: performedBy,
            assignedAt: activatedAt,
          },
        })
        await tx.subscriptionAuditLog.create({
          data: {
            action: 'activate_paid_subscription_on_qr_access',
            entityType: 'subscription',
            entityId: pending.id,
            performedBy,
            details: {
              subscriberId,
              paymentEvidence,
              activationPolicy: 'preserve_original_qr_or_payment_time',
              activationDate: activatedAt,
              startDate,
              endDate,
            },
          },
        })
        activationKind = 'ACTIVATED_PENDING'
      } else {
        activationKind = 'PENDING_UNVERIFIED'
      }
    }
  }

  const credential = await ensureMembershipQrCredentialInTx(tx, subscriberId)
  return {
    credential,
    payload: credential.status === 'ACTIVE' ? buildMembershipQrPayload(credential) : null,
    subscription,
    activationKind,
  }
}

export function ensureMembershipAccess(subscriberId: string, performedBy: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership-access:${subscriberId}`}))`
    return ensureMembershipAccessInTx(tx, subscriberId, performedBy)
  })
}
