import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureReportingPeriod, gaReportingBoundary } from "./reportingPeriod";
import { SimulationUsageStore } from "./simulationUsage";

test("reporting start is saved once and never deletes existing records", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE history (value TEXT); INSERT INTO history VALUES ('keep')");
  assert.equal(ensureReportingPeriod(db, 1000), 1000);
  assert.equal(ensureReportingPeriod(db, 9000), 1000);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM history").get() as any).n, 1);
  db.close();
});

test("GA4 boundary excludes the partial reset minute and limits realtime to the period", () => {
  const start = Date.parse("2026-10-15T20:05:23Z");
  const immediate = gaReportingBoundary(start, start);
  assert.equal(immediate.dimensionFilter.filter.numericFilter.value.int64Value, "202610151306");
  assert.equal(immediate.realtimeMinutes, -1);
  assert.equal(gaReportingBoundary(start, Date.parse("2026-10-15T20:06:00Z")).realtimeMinutes, 0);
  assert.equal(gaReportingBoundary(start, start + 3600000).realtimeMinutes, 29);
  const winter = gaReportingBoundary(Date.parse("2026-12-15T08:00:00Z"));
  assert.equal(winter.dimensionFilter.filter.numericFilter.value.int64Value, "202612150000");
});

test("simulator reset is a filter, not deletion, and every metric respects it", () => {
  const db = new Database(":memory:");
  const store = new SimulationUsageStore(db);
  const now = Date.now();
  const run = { runId: randomUUID(), fileType: "PDF" as const, source: "homepage" as const, event: "playback" as const };
  store.record(run, now - 1000);
  const empty = store.summary(now, now);
  assert.equal(empty.today, 0); assert.equal(empty.last7Days, 0); assert.equal(empty.last30Days, 0);
  assert.equal(empty.playback30d, 0); assert.equal(empty.recent.length, 0);
  store.record({ ...run, runId: randomUUID(), fileType: "DOCX", event: "failed" }, now);
  const fresh = store.summary(now, now);
  assert.equal(fresh.failed30d, 1); assert.equal(fresh.docx30d, 1); assert.equal(fresh.pdf30d, 0);
  assert.equal(fresh.completed30d, 0); assert.equal(fresh.recent.length, 1);
  assert.equal(store.summary(now).last30Days, 2);
  db.close();
});

test("storage filters jobs, costs, failures, charts, checker and visitors without losing history", async t => {
  // Never run a fixture test against a mounted persistent production volume.
  if (existsSync("/data")) { t.skip("Persistent volume present"); return; }
  const previous = process.cwd();
  const temp = await mkdtemp(path.join(tmpdir(), "remedy-report-period-"));
  process.chdir(temp);
  try {
    const { storage, reportingStartedAt } = await import("./storage");
    const old = reportingStartedAt - 1000;
    const fresh = reportingStartedAt;
    const oldJob = storage.createJob({ type: "PDF", status: "completed", createdAt: old, inputTokens: 100, outputTokens: 20, pageCount: 5, creditsUsed: 5 });
    storage.createJob({ type: "PDF", status: "failed", createdAt: old });
    storage.createCheckerUsage({ fileName: "old.pdf", fileType: "PDF", status: "completed", createdAt: old });
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    storage.createLikelyHumanVisit({ visitorIdHash: "old-period", visitDate: day, firstPath: "/", createdAt: old });
    assert.equal(storage.getRecentJobs(20, fresh).length, 0);
    assert.equal(storage.getCostSummary(fresh).totalJobs, 0);
    assert.equal(storage.getJobCountsSince(fresh).total, 0);
    assert.equal(storage.getDailyJobCounts(14, fresh).length, 0);
    assert.equal(storage.getCheckerUsageSummary(fresh).last90Days, 0);
    assert.equal(storage.getLikelyHumanVisitSummary(fresh).today, 0);
    storage.createJob({ type: "PDF", status: "completed", createdAt: fresh, inputTokens: 7, outputTokens: 8, pageCount: 1 });
    storage.createJob({ type: "PDF", status: "failed", createdAt: fresh });
    storage.createCheckerUsage({ fileName: "new.docx", fileType: "DOCX", status: "failed", createdAt: fresh });
    storage.createLikelyHumanVisit({ visitorIdHash: "new-period", visitDate: day, firstPath: "/", createdAt: fresh });
    assert.equal(storage.getRecentJobs(20, fresh).length, 2);
    assert.equal(storage.getRecentFailedJobs(20, fresh).length, 1);
    assert.equal(storage.getCostSummary(fresh).totalInputTokens, 7);
    assert.equal(storage.getJobCountsSince(fresh).failed, 1);
    assert.equal(storage.getDailyJobCounts(14, fresh).reduce((sum, d) => sum + d.jobs, 0), 2);
    const checker = storage.getCheckerUsageSummary(fresh);
    assert.equal(checker.last30Days, 1); assert.equal(checker.failed, 1); assert.equal(checker.completed, 0); assert.equal(checker.recent.length, 1);
    const visitors = storage.getLikelyHumanVisitSummary(fresh);
    assert.equal(visitors.today, 1); assert.equal(visitors.last7Days, 1); assert.equal(visitors.lastHour, 1);
    assert.equal(storage.getRecentJobs().length, 4);
    assert.equal(storage.getCheckerUsageSummary().last90Days, 2);
    assert.equal(storage.getLikelyHumanVisitSummary().today, 2);
    assert.equal(storage.getJob(oldJob.id)?.creditsUsed, 5);
  } finally {
    process.chdir(previous);
    await rm(temp, { recursive: true, force: true });
  }
});

test("dashboard wiring scopes reports but leaves live billing/account totals intact", async () => {
  const source = await readFile(new URL("./routes.ts", import.meta.url), "utf8");
  assert.match(source, /getGoogleAnalytics\(reportingStartedAt\)/);
  assert.match(source, /getCheckerUsageSummary\(reportingStartedAt\)/);
  assert.match(source, /getLikelyHumanVisitSummary\(reportingStartedAt\)/);
  assert.match(source, /simulationUsageStore\.summary\(now, reportingStartedAt\)/);
  assert.match(source, /totalUsers: allUsers\.length/);
  assert.match(source, /stripe\.subscriptions\.list/);
});
