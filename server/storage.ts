import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { jobs, type Job, type InsertJob } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";

// On Railway, /data is a mounted persistent volume — files written there survive
// deploys and restarts. Locally (and anywhere /data doesn't exist), fall back to
// a plain file in the working directory so local dev keeps working unchanged.
const DB_DIR = fs.existsSync("/data") ? "/data" : ".";
const DB_PATH = path.join(DB_DIR, "acm.db");

const sqlite = new Database(DB_PATH);
// WAL mode lets reads and writes happen concurrently instead of taking a
// full-database lock on every write. Without this, multiple users running
// jobs at the same time risk "database is locked" errors under concurrent
// load. This is a durable per-database setting (persists in the file itself)
// but must be set once per connection, so both storage.ts and kb.ts set it
// against the same underlying acm.db file.
sqlite.pragma("journal_mode = WAL");
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
  getRecentJobs(limit?: number): Job[];
  getRecentFailedJobs(limit?: number): Job[];
  getJobCountsSince(sinceMs: number): { total: number; failed: number; completed: number };
  getDailyJobCounts(days: number): { date: string; jobs: number; pages: number; failed: number }[];
  backupTo(destPath: string): Promise<void>;
}

export class Storage implements IStorage {
  // Uses SQLite's native online backup API (safe to run against a live,
  // actively-written WAL-mode database) to write a consistent snapshot to
  // destPath, rather than copying the raw file which could catch a
  // mid-write/mid-checkpoint state.
  backupTo(destPath: string): Promise<void> {
    return sqlite.backup(destPath).then(() => {});
  }
  createJob(job: InsertJob): Job {
    return db.insert(jobs).values(job).returning().get();
  }
  getJob(id: number): Job | undefined {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
  updateJob(id: number, updates: Partial<Job>): Job | undefined {
    return db.update(jobs).set(updates).where(eq(jobs.id, id)).returning().get();
  }
  getRecentJobsForUser(clerkUserId: string, limit = 50): Job[] {
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
  getRecentJobs(limit = 50): Job[] {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit).all();
  }
  getRecentFailedJobs(limit = 50): Job[] {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .all();
  }
  getJobCountsSince(sinceMs: number): { total: number; failed: number; completed: number } {
    const all = db.select().from(jobs).all().filter((j) => j.createdAt >= sinceMs);
    return {
      total: all.length,
      failed: all.filter((j) => j.status === "failed").length,
      completed: all.filter((j) => j.status === "completed").length,
    };
  }
  getDailyJobCounts(days: number): { date: string; jobs: number; pages: number; failed: number }[] {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const all = db.select().from(jobs).all().filter((j) => j.createdAt >= sinceMs);
    const byDate = new Map<string, { jobs: number; pages: number; failed: number }>();
    for (const j of all) {
      const d = new Date(j.createdAt).toISOString().slice(0, 10);
      const entry = byDate.get(d) || { jobs: 0, pages: 0, failed: 0 };
      entry.jobs++;
      entry.pages += j.pageCount || 0;
      if (j.status === "failed") entry.failed++;
      byDate.set(d, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const storage = new Storage();
