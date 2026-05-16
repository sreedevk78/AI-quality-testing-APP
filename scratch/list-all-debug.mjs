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

async function listAll() {
  try {
    const jobs = await prisma.backgroundJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });
    console.log("Latest 10 jobs:", JSON.stringify(jobs, null, 2));
    
    const runs = await prisma.run.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });
    console.log("Latest 10 runs:", JSON.stringify(runs, null, 2));

  } catch (error) {
    console.error("Query failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAll();
