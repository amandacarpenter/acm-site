import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { jobs, type Job, type InsertJob } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export interface IStorage {
  createJob(job: InsertJob): Job;
  getJob(id: number): Job | undefined;
  updateJob(id: number, updates: Partial<Job>): Job | undefined;
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
}

export const storage = new Storage();
