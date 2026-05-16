import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  const { error } = await supabase.auth.admin.createUser({
    email: "demo@example.com",
    password: "password123",
    email_confirm: true
  });

  if (error) {
    if (error.message.includes("already registered")) {
        console.log("User demo@example.com already exists in Supabase.");
        // Try updating the password just in case
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === "demo@example.com").id,
            { password: "password123" }
        );
        if (updateError) console.error("Error updating password:", updateError.message);
        else console.log("Password reset to: password123");
    } else {
        console.error("Error creating user:", error.message);
    }
  } else {
    console.log("User created successfully: demo@example.com / password123");
  }
}

createUser();
