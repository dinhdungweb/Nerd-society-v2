require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeSessions = await prisma.subscriptionSession.findMany({
    where: { checkOutTime: null },
    include: {
      subscriber: true,
      subscription: true,
    },
  });
  console.log('Active Sessions:', JSON.stringify(activeSessions, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
