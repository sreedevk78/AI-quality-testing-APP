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

async function main() {
  try {
    const jobs = await prisma.backgroundJob.findMany({
      where: { status: "queued" }
    });
    console.log(`Found ${jobs.length} queued jobs.`);
    if (jobs.length > 0) {
        console.log(JSON.stringify(jobs, null, 2));
    }
    
    const runs = await prisma.run.findMany({
        where: { status: "queued" }
    });
    console.log(`Found ${runs.length} queued runs.`);
    if (runs.length > 0) {
        console.log(JSON.stringify(runs, null, 2));
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
