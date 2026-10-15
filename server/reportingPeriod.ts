import type Database from "better-sqlite3";

// A one-time, owner-approved reporting period, not a reset on every deployment.
const PERIOD_KEY = "admin-activity-fresh-start-2026-10-15";
export function ensureReportingPeriod(db: Database.Database, now = Date.now()): number {
  db.exec("CREATE TABLE IF NOT EXISTS reporting_periods (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL)");
  db.prepare("INSERT OR IGNORE INTO reporting_periods (id, started_at) VALUES (?, ?)").run(PERIOD_KEY, now);
  return (db.prepare("SELECT started_at FROM reporting_periods WHERE id = ?").get(PERIOD_KEY) as { started_at: number }).started_at;
}

// GA4 dimensions have minute precision. Skip the partial reset minute rather
// than accidentally including activity from before the new period.
export function gaReportingBoundary(startedAt: number, now = Date.now(), timeZone = "America/Los_Angeles") {
  const minuteStart = Math.ceil(startedAt / 60000) * 60000;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(minuteStart));
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const dateHourMinute = ["year", "month", "day", "hour", "minute"].map(part).join("");
  return {
    minuteStart,
    dimensionFilter: { filter: {
      fieldName: "dateHourMinute",
      numericFilter: { operation: "GREATER_THAN_OR_EQUAL" as const, value: { int64Value: dateHourMinute } },
    } },
    realtimeMinutes: Math.min(29, Math.floor(now / 60000) - minuteStart / 60000),
  };
}
