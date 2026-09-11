import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

function developmentDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("AI media job integration tests may only run with NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("AI media job integration tests require DATABASE_URL");
  }
  return process.env.DATABASE_URL;
}

function urlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

test("AI media jobs settle a completed avatar once and never charge a failed job", async () => {
  const baseDatabaseUrl = developmentDatabaseUrl();
  const schema = `ai_media_job_test_${randomUUID().replaceAll("-", "")}`;
  const fixturePool = new pg.Pool({ connectionString: baseDatabaseUrl });
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let applicationPool: pg.Pool | undefined;

  try {
    await fixturePool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    const fixtureClient = await fixturePool.connect();
    try {
      await fixtureClient.query(`SET search_path TO ${quoteIdentifier(schema)}`);
      await fixtureClient.query(`
        CREATE TABLE users (id varchar PRIMARY KEY);
        CREATE TABLE ai_usage (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          type text NOT NULL,
          credits_used integer DEFAULT 1,
          cost numeric DEFAULT 0,
          created_at timestamp DEFAULT now()
        );
        CREATE TABLE ai_credit_wallets (
          user_id varchar PRIMARY KEY REFERENCES users(id),
          balance integer NOT NULL DEFAULT 0,
          total_purchased integer NOT NULL DEFAULT 0,
          total_consumed integer NOT NULL DEFAULT 0,
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE TABLE revenue_transactions (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          type text NOT NULL,
          amount_egp numeric NOT NULL,
          description text,
          campaign_id integer,
          channel_id integer,
          created_at timestamp DEFAULT now()
        );
        INSERT INTO users (id) VALUES ('media-job-user');
      `);
      const migration = await readFile(
        new URL("../migrations/0010_ai_media_jobs.sql", import.meta.url),
        "utf8",
      );
      await fixtureClient.query(migration);
    } finally {
      fixtureClient.release();
    }

    process.env.DATABASE_URL = urlWithSearchPath(baseDatabaseUrl, schema);
    const { pool } = await import("./db");
    applicationPool = pool;
    const {
      completeAiMediaJob,
      createAiMediaJob,
      markAiMediaJobFailed,
    } = await import("./ai-media-jobs");

    await createAiMediaJob("media-job-user", "did-completed-job");
    const firstCompletion = await completeAiMediaJob({
      userId: "media-job-user",
      providerJobId: "did-completed-job",
      cachedResultUrl: "/uploads/did-completed-job.mp4",
      freeCredits: 1,
      walletPriceEGP: 5,
      description: "avatar",
      adminBypass: false,
    });
    assert.equal(firstCompletion.status, "completed");
    assert.equal(firstCompletion.newlySettled, true);
    assert.equal(firstCompletion.consumption?.source, "free");

    const repeatedCompletion = await completeAiMediaJob({
      userId: "media-job-user",
      providerJobId: "did-completed-job",
      cachedResultUrl: "/uploads/did-completed-job.mp4",
      freeCredits: 1,
      walletPriceEGP: 5,
      description: "avatar",
      adminBypass: false,
    });
    assert.equal(repeatedCompletion.status, "completed");
    assert.equal(repeatedCompletion.newlySettled, false);
    const chargedRows = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1",
      ["media-job-user"],
    );
    assert.equal(chargedRows.rows[0].count, 1);

    await createAiMediaJob("media-job-user", "did-failed-job");
    assert.equal(await markAiMediaJobFailed("media-job-user", "did-failed-job"), true);
    const failedCompletion = await completeAiMediaJob({
      userId: "media-job-user",
      providerJobId: "did-failed-job",
      cachedResultUrl: "/uploads/did-failed-job.mp4",
      freeCredits: 1,
      walletPriceEGP: 5,
      description: "avatar",
      adminBypass: false,
    });
    assert.equal(failedCompletion.status, "failed");
    const chargesAfterFailure = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1",
      ["media-job-user"],
    );
    assert.equal(chargesAfterFailure.rows[0].count, 1);
  } finally {
    if (applicationPool) await applicationPool.end();
    process.env.DATABASE_URL = originalDatabaseUrl;
    await fixturePool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await fixturePool.end();
  }
});