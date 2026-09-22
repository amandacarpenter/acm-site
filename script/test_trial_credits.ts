import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import express from "express";
import multer from "multer";
import { once } from "node:events";
import { TrialLedger, TrialCreditError, trialRequest, reserveTrialCredits, trialDeduction, linkTrialJob, createCreditAccessMiddleware, restoreCreditContext } from "../server/trialCredits";

const dir = mkdtempSync(join(tmpdir(), "remedy-trial-tests-"));
let db = new Database(join(dir, "test.db"));
let ledger = new TrialLedger(db);
let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log("PASS", name); }

try {
  check("140-credit one-time allocation", () => assert.deepEqual(ledger.balance("trial", 140), { allocated: 140, used: 0, remaining: 140 }));
  check("a 50-page job costs 50 credits", () => assert.equal(ledger.reserve("trial", "request-1", 50).remaining, 90));
  check("same request reservation is idempotent", () => assert.equal(ledger.reserve("trial", "request-1", 50).remaining, 90));
  check("metadata allocation edits cannot refill an existing grant", () => assert.equal(ledger.balance("trial", 999).remaining, 90));
  db.close();
  db = new Database(join(dir, "test.db")); ledger = new TrialLedger(db);
  check("balance survives a database restart", () => assert.equal(ledger.balance("trial", 140).remaining, 90));
  check("calendar changes cannot reset the grant", () => {
    const now = Date.now;
    Date.now = () => Date.UTC(2030, 11, 30);
    try { assert.equal(ledger.balance("trial", 140).remaining, 90); } finally { Date.now = now; }
  });
  check("an oversized job leaves balance unchanged", () => {
    assert.throws(() => ledger.reserve("trial", "too-large", 91), TrialCreditError);
    assert.equal(ledger.balance("trial", 140).remaining, 90);
  });
  check("exact exhaustion blocks the next credit", () => {
    assert.equal(ledger.reserve("trial", "request-2", 90).remaining, 0);
    assert.throws(() => ledger.reserve("trial", "over", 1), TrialCreditError);
  });
  check("refund is exactly once and returns the original charge", () => {
    ledger.linkJob("request-2", 22);
    assert.equal(ledger.refundJob("trial", 22), true);
    assert.equal(ledger.balance("trial", 140).remaining, 90);
    assert.equal(ledger.refundJob("trial", 22), true);
    assert.equal(ledger.balance("trial", 140).remaining, 90);
    assert.equal(ledger.refundJob("someone-else", 22), false);
  });
  check("refunded requests cannot spend again", () => assert.throws(() => ledger.reserve("trial", "request-2", 90), TrialCreditError));
  check("trial deduction reuses reservation and links the job", () => {
    trialRequest.run({ userId: "trial", requestId: "context", ledger, allocation: 140, reserved: 0 }, () => {
      reserveTrialCredits(3);
      assert.deepEqual(trialDeduction("trial", 3), { creditsRemaining: 87 });
      assert.throws(() => trialDeduction("trial", 4), TrialCreditError);
      linkTrialJob(33);
    });
    assert.equal(ledger.refundJob("trial", 33), true);
    assert.equal(ledger.balance("trial", 140).remaining, 90);
  });
  check("paid accounts do not acquire trial balances or reservations", () => {
    reserveTrialCredits(50);
    assert.equal(trialDeduction("paid", 50), null);
    assert.equal(db.prepare("SELECT count(*) AS n FROM trial_balances WHERE user_id = 'paid'").get()?.n, 0);
  });
  check("invalid allocations and costs fail closed", () => {
    for (const n of [0, -1, 1.5, NaN, Infinity]) {
      assert.throws(() => ledger.balance("invalid", n), TrialCreditError);
      assert.throws(() => ledger.reserve("trial", "invalid", n), TrialCreditError);
    }
  });

  // Actual Express + multipart + middleware integration with mocked identity ONLY.
  // No Clerk, Stripe or AI call is made by this test.
  const app = express();
  app.use(express.json());
  const users: Record<string, any> = {
    browser: { publicMetadata: { plan: "trial", subscribed: true, trialCreditLimit: 140 } },
    paid: { publicMetadata: { plan: "individual", subscribed: true } },
    team: { publicMetadata: { plan: "team", subscribed: true } },
    unpaid: { publicMetadata: { plan: "individual", subscribed: false } },
  };
  app.use(createCreditAccessMiddleware({
    ledger,
    verify: async token => { if (!users[token] && token !== "unavailable") throw new Error("Invalid token"); return { sub: token }; },
    getUser: async id => { if (id === "unavailable") throw new Error("Simulated Clerk outage"); return users[id]; },
  }));
  app.post("/fix", multer().single("file"), restoreCreditContext, async (req, res) => {
    try {
      // Delay to exercise concurrent requests retaining distinct ALS contexts.
      await new Promise(resolve => setTimeout(resolve, 5));
      reserveTrialCredits(Number(req.body.cost));
      if (req.body.fail) return res.status(500).json({ error: "Simulated processing failure" });
      res.json({ userId: res.locals.creditUserId, ...trialDeduction(res.locals.creditUserId, Number(req.body.cost)) });
    } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/document/refund", (_req, res) => res.json({ allowed: true }));
  app.post("/remedy-docs/fix-as-pdf", (_req, res) => res.json({ allowed: true }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;
  async function post(token: string | null, data: any, path = "/fix") {
    return fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
  }
  try {
    assert.equal((await post(null, { cost: 1, clerkUserId: "paid" })).status, 401); passed++; console.log("PASS anonymous and posted-ID bypass rejected");
    assert.equal((await post("invalid", { cost: 1 })).status, 401); passed++; console.log("PASS invalid session rejected");
    assert.equal((await post("unpaid", { cost: 1 })).status, 403); passed++; console.log("PASS unpaid processing blocked");
    assert.equal((await post("unavailable", { cost: 1 })).status, 503); passed++; console.log("PASS Clerk outage fails closed");
    const fd = new FormData(); fd.set("file", new Blob(["sample"]), "test.txt"); fd.set("cost", "3"); fd.set("clerkUserId", "paid");
    const multipart = await fetch(`http://127.0.0.1:${port}/fix`, { method: "POST", headers: { Authorization: "Bearer browser" }, body: fd });
    assert.equal(multipart.status, 200); assert.equal((await multipart.json()).userId, "browser");
    assert.equal(ledger.balance("browser", 140).remaining, 137); passed++; console.log("PASS multipart preserves trial context; spoofed ID ignored");
    assert.equal((await post("browser", { cost: 4, fail: true })).status, 500);
    assert.equal(ledger.balance("browser", 140).remaining, 137); passed++; console.log("PASS processing failure refunds reservation");
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => post("browser", { cost: 30 })));
    assert.equal(outcomes.filter(r => r.status === 200).length, 4);
    assert.equal(outcomes.filter(r => r.status === 402).length, 2);
    assert.equal(ledger.balance("browser", 140).remaining, 17); passed++; console.log("PASS simultaneous jobs cannot overspend");
    assert.equal((await post("browser", { cost: 17 })).status, 200);
    assert.equal((await post("browser", { cost: 1 })).status, 402); passed++; console.log("PASS exhausted trial blocked before processing");
    assert.equal((await post("browser", {}, "/document/refund")).status, 200);
    assert.equal((await post("browser", {}, "/remedy-docs/fix-as-pdf")).status, 200); passed++; console.log("PASS paid-for PDF completion and refunds allowed at zero");
    for (const id of ["paid", "team"]) assert.equal((await post(id, { cost: 200 })).status, 200);
    passed++; console.log("PASS existing paid Individual and Team requests bypass trial ledger");
    users.browser.publicMetadata.plan = "individual";
    assert.equal((await post("browser", { cost: 1 })).status, 200); passed++; console.log("PASS conversion to paid plan exits trial restriction");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }

  // Guard actual route and client wiring in addition to the middleware tests.
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../client/src/pages/ToolsPage.tsx", import.meta.url), "utf8");
  for (const value of ["Math.max(1, docPageCount)", "totalPages", "VIDEO_CREDITS_PER_JOB", "CANVAS_CREDITS_PER_FIX", "ALTTEXT_CREDITS_PER_IMAGE"]) {
    assert.ok(routes.includes(`reserveTrialCredits(${value})`));
  }
  assert.ok(!/await fetch\("\/api\/(?:remedy-docs|document\/refund|video\/transcribe|canvas\/fix|alttext\/generate)/.test(client));
  assert.ok(routes.indexOf('if (meta.plan === "trial") {') < routes.indexOf('if (new Date() >= new Date(resetDate))'));
  passed++; console.log("PASS all tool families wired to reservation and authenticated requests");
  console.log(`\n${passed} trial checks passed; no external calls or production data changed.`);
} finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
