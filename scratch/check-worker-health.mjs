
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const now = new Date();
  const jobs = await prisma.backgroundJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('--- Recent Background Jobs ---');
  jobs.forEach(j => {
    console.log(`ID: ${j.id} | Type: ${j.jobType} | Status: ${j.status} | LockedBy: ${j.lockedBy} | Heartbeat: ${j.lastHeartbeatAt}`);
  });

  const runningJobs = await prisma.backgroundJob.count({ where: { status: 'running' } });
  const queuedJobs = await prisma.backgroundJob.count({ where: { status: 'queued' } });
  
  console.log(`\nSummary: ${runningJobs} running, ${queuedJobs} queued`);
  
  const staleJobs = await prisma.backgroundJob.findMany({
    where: {
      status: 'running',
      lockedAt: { lt: new Date(Date.now() - 5 * 60_000) }
    }
  });
  
  if (staleJobs.length > 0) {
    console.log(`\nFound ${staleJobs.length} STALE jobs!`);
  } else {
    console.log('\nNo stale jobs found.');
  }

  await prisma.$disconnect();
}

check();
