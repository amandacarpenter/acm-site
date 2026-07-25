import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { jobs, type Job, type InsertJob } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("acm.db");
const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input_name TEXT,
    result TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL
  )
`);

// Backfill new columns for existing databases (no-op if they already exist)
const existingCols = new Set(
  (sqlite.prepare("PRAGMA table_info(jobs)").all() as any[]).map((c) => c.name)
);
if (!existingCols.has("clerk_user_id")) {
  sqlite.exec(`ALTER TABLE jobs ADD COLUMN clerk_user_id TEXT`);
}
if (!existingCols.has("page_count")) {
  sqlite.exec(`ALTER TABLE jobs ADD COLUMN page_count INTEGER`);
}
if (!existingCols.has("credits_used")) {
  sqlite.exec(`ALTER TABLE jobs ADD COLUMN credits_used INTEGER`);
}
if (!existingCols.has("input_tokens")) {
  sqlite.exec(`ALTER TABLE jobs ADD COLUMN input_tokens INTEGER`);
}
if (!existingCols.has("output_tokens")) {
  sqlite.exec(`ALTER TABLE jobs ADD COLUMN output_tokens INTEGER`);
}

export interface CostSummary {
  totalJobs: number;
  totalPages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byType: Record<string, { jobs: number; pages: number; inputTokens: number; outputTokens: number }>;
}

export interface IStorage {
  createJob(job: InsertJob): Job;
  getJob(id: number): Job | undefined;
  updateJob(id: number, updates: Partial<Job>): Job | undefined;
  getRecentJobsForUser(clerkUserId: string, limit?: number): Job[];
  getCostSummary(sinceMs?: number): CostSummary;
}

export class Storage implements IStorage {
  createJob(job: InsertJob): Job {
    return db.insert(jobs).values(job).returning().get();
  }
  getJob(id: number): Job | undefined {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
  updateJob(id: number, updates: Partial<Job>): Job | undefined {
    return db.update(jobs).set(updates).where(eq(jobs.id, id)).returning().get();
  }
  getRecentJobsForUser(clerkUserId: string, limit = 15): Job[] {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.clerkUserId, clerkUserId))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .all();
  }
  // Aggregates real logged token usage (not estimates) across all jobs, so
  // actual $/page cost can be computed from ground-truth Anthropic usage data
  // captured at job-completion time. Pass sinceMs to scope to a date range.
  getCostSummary(sinceMs?: number): CostSummary {
    const all = sinceMs
      ? db.select().from(jobs).where(eq(jobs.status, "completed")).all().filter((j) => j.createdAt >= sinceMs)
      : db.select().from(jobs).where(eq(jobs.status, "completed")).all();
    const summary: CostSummary = { totalJobs: 0, totalPages: 0, totalInputTokens: 0, totalOutputTokens: 0, byType: {} };
    for (const j of all) {
      if (j.inputTokens == null && j.outputTokens == null) continue; // skip jobs logged before this tracking existed
      summary.totalJobs++;
      summary.totalPages += j.pageCount || 0;
      summary.totalInputTokens += j.inputTokens || 0;
      summary.totalOutputTokens += j.outputTokens || 0;
      const t = summary.byType[j.type] || { jobs: 0, pages: 0, inputTokens: 0, outputTokens: 0 };
      t.jobs++;
      t.pages += j.pageCount || 0;
      t.inputTokens += j.inputTokens || 0;
      t.outputTokens += j.outputTokens || 0;
      summary.byType[j.type] = t;
    }
    return summary;
  }
}

export const storage = new Storage();
