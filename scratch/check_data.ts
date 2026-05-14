import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const subs = await prisma.subscription.findMany({
    select: {
      id: true,
      planType: true,
      totalHoursMin: true,
      usedHoursMin: true,
      status: true,
      subscriber: {
        select: {
          fullName: true
        }
      }
    }
  })

  console.table(subs.map(s => ({
    name: s.subscriber.fullName,
    type: s.planType,
    total: s.totalHoursMin,
    used: s.usedHoursMin,
    status: s.status
  })))
}

main().finally(() => prisma.$disconnect())
