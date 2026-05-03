import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const activeSessions = await prisma.subscriptionSession.findMany({
    where: { checkOutTime: null },
    include: {
      subscriber: true,
    },
  });
  console.log(`Found ${activeSessions.length} active sessions.`);
  activeSessions.forEach(s => {
    console.log(`- ${s.subscriber.fullName} (${s.branch}) since ${s.checkInTime}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
