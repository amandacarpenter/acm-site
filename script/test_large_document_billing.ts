import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { LargeDocumentBilling } from "../server/largeDocumentBilling";
import { TrialLedger } from "../server/trialCredits";
import { withCreditLock } from "../server/creditLock";
import { AsyncResource } from "node:async_hooks";

function fixture(used = 0, purchased = 0, plan = "individual") {
  const db = new Database(":memory:");
  const trial = new TrialLedger(db);
  const user = { primaryEmailAddress: { emailAddress: "qa@example.invalid" },
    publicMetadata: { plan, monthlyCreditsUsed: used, purchasedCredits: purchased, usageResetDate: "2026-11-01" },
    privateMetadata: {} as any };
  let writes = 0, responseLoss = false, rejectWrite = false, allowed = true;
  const deps = {
    trial, user: async () => structuredClone(user),
    balance: async () => {
      const t = plan === "trial" ? trial.balance("alice", 140) : undefined;
      return { monthlyUsed: t?.used ?? user.publicMetadata.monthlyCreditsUsed,
        monthlyLimit: t?.allocated ?? 130, purchasedCredits: user.publicMetadata.purchasedCredits,
        meta: { ...user.publicMetadata } };
    },
    authorize: async () => { if (!allowed) throw new Error("Access denied"); },
    update: async (_id: string, value: any) => {
      writes++;
      if (rejectWrite) throw new Error("Network disconnected before response");
      Object.assign(user.publicMetadata, value.publicMetadata);
      Object.assign(user.privateMetadata, value.privateMetadata);
      if (responseLoss) throw new Error("Response lost after application");
    },
  };
  return { db, trial, user, deps, billing: new LargeDocumentBilling(db, deps), writes: () => writes,
    loseResponse: () => { responseLoss = true; }, reject: () => { rejectWrite = true; },
    deny: () => { allowed = false; } };
}

const a = fixture(100, 100);
// Existing application schema, reproduced only in this in-memory test database.
a.db.exec("CREATE TABLE jobs(id INTEGER PRIMARY KEY, type TEXT, status TEXT, input_name TEXT, created_at INTEGER, clerk_user_id TEXT, page_count INTEGER, credits_used INTEGER, error_message TEXT)");
await a.billing.charge("job:1", "alice", 61);
assert.equal(a.user.publicMetadata.monthlyCreditsUsed, 130);
assert.equal(a.user.publicMetadata.purchasedCredits, 69);
await a.billing.charge("job:1", "alice", 61);
assert.equal(a.writes(), 1);
const reportJob = { id: "job", filename: "qa.pdf", createdAt: Date.now(), totalPages: 61, state: "ready" } as any;
a.billing.report(reportJob, "alice", "job:1");
a.billing.report(reportJob, "alice", "job:1");
assert.equal((a.db.prepare("SELECT COUNT(*) AS n FROM jobs").get() as any).n, 1);
assert.equal((a.db.prepare("SELECT credits_used FROM jobs").get() as any).credits_used, 61);
await assert.rejects(a.billing.charge("job:1", "bob", 61), /mismatch/);
await assert.rejects(a.billing.charge("job:1", "alice", 62), /mismatch/);
await a.billing.refund("job:1", "alice");
await a.billing.refund("job:1", "alice");
assert.equal(a.writes(), 2);
assert.equal(a.user.publicMetadata.monthlyCreditsUsed, 100);
assert.equal(a.user.publicMetadata.purchasedCredits, 100);
await assert.rejects(a.billing.charge("job:1", "alice", 61), /refunded/);
await a.billing.charge("job:2", "alice", 61);
assert.equal(a.writes(), 3);
await assert.rejects(a.billing.charge("small", "alice", 50), /51 to 400/);
await assert.rejects(a.billing.charge("big", "alice", 401), /51 to 400/);

const b = fixture(60);
const results = await Promise.allSettled([b.billing.charge("one", "alice", 61), b.billing.charge("two", "alice", 61)]);
assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
assert.equal(b.writes(), 1);
assert.equal(b.user.publicMetadata.monthlyCreditsUsed, 121);

const c = fixture();
c.loseResponse();
await c.billing.charge("lost", "alice", 61);
assert.equal(c.billing.state("lost"), "charged");
await c.billing.refund("lost", "alice");
assert.equal(c.billing.state("lost"), "refunded");
assert.equal(c.user.publicMetadata.monthlyCreditsUsed, 0);
assert.equal(c.writes(), 2);

const d = fixture();
d.reject();
await assert.rejects(d.billing.charge("uncertain", "alice", 61), /awaiting verification/);
await assert.rejects(d.billing.charge("blocked", "alice", 61), /awaiting verification/);
assert.equal(d.writes(), 1, "Never blindly retry an uncertain external write");
const receipt = d.db.prepare("SELECT mutation FROM large_document_charges WHERE id='uncertain'").get() as any;
d.user.privateMetadata.largeDocumentMutation = receipt.mutation;
d.user.publicMetadata.monthlyCreditsUsed = 61;
const restarted = new LargeDocumentBilling(d.db, d.deps);
await restarted.reconcile("alice");
assert.equal(restarted.state("uncertain"), "charged");
await restarted.charge("uncertain", "alice", 61);
assert.equal(d.writes(), 1);

const e = fixture(100, 100);
await e.billing.charge("rollover", "alice", 61);
e.user.publicMetadata.usageResetDate = "2026-12-01";
e.user.publicMetadata.monthlyCreditsUsed = 0;
await e.billing.refund("rollover", "alice");
assert.equal(e.user.publicMetadata.monthlyCreditsUsed, 0);
assert.equal(e.user.publicMetadata.purchasedCredits, 130, "Return full old-period debit without inflating new grant");

const t = fixture(0, 0, "trial");
await t.billing.charge("trial", "alice", 100);
await assert.rejects(t.billing.charge("trial2", "alice", 51), /have 40/);
await t.billing.refund("trial", "alice");
await t.billing.refund("trial", "alice");
assert.equal(t.trial.balance("alice", 140).used, 0);
assert.equal(t.writes(), 0);
// A reservation that expires between balance and reserve must roll back its intent.
const x = fixture(0, 0, "trial");
x.deps.authorize = async () => { x.trial.reserve("alice", "other", 120); };
await assert.rejects(x.billing.charge("race", "alice", 61), /available/);
assert.equal(x.billing.state("race"), undefined);
await x.billing.reconcile("alice");

const admin = fixture(130);
admin.user.primaryEmailAddress.emailAddress = "amandathecarpenter@gmail.com";
await admin.billing.charge("owner", "alice", 374);
await admin.billing.refund("owner", "alice");
assert.equal(admin.writes(), 0);
const restricted = fixture();
restricted.deny();
await assert.rejects(restricted.billing.charge("denied", "alice", 51), /Access denied/);
assert.equal(restricted.writes(), 0);
await withCreditLock("alice", async () => withCreditLock("alice", async () => {}));
// A worker callback can inherit an old async context after its lock has ended.
let later!: AsyncResource;
await withCreditLock("detached", async () => { later = new AsyncResource("test"); });
let release!: () => void, entered = false;
const gate = new Promise<void>(r => { release = r; });
const holding = withCreditLock("detached", async () => { entered = true; await gate; });
await new Promise<void>(r => setImmediate(r));
assert(entered);
let bypassed = false;
const queued = later.runInAsyncScope(() => withCreditLock("detached", async () => { bypassed = true; }));
await new Promise<void>(r => setImmediate(r));
assert(!bypassed, "Stale async context must not bypass a newly held lock");
release(); await holding; await queued; later.emitDestroy();
for (const f of [a,b,c,d,e,t,x,admin,restricted]) f.db.close();
console.log("PASS: source-page bounds, full balance, pooled debit, concurrent spending, stable retries, owner isolation, exact refunds, ambiguous-response recovery, restart, renewal, trial rollback, admin and denied access.");
