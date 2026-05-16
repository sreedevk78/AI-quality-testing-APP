import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { resolve } from "node:path";

let shuttingDown = false;
let disconnectPrisma: (() => Promise<void>) | null = null;

process.on("SIGINT", () => {
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

main().catch(async (error) => {
  console.error(error);
  if (disconnectPrisma) {
    await disconnectPrisma();
  }
  process.exit(1);
});

async function main() {
  loadEnv(".env.local");
  loadEnv(".env");
  const [{ prisma }, { JobService }, { RunExecutionService }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/server/services/job-service"),
    import("@/server/services/run-execution-service")
  ]);
  disconnectPrisma = () => prisma.$disconnect();

  const workerId = process.env.WORKER_ID || `eval-worker-${hostname()}-${process.pid}`;
  const batchSize = Number(process.env.WORKER_CONCURRENCY ?? process.env.WORKER_BATCH_SIZE ?? 2);
  const leaseMs = Number(process.env.WORKER_LEASE_MS ?? 5 * 60 * 1000);
  const pollMs = Number(process.env.WORKER_POLL_MS ?? 3000);
  const runOnce = process.env.WORKER_ONCE === "1";
  const jobs = new JobService();
  const executor = new RunExecutionService();
  let lastIdleLogAt = 0;

  try {
    await jobs.recoverStaleJobs({ staleMs: leaseMs });
    console.log(JSON.stringify({ workerId, status: "started", startedAt: new Date().toISOString(), runOnce }));

    while (!shuttingDown) {
      const leased = await jobs.leaseNextJobs({ workerId, limit: batchSize, leaseMs });

      for (const job of leased) {
        await jobs.heartbeat(job.id, workerId);
        await executor.processJob(job, workerId);
      }

      if (leased.length > 0) {
        console.log(JSON.stringify({ workerId, leased: leased.length, completedAt: new Date().toISOString() }));
      } else if (Date.now() - lastIdleLogAt > 60_000) {
        lastIdleLogAt = Date.now();
        console.log(JSON.stringify({ workerId, leased: 0, status: "idle", checkedAt: new Date().toISOString() }));
      }

      if (runOnce) break;
      if (leased.length === 0) {
        await sleep(pollMs);
      }
    }
  } finally {
    await prisma.$disconnect();
    disconnectPrisma = null;
  }
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function loadEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"|"$/g, "");
    }
  }
}
