import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file) {
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

loadEnv(".env.local");
loadEnv(".env");

const prisma = new PrismaClient();

async function forceJob() {
  try {
    const latestRun = await prisma.run.findUnique({
        where: { id: 'cd0b6794-6729-47ed-878f-6ec5288924b2' }
    });

    if (!latestRun) {
        console.log("No runs found.");
        return;
    }

    console.log(`Latest run: ${latestRun.id} (status: ${latestRun.status})`);

    if (latestRun.status === 'queued') {
        const idempotencyKey = `evaluate_run:${latestRun.id}`;
        await prisma.backgroundJob.upsert({
            where: { idempotencyKey },
            update: {
                status: 'queued',
                runAfter: new Date(),
                lockedAt: null,
                lockedBy: null
            },
            create: {
                workspaceId: latestRun.workspaceId,
                jobType: 'evaluate_run',
                payloadJson: { runId: latestRun.id },
                status: 'queued',
                idempotencyKey
            }
        });
        console.log(`Enqueued job for run ${latestRun.id}`);
    } else {
        console.log("Run is not in queued state.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

forceJob();
