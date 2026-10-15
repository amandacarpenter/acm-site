import type Database from "better-sqlite3";
import type { Express } from "express";
import { simulationUsageEventSchema, type SimulationUsageEvent, type SimulationUsageSummary } from "../shared/simulationUsage";

const DAY = 86400000;
const localDay = (ms: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
}).format(ms);

export class SimulationUsageStore {
  constructor(private db: Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS simulation_usage (
      run_id TEXT PRIMARY KEY, file_type TEXT NOT NULL, source TEXT NOT NULL,
      status TEXT NOT NULL, played INTEGER NOT NULL DEFAULT 0,
      local_day TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS simulation_usage_created ON simulation_usage(created_at);`);
  }
  record(event: SimulationUsageEvent, now = Date.now()) {
    this.db.prepare("DELETE FROM simulation_usage WHERE created_at < ?").run(now - 90 * DAY);
    // A random ID represents one document run, not a visitor. Replays/retries
    // update that run instead of inflating totals. No document data is accepted.
    this.db.prepare(`INSERT INTO simulation_usage
      (run_id, file_type, source, status, played, local_day, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET played = MAX(played, excluded.played)
      WHERE file_type = excluded.file_type AND source = excluded.source AND status = excluded.status
    `).run(event.runId, event.fileType, event.source,
      event.event === "failed" ? "failed" : "completed",
      event.event === "playback" ? 1 : 0, localDay(now), now);
  }
  summary(now = Date.now(), sinceMs = 0): SimulationUsageSummary {
    this.db.prepare("DELETE FROM simulation_usage WHERE created_at < ?").run(now - 90 * DAY);
    const count = (where: string, ...args: (string | number)[]) =>
      (this.db.prepare(`SELECT COUNT(*) AS n FROM simulation_usage WHERE created_at >= ? AND (${where})`).get(sinceMs, ...args) as { n: number }).n;
    const cutoff = now - 30 * DAY;
    return {
      today: count("local_day = ?", localDay(now)),
      last7Days: count("created_at >= ?", now - 7 * DAY),
      last30Days: count("created_at >= ?", cutoff),
      completed30d: count("created_at >= ? AND status = 'completed'", cutoff),
      failed30d: count("created_at >= ? AND status = 'failed'", cutoff),
      playback30d: count("created_at >= ? AND played = 1", cutoff),
      pdf30d: count("created_at >= ? AND file_type = 'PDF'", cutoff),
      docx30d: count("created_at >= ? AND file_type = 'DOCX'", cutoff),
      recent: this.db.prepare(`SELECT run_id AS runId, file_type AS fileType, source,
        status, played, created_at AS createdAt FROM simulation_usage WHERE created_at >= ? ORDER BY created_at DESC LIMIT 20`)
        .all(sinceMs) as SimulationUsageSummary["recent"],
    };
  }
}

export function registerSimulationUsage(app: Express, store: SimulationUsageStore) {
  // Bounded, short-lived abuse protection; no raw IP is persisted.
  const buckets = new Map<string, { count: number; until: number }>();
  app.post("/api/simulation-usage", (req, res) => {
    const origin = req.get("origin");
    if (!origin || !["https://remedy508.com", "https://www.remedy508.com"].includes(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (/HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(req.get("user-agent") || "")) {
      return res.status(204).end();
    }
    const now = Date.now();
    buckets.forEach((bucket, ip) => { if (bucket.until <= now) buckets.delete(ip); });
    const ip = req.ip || "unknown";
    const bucket = buckets.get(ip) || { count: 0, until: now + 60000 };
    if (bucket.count >= 120 || (!buckets.has(ip) && buckets.size >= 10000)) {
      return res.status(429).json({ error: "Too many events" });
    }
    bucket.count++;
    buckets.set(ip, bucket);
    const parsed = simulationUsageEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid simulation event" });
    try {
      store.record(parsed.data);
      return res.status(204).end();
    } catch {
      return res.status(503).json({ error: "Usage recording unavailable" });
    }
  });
}
