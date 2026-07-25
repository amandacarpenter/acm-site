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

export interface IStorage {
  createJob(job: InsertJob): Job;
  getJob(id: number): Job | undefined;
  updateJob(id: number, updates: Partial<Job>): Job | undefined;
  getRecentJobsForUser(clerkUserId: string, limit?: number): Job[];
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
}

export const storage = new Storage();
