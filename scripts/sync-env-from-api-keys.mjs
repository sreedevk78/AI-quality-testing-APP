import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "API KEYS.txt");
const text = readFileSync(source, "utf8");
const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const firstMatch = (pattern) => {
  const match = text.match(pattern);
  return match?.[1]?.trim();
};

const groq =
  firstMatch(/GROQ\(([^)]+)\)/i) ??
  lines.find((line) => line.startsWith("gsk_"));

const gemini =
  firstMatch(/GEMINI\(([^)]+)\)/i) ??
  lines.find((line) => line.startsWith("AIza"));

const supabaseUrl =
  firstMatch(/project\s+url\s*:\s*(https:\/\/[a-z0-9.-]+\.supabase\.co)/i) ??
  lines.find((line) => /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(line));

const publishableKey =
  firstMatch(/publishable\s+key\s*:\s*([^\s]+)/i) ??
  firstMatch(/anon\s+key\s*:\s*([^\s]+)/i);

const databasePassword = firstMatch(/database\s+password\s*[:=]\s*([^\s]+)/i);
const databaseUrls = lines.filter((line) => /^postgres(?:ql)?:\/\//i.test(line));
const poolerUrl = databaseUrls.find((line) => /pooler/i.test(line));
const directUrl = databaseUrls.find((line) => /db\.[a-z0-9-]+\.supabase\.co/i.test(line)) ?? databaseUrls[0];
const derivedPoolerUrl = derivePoolerUrl({ supabaseUrl, databasePassword });
const databaseUrl = poolerUrl ?? derivedPoolerUrl ?? directUrl ?? "";

const appEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publishableKey ?? "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  DATABASE_URL: databaseUrl,
  DIRECT_URL: poolerUrl || derivedPoolerUrl ? databaseUrl : directUrl ?? databaseUrl,
  SUPABASE_DIRECT_DATABASE_URL: directUrl ?? "",
  GROQ_API_KEY: groq ?? "",
  GEMINI_API_KEY: gemini ?? "",
  STRIPE_SECRET_KEY: "",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  APP_USE_DATABASE_READS: "0"
};

const prismaEnv = {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: poolerUrl || derivedPoolerUrl ? databaseUrl : directUrl ?? databaseUrl
};

writeFileSync(resolve(root, ".env.local"), serialize(appEnv), "utf8");
writeFileSync(resolve(root, ".env"), serialize(prismaEnv), "utf8");

const missing = Object.entries({
  GROQ_API_KEY: appEnv.GROQ_API_KEY,
  GEMINI_API_KEY: appEnv.GEMINI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: appEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  DATABASE_URL: appEnv.DATABASE_URL
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.log(`Environment synced with missing values: ${missing.join(", ")}`);
} else {
  console.log("Environment synced. Secrets were not printed.");
}

function serialize(record) {
  return `${Object.entries(record)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join("\n")}\n`;
}

function quote(value) {
  if (!value) return "";
  return JSON.stringify(value);
}

function derivePoolerUrl({ supabaseUrl, databasePassword }) {
  if (!supabaseUrl || !databasePassword) return undefined;
  const projectRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (!projectRef) return undefined;
  const encodedPassword = encodeURIComponent(databasePassword);
  return `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
}
