import { and, eq, sql } from "drizzle-orm";
import { aiMediaJobs, aiUsage } from "@shared/schema";
import { db } from "./db";
import {
  consumeAiCreditAtomicInTransaction,
  type AiCreditConsumptionResult,
} from "./storage";

export type AiMediaJob = typeof aiMediaJobs.$inferSelect;

type CompletionOptions = {
  userId: string;
  providerJobId: string;
  cachedResultUrl: string;
  freeCredits: number;
  walletPriceEGP: number;
  description: string;
  adminBypass: boolean;
};

export type AiMediaJobCompletion =
  | { status: "completed"; cachedResultUrl: string; newlySettled: boolean; consumption?: AiCreditConsumptionResult }
  | { status: "insufficient"; consumption: AiCreditConsumptionResult }
  | { status: "failed" | "not_found" };

function jobLockKey(userId: string, providerJobId: string): string {
  return `ai-media-job:${userId}:${providerJobId}`;
}

async function lockJob(tx: any, userId: string, providerJobId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${jobLockKey(userId, providerJobId)}, 0))`);
}

export async function createAiMediaJob(userId: string, providerJobId: string): Promise<AiMediaJob> {
  const [job] = await db.insert(aiMediaJobs).values({
    userId,
    providerJobId,
    status: "pending",
  }).returning();
  if (!job) throw new Error("Unable to persist AI media job");
  return job;
}

export async function getAiMediaJob(userId: string, providerJobId: string): Promise<AiMediaJob | undefined> {
  const [job] = await db.select()
    .from(aiMediaJobs)
    .where(and(eq(aiMediaJobs.userId, userId), eq(aiMediaJobs.providerJobId, providerJobId)))
    .limit(1);
  return job;
}

export async function markAiMediaJobFailed(userId: string, providerJobId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockJob(tx, userId, providerJobId);
    const [job] = await tx.select()
      .from(aiMediaJobs)
      .where(and(eq(aiMediaJobs.userId, userId), eq(aiMediaJobs.providerJobId, providerJobId)))
      .limit(1);
    if (!job || job.status === "completed") return false;
    if (job.status === "failed") return true;
    await tx.update(aiMediaJobs)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(aiMediaJobs.id, job.id));
    return true;
  });
}

/**
 * The durable job-state change and the debit share one transaction. The
 * advisory lock makes repeat/concurrent polls observe the completed row rather
 * than creating another debit.
 */
export async function completeAiMediaJob(options: CompletionOptions): Promise<AiMediaJobCompletion> {
  return db.transaction(async (tx) => {
    await lockJob(tx, options.userId, options.providerJobId);
    const [job] = await tx.select()
      .from(aiMediaJobs)
      .where(and(
        eq(aiMediaJobs.userId, options.userId),
        eq(aiMediaJobs.providerJobId, options.providerJobId),
      ))
      .limit(1);
    if (!job) return { status: "not_found" };
    if (job.status === "failed") return { status: "failed" };
    if (job.status === "completed") {
      return {
        status: "completed",
        cachedResultUrl: job.cachedResultUrl || options.cachedResultUrl,
        newlySettled: false,
      };
    }

    let consumption: AiCreditConsumptionResult | undefined;
    if (options.adminBypass) {
      await tx.insert(aiUsage).values({
        userId: options.userId,
        type: "avatar",
        creditsUsed: 1,
        cost: 0,
      });
    } else {
      consumption = await consumeAiCreditAtomicInTransaction(
        tx,
        options.userId,
        "avatar",
        options.freeCredits,
        options.walletPriceEGP,
        options.description,
      );
      if (!consumption.consumed) return { status: "insufficient", consumption };
    }

    await tx.update(aiMediaJobs)
      .set({
        status: "completed",
        cachedResultUrl: options.cachedResultUrl,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiMediaJobs.id, job.id));
    return {
      status: "completed",
      cachedResultUrl: options.cachedResultUrl,
      newlySettled: true,
      consumption,
    };
  });
}

// The main startup owner may call this for disposable development databases;
// production must use migrations/0010_ai_media_jobs.sql.
export async function ensureAiMediaJobsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_media_jobs (
      id serial PRIMARY KEY,
      provider_job_id varchar(200) NOT NULL UNIQUE,
      user_id varchar NOT NULL REFERENCES users(id),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
      cached_result_url text,
      completed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_media_jobs_user_created_idx
      ON ai_media_jobs(user_id, created_at DESC)
  `);
}