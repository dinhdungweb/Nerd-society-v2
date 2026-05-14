import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const subs = await prisma.subscription.count()
  const subscr = await prisma.subscriber.count()
  const orders = await prisma.registrationOrder.count()

  console.log(`Subscribers: ${subscr}`)
  console.log(`Subscriptions: ${subs}`)
  console.log(`RegistrationOrders: ${orders}`)

  const allSubs = await prisma.subscription.findMany({
    include: { subscriber: true }
  })
  console.log('--- Subscriptions ---')
  console.table(allSubs.map(s => ({
    name: s.subscriber.fullName,
    type: s.planType,
    total: s.totalHoursMin,
    status: s.status
  })))
}

main().finally(() => prisma.$disconnect())
