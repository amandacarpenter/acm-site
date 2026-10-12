import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { AsyncLocalStorage } from "node:async_hooks";
import type Database from "better-sqlite3";
import type { DocumentTaskStatus } from "../shared/schema";

export type DocumentTaskResult = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};
export const documentTaskContext = new AsyncLocalStorage<{ deadline: number }>();
type Row = {
  id: string; user_id: string; fingerprint: string; filename: string;
  mode: "pdf" | "docx"; state: DocumentTaskStatus["state"]; stage: string;
  error: string | null; created_at: number; updated_at: number; expires_at: number | null;
};
export class DocumentTaskError extends Error {
  constructor(message: string, public status = 503, public taskId?: string) { super(message); }
}

// An internal response sink, NOT an HTTP connection. The unchanged document
// handlers can finish even after the originating browser disconnects.
export class ProcessingResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  body: Buffer | null = null;
  locals: Record<string, any>;
  constructor(locals: Record<string, any>) { super(); this.locals = locals; }
  status(value: number) { this.statusCode = value; return this; }
  setHeader(name: string, value: unknown) { this.headers[name.toLowerCase()] = String(value); return this; }
  getHeader(name: string) { return this.headers[name.toLowerCase()]; }
  json(value: unknown) { this.setHeader("Content-Type", "application/json"); return this.send(Buffer.from(JSON.stringify(value))); }
  send(value: Buffer | string) {
    if (this.body !== null) throw new Error("Document response already completed");
    this.body = Buffer.isBuffer(value) ? value : Buffer.from(value);
    this.emit("finish");
    return this;
  }
  result(): DocumentTaskResult {
    if (!this.body) throw new Error("Document processing returned no output");
    return { status: this.statusCode, headers: this.headers, body: this.body };
  }
}

/** Single-instance bounded queue. SQLite stores only ownership/status metadata.
 * No bearer tokens or document contents are persisted. A restart marks jobs
 * interrupted rather than secretly rerunning AI or charging a second time.
 */
export class DocumentTasks {
  private pending: Array<{ id: string; bytes: number; work: (stage: (value: string) => void) => Promise<DocumentTaskResult> }> = [];
  private results = new Map<string, DocumentTaskResult>();
  private active = 0;
  private inputBytes = 0;
  private resultBytes = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  readonly ttlMs: number;
  constructor(private db: Database.Database, private options: {
    concurrency?: number; maxPending?: number; maxInputBytes?: number; maxResultBytes?: number;
    ttlMs?: number; now?: () => number; autoCleanup?: boolean;
  } = {}) {
    this.ttlMs = options.ttlMs ?? 15 * 60_000;
    db.exec(`CREATE TABLE IF NOT EXISTS document_tasks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
      filename TEXT NOT NULL, mode TEXT NOT NULL, state TEXT NOT NULL,
      stage TEXT NOT NULL, error TEXT, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, expires_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS document_tasks_owner ON document_tasks(user_id, created_at);`);
    const now = this.now();
    db.prepare(`UPDATE document_tasks SET state='interrupted', stage='Interrupted',
      error='Processing was interrupted by a server restart. Please contact support to check this attempt and its credits before resubmitting.',
      updated_at=?, expires_at=? WHERE state IN ('queued','processing')`).run(now, now + this.ttlMs);
    db.prepare(`UPDATE document_tasks SET state='expired', stage='Result no longer available',
      updated_at=? WHERE state='ready'`).run(now);
    this.cleanup();
    if (options.autoCleanup !== false) {
      this.timer = setInterval(() => this.cleanup(), 60_000);
      this.timer.unref();
    }
  }
  private now() { return this.options.now?.() ?? Date.now(); }
  close() { if (this.timer) clearInterval(this.timer); }
  private row(id: string, userId: string) {
    return this.db.prepare("SELECT * FROM document_tasks WHERE id=? AND user_id=?").get(id, userId) as Row | undefined;
  }
  private public(row: Row): DocumentTaskStatus {
    return { id: row.id, filename: row.filename, mode: row.mode, state: row.state, stage: row.stage,
      ...(row.error ? { error: row.error } : {}), createdAt: row.created_at, expiresAt: row.expires_at };
  }
  status(id: string, userId: string) {
    this.cleanup();
    const row = this.row(id, userId);
    return row ? this.public(row) : undefined;
  }
  latest(userId: string) {
    this.cleanup();
    const row = this.db.prepare(`SELECT * FROM document_tasks WHERE user_id=?
      AND (state IN ('queued','processing') OR expires_at>?) ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(userId, this.now()) as Row | undefined;
    return row ? this.public(row) : undefined;
  }
  result(id: string, userId: string) {
    const state = this.status(id, userId);
    return state?.state === "ready" ? this.results.get(id) : undefined;
  }
  enqueue(input: { userId: string; filename: string; mode: "pdf" | "docx"; buffer: Buffer; acknowledged: boolean },
    work: (stage: (value: string) => void) => Promise<DocumentTaskResult>) {
    this.cleanup();
    const fingerprint = createHash("sha256").update(input.buffer)
      .update(JSON.stringify([input.filename, input.mode, input.acknowledged])).digest("hex");
    // Retrying an upload after a lost acknowledgement must not duplicate AI or credits.
    const previous = this.db.prepare(`SELECT * FROM document_tasks WHERE user_id=? AND fingerprint=?
      AND (state IN ('queued','processing') OR (state='ready' AND expires_at>?))
      ORDER BY created_at DESC LIMIT 1`).get(input.userId, fingerprint, this.now()) as Row | undefined;
    if (previous) return this.public(previous);
    const existing = this.db.prepare("SELECT id FROM document_tasks WHERE user_id=? AND state IN ('queued','processing')").get(input.userId) as { id: string } | undefined;
    if (existing) throw new DocumentTaskError("You already have a document processing. Check its status before starting another.", 409, existing.id);
    if (this.active + this.pending.length >= (this.options.maxPending ?? 4) ||
        this.inputBytes + input.buffer.length > (this.options.maxInputBytes ?? 128 * 1024 * 1024) ||
        this.resultBytes >= (this.options.maxResultBytes ?? 128 * 1024 * 1024)) {
      throw new DocumentTaskError("Document processing is busy. Please try again shortly; this upload has not started.", 503);
    }
    const id = randomUUID(), now = this.now();
    this.db.prepare(`INSERT INTO document_tasks(id,user_id,fingerprint,filename,mode,state,stage,created_at,updated_at)
      VALUES (?,?,?,?,?,'queued','Waiting for a processing slot',?,?)`).run(id, input.userId, fingerprint, input.filename, input.mode, now, now);
    this.inputBytes += input.buffer.length;
    this.pending.push({ id, bytes: input.buffer.length, work });
    setImmediate(() => this.drain());
    return this.status(id, input.userId)!;
  }
  private drain() {
    while (this.active < (this.options.concurrency ?? 2) && this.pending.length) {
      const task = this.pending.shift()!;
      this.active++;
      this.db.prepare("UPDATE document_tasks SET state='processing',stage='Reading your document',updated_at=? WHERE id=?").run(this.now(), task.id);
      const stage = (value: string) => {
        this.db.prepare("UPDATE document_tasks SET stage=?,updated_at=? WHERE id=? AND state='processing'").run(value.slice(0, 200), this.now(), task.id);
        console.log("[DOCUMENT TASK]", task.id, value);
      };
      void (async () => {
        try {
          const result = await task.work(stage);
          if (result.status >= 400) {
            let message = "Document processing failed. Please report this attempt.";
            try { message = JSON.parse(result.body.toString()).error || message; } catch {}
            throw new Error(message);
          }
          // Admission bounds concurrent input; separately bound retained results.
          if (result.body.length > (this.options.maxResultBytes ?? 128 * 1024 * 1024)) {
            throw new Error("The generated result is too large to retain. Please contact support to check this attempt and its credits.");
          }
          while (this.resultBytes + result.body.length > (this.options.maxResultBytes ?? 128 * 1024 * 1024)) {
            const oldest = this.results.keys().next().value;
            if (!oldest) break;
            this.expire(oldest);
          }
          this.results.set(task.id, result);
          this.resultBytes += result.body.length;
          this.db.prepare("UPDATE document_tasks SET state='ready',stage='Ready to download',updated_at=?,expires_at=? WHERE id=?")
            .run(this.now(), this.now() + this.ttlMs, task.id);
          console.log("[DOCUMENT TASK]", task.id, "ready", result.body.length, "bytes");
        } catch (err) {
          this.db.prepare("UPDATE document_tasks SET state='failed',stage='Processing stopped',error=?,updated_at=?,expires_at=? WHERE id=?")
            .run((err instanceof Error ? err.message : "Document processing failed").slice(0, 700), this.now(), this.now() + this.ttlMs, task.id);
          console.error("[DOCUMENT TASK]", task.id, "failed", err instanceof Error ? err.message : "unknown");
        } finally {
          this.inputBytes -= task.bytes;
          this.active--;
          this.drain();
        }
      })();
    }
  }
  private expire(id: string) {
    const result = this.results.get(id);
    if (result) this.resultBytes -= result.body.length;
    this.results.delete(id);
    this.db.prepare("UPDATE document_tasks SET state='expired',stage='Result no longer available',updated_at=? WHERE id=? AND state='ready'").run(this.now(), id);
  }
  cleanup() {
    const expired = this.db.prepare("SELECT id FROM document_tasks WHERE state='ready' AND expires_at<=?").all(this.now()) as { id: string }[];
    for (const row of expired) this.expire(row.id);
    this.db.prepare("DELETE FROM document_tasks WHERE state NOT IN ('queued','processing') AND updated_at<?").run(this.now() - 7 * 86400_000);
  }
}
