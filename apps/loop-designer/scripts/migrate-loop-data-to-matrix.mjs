#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const sourceUrl = env("LOOP_SOURCE_SUPABASE_URL");
const sourceKey = env("LOOP_SOURCE_SERVICE_ROLE_KEY");
const targetUrl = process.env.MATRIX_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const targetKey = process.env.MATRIX_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetKey) {
  throw new Error("MATRIX_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and MATRIX_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY are required");
}

const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
const target = createClient(targetUrl, targetKey, { auth: { persistSession: false } });

const tables = [
  "loop_designer_enterprises",
  "loop_designer_users",
  "loop_designer_enterprise_members",
  "loop_designer_enterprise_settings",
  "loop_designer_invite_codes",
  "loop_designer_sessions",
  "loop_designer_audit_logs",
  "loop_designer_auth_sessions",
];

for (const table of tables) {
  await copyTable(table);
}

console.log("Loop Designer data migration to Matrix Supabase completed.");

async function copyTable(table) {
  let from = 0;
  const pageSize = 500;
  let total = 0;

  while (true) {
    const { data, error } = await source
      .from(table)
      .select("*")
      .order("created_at", { ascending: true, nullsFirst: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: source read failed: ${error.message}`);
    if (!data?.length) break;

    const { error: upsertError } = await target
      .from(table)
      .upsert(data, { onConflict: "id" });

    if (upsertError) throw new Error(`${table}: target upsert failed: ${upsertError.message}`);
    total += data.length;
    from += pageSize;
  }

  console.log(`${table}: ${total} rows copied`);
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
