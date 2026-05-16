import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const anonKey = firstMatch(/anon\s+public\s*:\s*([^\s]+)/i) ?? publishableKey;
const serviceRoleKey = firstMatch(/service_role\s+secret\s*:\s*([^\s]+)/i);
const supabaseSecretKey = firstMatch(/secret\s+key\s*:\s*([^\s]+)/i);

const databasePassword =
  firstMatch(/database\s+password\s*[:=]\s*([^\s]+)/i) ??
  firstMatch(/my\s+password\s+is\s*:\s*([^\s]+)/i) ??
  firstMatch(/postgres:\[([^\]]+)\]@/i);
const databaseUrls = Array.from(text.matchAll(/postgres(?:ql)?:\/\/[^\s"']+/gi)).map((match) => match[0]);
const transactionPoolerUrl = normalizeDatabaseUrl(databaseUrls.find((line) => /pooler/i.test(line) && /:6543\//.test(line)), databasePassword);
const sessionPoolerUrl = normalizeDatabaseUrl(databaseUrls.find((line) => /pooler/i.test(line) && /:5432\//.test(line)), databasePassword);
const derivedSessionPoolerUrl = deriveSessionPoolerUrl(transactionPoolerUrl);
const directDbUrl = normalizeDatabaseUrl(databaseUrls.find((line) => /db\.[a-z0-9-]+\.supabase\.co/i.test(line)), databasePassword);
const derivedPoolerUrl = derivePoolerUrl({ supabaseUrl, databasePassword });
const databaseUrl = transactionPoolerUrl ?? derivedPoolerUrl ?? sessionPoolerUrl ?? directDbUrl ?? "";
const directUrl = sessionPoolerUrl ?? derivedSessionPoolerUrl ?? deriveSessionPoolerUrl(derivedPoolerUrl) ?? directDbUrl ?? databaseUrl;
const existing = readExistingEnv(resolve(root, ".env.local"));
const secretEncryptionKey = existing.SECRET_ENCRYPTION_KEY || randomBytes(32).toString("base64url");

const appEnv = {
  NEXT_PUBLIC_APP_URL: existing.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ?? "",
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ?? existing.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_SECRET_KEY: supabaseSecretKey ?? existing.SUPABASE_SECRET_KEY ?? "",
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl ?? databaseUrl,
  SUPABASE_DIRECT_DATABASE_URL: directDbUrl ?? "",
  GROQ_API_KEY: groq ?? "",
  GEMINI_API_KEY: gemini ?? "",
  SECRET_ENCRYPTION_KEY: secretEncryptionKey,
  OLLAMA_BASE_URL: existing.OLLAMA_BASE_URL ?? "",
  OLLAMA_API_KEY: existing.OLLAMA_API_KEY ?? "",
  STRIPE_SECRET_KEY: "",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  APP_USE_DATABASE_READS: "1"
};

const prismaEnv = {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl ?? databaseUrl
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
  return `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
}

function deriveSessionPoolerUrl(transactionUrl) {
  if (!transactionUrl) return undefined;
  return transactionUrl
    .replace(":6543/", ":5432/")
    .replace(/[?&]pgbouncer=true/g, "")
    .replace(/\?$/, "");
}

function normalizeDatabaseUrl(value, databasePassword) {
  if (!value) return undefined;
  let normalized = value.replace(/^DATABASE_URL=/, "").replace(/^DIRECT_URL=/, "").replace(/^"|"$/g, "");
  if (databasePassword) {
    normalized = normalized.replace("[YOUR-PASSWORD]", encodeURIComponent(databasePassword));
    normalized = normalized.replace(`[${databasePassword}]`, encodeURIComponent(databasePassword));
  }
  if (/pooler/i.test(normalized) && !/[?&]pgbouncer=true/.test(normalized) && /:6543\//.test(normalized)) {
    normalized += normalized.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  return normalized;
}

function readExistingEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...parts] = line.split("=");
        const raw = parts.join("=");
        try {
          return [key, JSON.parse(raw)];
        } catch {
          return [key, raw.replace(/^"|"$/g, "")];
        }
      })
  );
}
