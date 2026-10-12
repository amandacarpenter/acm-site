import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { DocumentTasks, DocumentTaskError, ProcessingResponse } from "../server/documentTasks";
import { TrialLedger, trialRequest, reserveTrialCredits, refundTrialRequest } from "../server/trialCredits";
import { readFileSync } from "node:fs";

let count = 0;
const ok = (name: string, check: () => void) => { check(); count++; console.log("PASS", name); };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const response = (body = "%PDF-fixture"): any => ({ status: 200, headers: { "content-type": "application/pdf" }, body: Buffer.from(body) });
const input = (userId: string, text = userId) => ({ userId, filename: `${text}.pdf`, mode: "pdf" as const, buffer: Buffer.from(text), acknowledged: false });

const db = new Database(":memory:");
let now = 1000;
const store = new DocumentTasks(db, { concurrency: 1, maxPending: 3, ttlMs: 1000, now: () => now, autoCleanup: false });
let release!: () => void;
let executions = 0;
const hold = new Promise<void>(resolve => { release = resolve; });
const a = store.enqueue(input("owner"), async stage => {
  executions++; stage("Analyzing page 1 of 2"); await hold; return response();
});
ok("submission returns queued job before processing", () => assert.equal(a.state, "queued"));
await tick();
ok("stage reflects actual worker activity", () => assert.equal(store.status(a.id, "owner")?.stage, "Analyzing page 1 of 2"));
ok("another account cannot read job status", () => assert.equal(store.status(a.id, "intruder"), undefined));
ok("another account cannot read cached result", () => assert.equal(store.result(a.id, "intruder"), undefined));
ok("duplicate pending upload reuses same job", () => assert.equal(store.enqueue(input("owner"), async () => response()).id, a.id));
ok("a different simultaneous upload from same user is rejected", () => assert.throws(() => store.enqueue(input("owner", "different"), async () => response()), (err: any) => err instanceof DocumentTaskError && err.status === 409 && err.taskId === a.id));
const b = store.enqueue(input("second"), async () => response("second"));
await tick();
ok("global worker concurrency is bounded", () => assert.equal(store.status(b.id, "second")?.state, "queued"));
release(); await tick(); await tick();
ok("disconnect-independent worker finishes", () => assert.equal(store.status(a.id, "owner")?.state, "ready"));
ok("result can be downloaded repeatedly without rerunning processing", () => {
  assert.equal(store.result(a.id, "owner")?.body.toString(), "%PDF-fixture");
  assert.equal(store.result(a.id, "owner")?.body.toString(), "%PDF-fixture");
  assert.equal(executions, 1);
});
ok("completed upload retry reuses retained result", () => assert.equal(store.enqueue(input("owner"), async () => response()).id, a.id));
ok("latest job recovers after browser refresh", () => assert.equal(store.latest("owner")?.id, a.id));
ok("queued jobs start after a slot frees", () => assert.equal(store.status(b.id, "second")?.state, "ready"));
now += 1001;
ok("expired results cannot be retrieved", () => {
  assert.equal(store.result(a.id, "owner"), undefined);
  assert.equal(store.status(a.id, "owner")?.state, "expired");
});
const failed = store.enqueue(input("failure"), async () => ({ ...response('{"error":"Provider unavailable"}'), status: 500 }));
await tick(); await tick();
ok("processing failure is visible and not downloadable", () => {
  assert.equal(store.status(failed.id, "failure")?.state, "failed");
  assert.equal(store.status(failed.id, "failure")?.error, "Provider unavailable");
  assert.equal(store.result(failed.id, "failure"), undefined);
});
ok("internal response sink preserves PDF headers and bytes", () => {
  const res = new ProcessingResponse({ creditUserId: "owner" });
  res.setHeader("Content-Type", "application/pdf"); res.send(Buffer.from("%PDF-test"));
  assert.equal(res.result().headers["content-type"], "application/pdf");
  assert.equal(res.result().body.toString(), "%PDF-test");
});
ok("internal response sink preserves JSON error status", () => {
  const res = new ProcessingResponse({});
  res.status(402).json({ error: "No credits" });
  assert.equal(res.result().status, 402);
  assert.equal(JSON.parse(res.result().body.toString()).error, "No credits");
});
ok("no contents or authorization tokens are stored in task metadata", () => {
  const cols = (db.prepare("PRAGMA table_info(document_tasks)").all() as any[]).map(x => x.name);
  assert.equal(cols.some(x => /buffer|body|token|content|html/i.test(x)), false);
});
const ledger = new TrialLedger(db);
ledger.balance("trial-user", 140);
const ctx = { userId: "trial-user", requestId: "async-test", ledger, allocation: 140, reserved: 0 };
const trial = store.enqueue(input("trial-user"), () => trialRequest.run(ctx, async () => {
  reserveTrialCredits(10); await tick(); reserveTrialCredits(10); return response();
}));
await tick(); await tick(); await tick();
ok("trial reservation survives background async context and charges once", () => {
  assert.equal(store.status(trial.id, "trial-user")?.state, "ready");
  assert.equal(ledger.balance("trial-user", 140).remaining, 130);
  store.result(trial.id, "trial-user");
  assert.equal(ledger.balance("trial-user", 140).remaining, 130);
});
const ctx2 = { ...ctx, userId: "trial-fail", requestId: "failure-context", reserved: 0 };
ledger.balance("trial-fail", 140);
const trialFail = store.enqueue(input("trial-fail"), () => trialRequest.run(ctx2, async () => {
  reserveTrialCredits(12);
  refundTrialRequest("trial-fail"); refundTrialRequest("trial-fail");
  return { ...response('{"error":"Failed"}'), status: 500 };
}));
await tick(); await tick();
ok("background trial failure refunds exactly once", () => {
  assert.equal(store.status(trialFail.id, "trial-fail")?.state, "failed");
  assert.equal(ledger.balance("trial-fail", 140).remaining, 140);
});
const smallDb = new Database(":memory:");
const small = new DocumentTasks(smallDb, { maxInputBytes: 2, autoCleanup: false });
ok("oversized queue admission rejects before worker/credit processing", () => assert.throws(() => small.enqueue(input("too large"), async () => response()), DocumentTaskError));
small.close(); smallDb.close();
// Simulate restart metadata only; no active worker is duplicated or retried.
db.prepare(`INSERT INTO document_tasks VALUES ('interrupted','restart-user','hash','doc.pdf','pdf','processing','working',NULL,?,?,NULL)`).run(now, now);
store.close();
const restarted = new DocumentTasks(db, { now: () => now, autoCleanup: false });
ok("server restart reports interrupted instead of recharging", () => assert.equal(restarted.status("interrupted", "restart-user")?.state, "interrupted"));
ok("restart does not pretend an in-memory result still exists", () => assert.equal(restarted.status(trial.id, "trial-user")?.state, "expired"));
ok("account can inspect an interrupted attempt before resubmitting", () => assert.match(restarted.latest("restart-user")?.error || "", /credits before resubmitting/));
const routes = readFileSync("server/routes.ts", "utf8");
ok("status and result routes require owner-token middleware", () => {
  for (const suffix of ["latest", ":id", ":id/result"]) assert.ok(routes.includes(`app.get("/api/remedy-docs/jobs/${suffix}", documentTaskAuth`));
});
ok("job submission remains behind the paid processing middleware", () => assert.ok(routes.slice(routes.indexOf("app.use(["), routes.indexOf("// ── HEALTH CHECK")).includes('"/api/remedy-docs/jobs"')));
restarted.close(); db.close();
console.log(`${count} document-job checks passed. Synthetic/component tests; no external AI or production processing performed.`);
