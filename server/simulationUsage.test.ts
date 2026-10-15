import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import express from "express";
import { randomUUID } from "node:crypto";
import { SimulationUsageStore, registerSimulationUsage } from "./simulationUsage";
import { simulationUsageEventSchema } from "../shared/simulationUsage";
import { createSimulationUsage } from "../client/src/features/screen-reader-simulation/lib/usage";
import { createAdminAuthMiddleware } from "./adminAuth";
import { readFile } from "node:fs/promises";

const sample = () => ({ runId: randomUUID(), fileType: "PDF" as const, source: "homepage" as const, event: "completed" as const });

test("counts one run, repeated playback once, rejects conflicting replay", () => {
  const db = new Database(":memory:");
  const store = new SimulationUsageStore(db);
  const e = sample();
  store.record(e);
  store.record(e);
  store.record({ ...e, event: "playback" });
  store.record({ ...e, event: "playback" });
  store.record({ ...e, event: "failed" });
  store.record({ ...e, fileType: "DOCX" });
  const s = store.summary();
  assert.equal(s.last30Days, 1);
  assert.equal(s.playback30d, 1);
  assert.equal(s.completed30d, 1);
  assert.equal(s.failed30d, 0);
  assert.equal(s.pdf30d, 1);
  db.close();
});

test("out of order playback does not duplicate a run", () => {
  const db = new Database(":memory:"); const store = new SimulationUsageStore(db);
  const e = sample();
  store.record({ ...e, event: "playback" }); store.record(e);
  assert.equal(store.summary().last30Days, 1);
  assert.equal(store.summary().playback30d, 1);
  db.close();
});

test("Pacific day, rolling windows, failures, types and retention", () => {
  const db = new Database(":memory:"); const store = new SimulationUsageStore(db);
  const now = Date.parse("2026-10-15T07:30:00Z");
  store.record(sample(), now - 91 * 86400000);
  store.record(sample(), now - 31 * 86400000);
  store.record(sample(), now - 8 * 86400000);
  store.record(sample(), now - 3600000); // previous Pacific day
  store.record({ ...sample(), fileType: "DOCX", event: "failed", source: "simulation-page" }, now);
  const s = store.summary(now);
  assert.equal(s.today, 1); assert.equal(s.last7Days, 2); assert.equal(s.last30Days, 3);
  assert.equal(s.failed30d, 1); assert.equal(s.docx30d, 1); assert.equal(s.recent.length, 4);
  assert.equal(s.recent[0].source, "simulation-page");
  db.close();
});

test("event schema refuses document information and unsupported types", () => {
  for (const extra of [{ filename: "private.pdf" }, { text: "private" }, { audio: "bytes" }, { email: "a@b.test" }, { fileType: "PPTX" }]) {
    assert.equal(simulationUsageEventSchema.safeParse({ ...sample(), ...extra }).success, false);
  }
});

test("endpoint validates origin, bots, payload and rate limits", async () => {
  const db = new Database(":memory:"); const store = new SimulationUsageStore(db);
  const app = express(); app.use(express.json()); registerSimulationUsage(app, store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address() as { port: number };
  const post = (body: unknown, headers = {}) => fetch(`http://127.0.0.1:${address.port}/api/simulation-usage`, {
    method: "POST", headers: { "Content-Type": "application/json", origin: "https://remedy508.com", "user-agent": "UsageTest", ...headers }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await post(sample(), { origin: "https://evil.test" })).status, 403);
    assert.equal((await post(sample(), { "user-agent": "HeadlessChrome" })).status, 204);
    assert.equal(store.summary().last30Days, 0);
    assert.equal((await post({ ...sample(), filename: "secret.pdf" })).status, 400);
    const e = sample();
    assert.equal((await post(e)).status, 204);
    for (let i = 0; i < 120; i++) await post(e);
    assert.equal((await post(e)).status, 429);
    assert.equal(store.summary().last30Days, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    db.close();
  }
});

test("client emits metadata only, deduplicates Play and excludes QA/admin/local", () => {
  const original = { location: Object.getOwnPropertyDescriptor(globalThis, "location"), navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch };
  const calls: any[] = [];
  const setup = (host = "remedy508.com", search = "", webdriver = false) => {
    Object.defineProperty(globalThis, "location", { configurable: true, value: { hostname: host, search } });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { webdriver, userAgent: "UsageTest" } });
  };
  try {
    setup();
    globalThis.fetch = ((_url: unknown, init: any) => { calls.push(JSON.parse(init.body)); return Promise.resolve(new Response(null, { status: 204 })); }) as typeof fetch;
    const file = { name: "private-name.docx", type: "" } as File;
    const report = createSimulationUsage(file, false, false);
    report("completed"); report("playback"); report("playback");
    assert.equal(calls.length, 2);
    assert.deepEqual(Object.keys(calls[0]).sort(), ["event", "fileType", "runId", "source"]);
    assert.equal(calls[0].source, "simulation-page"); assert.equal(calls[0].fileType, "DOCX");
    createSimulationUsage(file, true, true)("completed");
    setup("localhost"); createSimulationUsage(file, true, false)("completed");
    setup("remedy508.com", "?qa=1"); createSimulationUsage(file, true, false)("completed");
    setup("remedy508.com", "?test=1"); createSimulationUsage(file, true, false)("completed");
    setup("remedy508.com", "", true); createSimulationUsage(file, true, false)("completed");
    assert.equal(calls.length, 2);
    setup();
    globalThis.fetch = (() => { throw new Error("blocked"); }) as typeof fetch;
    assert.doesNotThrow(() => createSimulationUsage(file, true, false)("completed"));
  } finally {
    globalThis.fetch = original.fetch;
    for (const key of ["location", "navigator"] as const) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]!);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("simulation summary stays behind the existing admin-only dashboard", async () => {
  const source = await readFile(new URL("./routes.ts", import.meta.url), "utf8");
  assert.match(source, /app\.get\("\/api\/admin\/dashboard",\s*requireAdmin,/);
  const db = new Database(":memory:"); const store = new SimulationUsageStore(db);
  const app = express();
  const auth = createAdminAuthMiddleware({
    secretKey: "test-only",
    adminEmail: "owner@example.test",
    verifyClerkToken: async token => {
      if (token === "owner" || token === "member") return { sub: token };
      throw new Error("Invalid");
    },
    getUser: async id => ({
      primaryEmailAddressId: "email",
      emailAddresses: [{ id: "email", emailAddress: id === "owner" ? "owner@example.test" : "member@example.test" }],
    }),
  });
  app.get("/api/admin/dashboard", auth, (_req, res) => res.json({ simulationUsage: store.summary() }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/dashboard`;
  try {
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await fetch(url, { headers: { Authorization: "Bearer member" } })).status, 404);
    assert.equal((await fetch(url, { headers: { Authorization: "Bearer owner" } })).status, 200);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    db.close();
  }
});
