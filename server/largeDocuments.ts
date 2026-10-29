import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Express, RequestHandler } from "express";
import multer from "multer";
import type { LargeDocumentJob } from "../shared/largeDocuments";
const exec = promisify(execFile);
const TTL = 24 * 60 * 60_000;
type Saved = LargeDocumentJob & { owner: string; fingerprint: string; fake: boolean; model: string };
export type LargeConfig = { root: string; pipeline: string; model: string; fake?: boolean; python?: string; chunkSize?: number; ttl?: number };

/** A separate, bounded test queue. No app DB or live credit mutations. */
export class LargeDocuments {
  private jobs = new Map<string, Saved>();
  private pending: string[] = [];
  private active?: string;
  private closed = false;
  private admissions = new Map<string, Promise<LargeDocumentJob>>();
  private child?: ReturnType<typeof spawn>;
  private timer: ReturnType<typeof setInterval>;
  constructor(readonly config: LargeConfig) {
    fs.mkdirSync(config.root, { recursive: true, mode: 0o700 });
    for (const name of fs.readdirSync(config.root)) {
      if (!/^ld_[a-f0-9-]{36}$/.test(name)) continue;
      try {
        const record: Saved = JSON.parse(fs.readFileSync(path.join(config.root, name, "job.json"), "utf8"));
        if (record.id !== name) continue;
        if (["queued", "processing"].includes(record.state)) {
          record.state = "interrupted"; record.stage = "Saved progress is ready to resume";
        }
        this.jobs.set(name, record); this.save(record);
      } catch { /* Ignore incomplete admission; never interpret arbitrary paths. */ }
    }
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), 60_000); this.timer.unref();
  }
  private dir(id: string) { return path.join(this.config.root, id); }
  private save(job: Saved) {
    const target = path.join(this.dir(job.id), "job.json");
    fs.writeFileSync(target + ".pending", JSON.stringify(job), { mode: 0o600 });
    fs.renameSync(target + ".pending", target);
  }
  private public(job: Saved): LargeDocumentJob {
    const { owner, fingerprint, fake, model, ...result } = job;
    return result;
  }
  status(id: string, owner: string) {
    this.cleanup(); const job = this.jobs.get(id);
    return job?.owner === owner ? this.public(job) : null;
  }
  list(owner: string) {
    this.cleanup();
    return Array.from(this.jobs.values()).filter(j => j.owner === owner).sort((a,b) => b.createdAt-a.createdAt).map(j => this.public(j));
  }
  async create(owner: string, filename: string, mode: "pdf" | "docx", bytes: Buffer) {
    this.cleanup();
    if (this.closed) throw new Error("Test worker is restarting");
    if (bytes.length > 25 * 1024 * 1024 || !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")))
      throw new Error("Please upload a PDF no larger than 25 MB.");
    const fingerprint = createHash("sha256").update(bytes).update(mode).update(this.config.model).update(String(this.config.fake)).update("large-docs-test-v2-c72ecc97").digest("hex");
    const existing = Array.from(this.jobs.values()).find(j => j.owner === owner && j.fingerprint === fingerprint);
    if (existing) return this.public(existing);
    const key = owner + ":" + fingerprint;
    if (this.admissions.has(key)) return this.admissions.get(key)!;
    if (this.jobs.size + this.admissions.size >= 8 || this.pending.length + this.admissions.size >= 4)
      throw new Error("The test queue is full. Remove a finished test or try later.");
    const admission = this.admit(owner, filename, mode, bytes, fingerprint);
    this.admissions.set(key, admission);
    try { return await admission; } finally { this.admissions.delete(key); }
  }
  private async admit(owner: string, filename: string, mode: "pdf" | "docx", bytes: Buffer, fingerprint: string) {
    const id = "ld_" + randomUUID(); fs.mkdirSync(this.dir(id), { mode: 0o700 });
    const source = path.join(this.dir(id), "source.pdf");
    fs.writeFileSync(source, bytes, { mode: 0o600 });
    try {
      const { stdout } = await exec(this.config.python || "python3", [path.join(this.config.pipeline, "large_document_worker.py"), "inspect", source], { timeout: 30_000, maxBuffer: 1024 * 1024 });
      const totalPages = JSON.parse(stdout).pages;
      const now = Date.now();
      const job: Saved = { id, owner, fingerprint, mode, filename: path.basename(filename).replace(/[<>\"&\x00-\x1F]/g, "").slice(0, 160),
        totalPages, completedPages: 0, progress: 0, state: "queued", stage: "Waiting to start",
        createdAt: now, expiresAt: now + (this.config.ttl || TTL), fake: Boolean(this.config.fake), model: this.config.model };
      this.jobs.set(id, job); this.save(job); this.pending.push(id); this.drain();
      return this.public(job);
    } catch (error: any) {
      fs.rmSync(this.dir(id), { recursive: true, force: true });
      let detail = "Unable to read this PDF. Check that it is unlocked and valid.";
      try { detail = JSON.parse(error.stdout.trim()).error || detail; } catch {}
      throw new Error(detail);
    }
  }
  private drain(): void {
    if (this.active || this.closed) return;
    const id = this.pending.shift(); if (!id) return;
    const job = this.jobs.get(id); if (!job) return this.drain();
    this.active = id; job.state = "processing"; job.stage = "Reading your document"; job.error = undefined; this.save(job);
    const child = spawn(this.config.python || "python3", [path.join(this.config.pipeline, "large_document_worker.py"), this.dir(id)], {
      stdio: ["pipe", "pipe", "pipe"], timeout: 4 * 60 * 60_000, killSignal: "SIGTERM", detached: process.platform !== "win32",
    });
    this.child = child; let pending = "", detail = "", structuredError = "";
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ title: job.filename.replace(/\.pdf$/i, ""), mode: job.mode, fake: job.fake,
      model: job.model, chunkSize: this.config.chunkSize || 20 }));
    child.stdout.on("data", (data: Buffer) => {
      pending += data.toString();
      const lines = pending.split("\n"); pending = lines.pop() || "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.error) { structuredError = String(event.error); continue; }
          if (Number.isFinite(event.completedPages)) job.completedPages = Math.max(job.completedPages, Math.min(job.totalPages, event.completedPages));
          job.progress = event.ready ? 100 : event.assembling ? 95 : Math.min(90, Math.floor(90 * job.completedPages / job.totalPages));
          if (event.stage) job.stage = String(event.stage).slice(0, 160);
          this.save(job);
        } catch { /* Only structured worker events may change status. */ }
      }
    });
    child.stderr.on("data", (data: Buffer) => { detail = (detail + data.toString()).slice(-3000); });
    child.on("error", error => { detail = error.message; });
    child.on("close", code => {
      this.active = undefined; this.child = undefined;
      if (this.closed) return;
      if (code === 0 && fs.existsSync(path.join(this.dir(id), "result." + job.mode))) {
        job.state = "ready"; job.stage = "Ready to download"; job.progress = 100;
      } else if (code === 3) {
        job.state = "paused"; job.stage = "Progress saved";
      } else {
        job.state = "failed"; job.stage = "Progress saved; processing stopped";
        job.error = (structuredError || detail.split("\n").filter(Boolean).pop() || "Processing stopped. Resume to retry from saved progress.").slice(0, 500);
      }
      job.expiresAt = Date.now() + (this.config.ttl || TTL); this.save(job); this.drain();
    });
  }
  pause(id: string, owner: string) {
    const job = this.jobs.get(id); if (job?.owner !== owner) return null;
    if (job.state === "processing") {
      fs.writeFileSync(path.join(this.dir(id), "pause.flag"), "", { mode: 0o600 });
      job.stage = "Pausing after the current pages finish";
    } else if (job.state === "queued") {
      this.pending = this.pending.filter(x => x !== id); job.state = "paused"; job.stage = "Progress saved";
    }
    this.save(job); return this.public(job);
  }
  resume(id: string, owner: string) {
    const job = this.jobs.get(id); if (job?.owner !== owner) return null;
    if (["paused", "failed", "interrupted"].includes(job.state)) {
      fs.rmSync(path.join(this.dir(id), "pause.flag"), { force: true });
      job.state = "queued"; job.error = undefined; job.stage = "Resuming saved progress";
      job.expiresAt = Date.now() + (this.config.ttl || TTL);
      this.save(job); this.pending.push(id); this.drain();
    }
    return this.public(job);
  }
  result(id: string, owner: string) {
    this.cleanup();
    const job = this.jobs.get(id);
    if (job?.owner !== owner || job.state !== "ready") return null;
    return { path: path.join(this.dir(id), "result." + job.mode), filename: job.filename.replace(/\.pdf$/i, "") +
      (job.fake ? "-WORKFLOW-TEST." : "-accessible-test.") + job.mode };
  }
  remove(id: string, owner: string) {
    const job = this.jobs.get(id); if (job?.owner !== owner) return false;
    if (job.state === "processing") throw new Error("Pause this test before removing its files.");
    this.pending = this.pending.filter(x => x !== id); this.jobs.delete(id);
    fs.rmSync(this.dir(id), { recursive: true, force: true }); return true;
  }
  cleanup() {
    for (const job of Array.from(this.jobs.values())) if (job.expiresAt < Date.now() && !["processing", "queued"].includes(job.state)) this.remove(job.id, job.owner);
  }
  close() {
    this.closed = true; clearInterval(this.timer);
    if (this.child?.pid) {
      try { process.platform === "win32" ? this.child.kill("SIGTERM") : process.kill(-this.child.pid, "SIGTERM"); } catch {}
    }
  }
}

export function registerLargeDocuments(app: Express, config: LargeConfig, auth: RequestHandler) {
  const manager = new LargeDocuments(config);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  const base = "/api/large-docs";
  app.use(base, auth, (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get(base + "/config", (_req, res) => res.json({ maxPages: 400, maxMegabytes: 25, retentionHours: 24, workflowTest: Boolean(config.fake) }));
  app.get(base + "/jobs", (_req, res) => res.json({ jobs: manager.list(res.locals.largeDocumentOwner) }));
  app.post(base + "/jobs", (req, res) => {
    upload.single("file")(req, res, async error => {
      if (error) return void res.status(413).json({ error: "Upload one PDF no larger than 25 MB." });
      if (!req.file || !["pdf", "docx"].includes(req.body.mode)) return void res.status(400).json({ error: "Choose a PDF and an output format." });
      try { res.status(202).json({ job: await manager.create(res.locals.largeDocumentOwner, req.file.originalname, req.body.mode, req.file.buffer) }); }
      catch (e: any) { res.status(400).json({ error: e.message }); }
    });
  });
  app.get(base + "/jobs/:id", (req, res) => {
    const job = manager.status(String(req.params.id), res.locals.largeDocumentOwner);
    if (!job) return void res.status(404).json({ error: "Test not found or expired." });
    res.json({ job });
  });
  for (const action of ["pause", "resume"] as const) app.post(base + "/jobs/:id/" + action, (req, res) => {
    const job = manager[action](String(req.params.id), res.locals.largeDocumentOwner);
    if (!job) return void res.status(404).json({ error: "Test not found." });
    res.json({ job });
  });
  app.get(base + "/jobs/:id/result", (req, res) => {
    const result = manager.result(String(req.params.id), res.locals.largeDocumentOwner);
    if (!result) return void res.status(404).json({ error: "Output is not ready or has expired." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.download(result.path, result.filename);
  });
  app.delete(base + "/jobs/:id", (req, res) => {
    try {
      if (!manager.remove(String(req.params.id), res.locals.largeDocumentOwner)) return void res.status(404).json({ error: "Test not found." });
      res.json({ removed: true });
    } catch (e: any) { res.status(409).json({ error: e.message }); }
  });
  return manager;
}
