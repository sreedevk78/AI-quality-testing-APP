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

async function checkJobs() {
  try {
    const jobs = await prisma.backgroundJob.findMany({
      where: { status: "queued" }
    });
    console.log("Queued jobs:", JSON.stringify(jobs, null, 2));
    
    const runs = await prisma.run.findMany({
        where: { status: "queued" }
    });
    console.log("Queued runs:", JSON.stringify(runs, null, 2));

  } catch (error) {
    console.error("Query failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobs();
