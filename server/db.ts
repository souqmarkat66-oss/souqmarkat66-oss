import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// On local Windows dev, connecting to a remote Postgres (e.g. Neon/Replit DB)
// often hits 5s timeout. Bumped to 30s + keepAlive to survive flaky home networks.
// SSL is enabled when the connection string targets a managed host (neon, replit,
// supabase, render, railway, *.cloud) — required for those providers.
const connStr = process.env.DATABASE_URL!;
const needsSsl = /neon\.tech|replit|supabase|render\.com|railway|amazonaws|\.cloud(\b|\/|:)/i.test(connStr)
  || /sslmode=require/i.test(connStr);

export const pool = new Pool({
  connectionString: connStr,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("[PG Pool] Unexpected client error (keeping process alive):", err.message);
});

export const db = drizzle(pool, { schema });
