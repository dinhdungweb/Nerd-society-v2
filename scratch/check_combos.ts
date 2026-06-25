import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const combos = await prisma.combo.findMany()
  console.log('Combos count:', combos.length)
  for (const c of combos) {
    console.log(`- ID: ${c.id}, Name: ${c.name}, Slug: ${c.slug}, Image: ${c.image}, Active: ${c.isActive}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
