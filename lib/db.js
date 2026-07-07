import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set — /api/state and the cron job will fail until it is.");
}

export const sql = connectionString ? neon(connectionString) : null;

let schemaReady = null;
export function ensureSchema() {
  if (!sql) throw new Error("No database configured (missing DATABASE_URL)");
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS day_state (
        day_key TEXT PRIMARY KEY,
        done JSONB NOT NULL DEFAULT '{}'::jsonb,
        note TEXT NOT NULL DEFAULT ''
      )
    `.then(() =>
      sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          endpoint TEXT UNIQUE NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    );
  }
  return schemaReady;
}

export async function getAllDays() {
  await ensureSchema();
  const rows = await sql`SELECT day_key, done, note FROM day_state`;
  const days = {};
  for (const row of rows) {
    days[row.day_key] = { done: row.done, note: row.note };
  }
  return days;
}

export async function upsertDay(dayKey, done, note) {
  await ensureSchema();
  await sql`
    INSERT INTO day_state (day_key, done, note)
    VALUES (${dayKey}, ${JSON.stringify(done)}::jsonb, ${note})
    ON CONFLICT (day_key)
    DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note
  `;
}

export async function wipeDays() {
  await ensureSchema();
  await sql`TRUNCATE day_state`;
}

export async function getSubscriptions() {
  await ensureSchema();
  return sql`SELECT id, endpoint, p256dh, auth FROM push_subscriptions`;
}

export async function saveSubscription(sub) {
  await ensureSchema();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO NOTHING
  `;
}

export async function deleteSubscription(endpoint) {
  await ensureSchema();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}
