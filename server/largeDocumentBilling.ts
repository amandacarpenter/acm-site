import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { withCreditLock } from "./creditLock";
import type { TrialLedger } from "./trialCredits";
import type { LargeDocumentJob } from "../shared/largeDocuments";

type Balance = { monthlyUsed: number; monthlyLimit: number; purchasedCredits: number; meta: any };
export type LargeBillState = "pending_debit" | "charged" | "pending_refund" | "refunded";
type Entry = {
  id: string; owner: string; pages: number; kind: "paid" | "trial" | "admin";
  state: LargeBillState; period: string; monthly: number; purchased: number;
  mutation: string; target: string; created_at: number;
};
type Deps = {
  balance: (owner: string) => Promise<Balance>;
  user: (owner: string) => Promise<any>;
  update: (owner: string, metadata: { publicMetadata: any; privateMetadata: any }) => Promise<unknown>;
  authorize: (owner: string, balance: Balance) => Promise<void>;
  trial: TrialLedger;
};
export class LargeBillingError extends Error {
  constructor(message: string, readonly status = 402) { super(message); }
}
/** Durable idempotency journal. No document contents or authentication secrets. */
export class LargeDocumentBilling {
  constructor(private db: Database.Database, private deps: Deps) {
    db.exec(`CREATE TABLE IF NOT EXISTS large_document_charges (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, pages INTEGER NOT NULL,
      kind TEXT NOT NULL, state TEXT NOT NULL, period TEXT NOT NULL,
      monthly INTEGER NOT NULL, purchased INTEGER NOT NULL,
      mutation TEXT NOT NULL, target TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS large_document_charges_owner ON large_document_charges(owner);
    CREATE TABLE IF NOT EXISTS large_document_reports (large_id TEXT PRIMARY KEY, job_id INTEGER NOT NULL UNIQUE);`);
  }
  private entry(id: string) {
    return this.db.prepare("SELECT * FROM large_document_charges WHERE id = ?").get(id) as Entry | undefined;
  }
  state(id: string) { return this.entry(id)?.state; }
  /** Uses the existing document reporting category, once per uploaded output. */
  report(job: LargeDocumentJob, owner: string, reference: string) {
    this.db.transaction(() => {
      let mapping = this.db.prepare("SELECT job_id FROM large_document_reports WHERE large_id = ?").get(job.id) as { job_id: number } | undefined;
      if (!mapping) {
        const inserted = this.db.prepare("INSERT INTO jobs(type,status,input_name,created_at,clerk_user_id,page_count,credits_used) VALUES ('document','pending',?,?,?,?,0)")
          .run(job.filename, job.createdAt, owner, job.totalPages);
        mapping = { job_id: Number(inserted.lastInsertRowid) };
        this.db.prepare("INSERT INTO large_document_reports(large_id,job_id) VALUES (?,?)").run(job.id, mapping.job_id);
      }
      const charge = this.entry(reference);
      const credits = charge?.state === "charged" && charge.kind !== "admin" ? charge.pages : 0;
      this.db.prepare("UPDATE jobs SET status=?,credits_used=?,error_message=? WHERE id=?").run(
        job.state === "ready" ? "completed" : job.state === "failed" ? "failed" : "pending",
        credits, job.error || null, mapping.job_id);
    }).immediate();
  }
  private finish(entry: Entry) {
    this.db.prepare("UPDATE large_document_charges SET state = ? WHERE id = ?")
      .run(entry.state === "pending_debit" ? "charged" : "refunded", entry.id);
  }
  /** Reconcile an uncertain network response, NEVER blindly repeat a debit/refund. */
  async reconcile(owner: string): Promise<void> {
    await withCreditLock(owner, async () => {
      const pending = this.db.prepare("SELECT * FROM large_document_charges WHERE owner = ? AND state IN ('pending_debit','pending_refund')").all(owner) as Entry[];
      for (const entry of pending) {
        if (entry.kind === "trial") {
          if (entry.state === "pending_debit") this.deps.trial.reserve(owner, entry.id, entry.pages);
          else this.deps.trial.refund(entry.id, owner);
          this.finish(entry);
        } else if (entry.kind === "admin") this.finish(entry);
        else {
          let user: any;
          try { user = await this.deps.user(owner); }
          catch { throw new LargeBillingError("Credit verification is temporarily unavailable. No new processing has started.", 503); }
          if (user.privateMetadata?.largeDocumentMutation !== entry.mutation) {
            throw new LargeBillingError("A previous credit update is awaiting verification. No new processing has started. Please contact support before retrying.", 503);
          }
          this.finish(entry);
        }
      }
    });
  }
  async charge(id: string, owner: string, pages: number): Promise<void> {
    if (!Number.isSafeInteger(pages) || pages < 51 || pages > 400) throw new LargeBillingError("Large documents must contain 51 to 400 source pages.", 400);
    await withCreditLock(owner, async () => {
      await this.reconcile(owner);
      const existing = this.entry(id);
      if (existing) {
        if (existing.owner !== owner || existing.pages !== pages) throw new LargeBillingError("Credit request mismatch.", 409);
        if (existing.state === "charged") return;
        throw new LargeBillingError("This attempt was refunded. Resume as a new attempt.", 409);
      }
      const balance = await this.deps.balance(owner);
      if (![balance.monthlyUsed, balance.monthlyLimit, balance.purchasedCredits].every(n => Number.isSafeInteger(n) && n >= 0)) {
        throw new LargeBillingError("Your credit balance needs verification. No processing has started.", 503);
      }
      await this.deps.authorize(owner, balance);
      const user = await this.deps.user(owner);
      const kind = user.primaryEmailAddress?.emailAddress === "amandathecarpenter@gmail.com" ? "admin" : balance.meta.plan === "trial" ? "trial" : "paid";
      const remaining = Math.max(0, balance.monthlyLimit - balance.monthlyUsed) + balance.purchasedCredits;
      if (kind !== "admin" && remaining < pages) throw new LargeBillingError(
        `This document needs ${pages} credits (1 per source page); you have ${remaining}. Add credits or use a smaller document before starting.`);
      const monthly = kind === "admin" ? 0 : Math.min(pages, Math.max(0, balance.monthlyLimit - balance.monthlyUsed));
      const purchased = kind === "admin" ? 0 : pages - monthly;
      const target = { monthlyCreditsUsed: balance.monthlyUsed + monthly, purchasedCredits: balance.purchasedCredits - purchased };
      const mutation = randomUUID();
      const entry: Entry = { id, owner, pages, kind, state: "pending_debit", period: balance.meta.usageResetDate || "",
        monthly, purchased, mutation, target: JSON.stringify(target), created_at: Date.now() };
      this.db.transaction(() => {
        if (kind === "trial") this.deps.trial.reserve(owner, id, pages);
        if (kind !== "paid") entry.state = "charged";
        this.db.prepare("INSERT INTO large_document_charges(id,owner,pages,kind,state,period,monthly,purchased,mutation,target,created_at) VALUES (@id,@owner,@pages,@kind,@state,@period,@monthly,@purchased,@mutation,@target,@created_at)").run(entry);
      }).immediate();
      if (kind === "paid") await this.mutate(entry, target);
      else await this.reconcile(owner);
    });
  }
  private async mutate(entry: Entry, target: any) {
    try {
      await this.deps.update(entry.owner, { publicMetadata: target, privateMetadata: { largeDocumentMutation: entry.mutation } });
    } catch {
      // The API might have applied the update despite a lost response.
      // Only its matching receipt lets us finish. A missing receipt blocks future
      // credit writes, rather than guessing whether money moved.
      await this.reconcile(entry.owner);
      return;
    }
    this.finish(entry);
  }
  async refund(id: string, owner: string): Promise<void> {
    await withCreditLock(owner, async () => {
      await this.reconcile(owner);
      const entry = this.entry(id);
      if (!entry) return; // An insufficient-balance rejection made no debit.
      if (entry.owner !== owner) throw new LargeBillingError("Credit request mismatch.", 409);
      if (entry.state === "refunded") return;
      const balance = await this.deps.balance(owner);
      // After a renewal, compensate the old monthly debit in purchased credits
      // rather than silently refilling/expanding the new monthly grant.
      const samePeriod = entry.period === (balance.meta.usageResetDate || "");
      const target = {
        monthlyCreditsUsed: Math.max(0, balance.monthlyUsed - (samePeriod ? entry.monthly : 0)),
        purchasedCredits: balance.purchasedCredits + entry.purchased + (samePeriod ? 0 : entry.monthly),
      };
      entry.state = "pending_refund"; entry.mutation = randomUUID(); entry.target = JSON.stringify(target);
      this.db.prepare("UPDATE large_document_charges SET state = @state, mutation = @mutation, target = @target WHERE id = @id").run(entry);
      if (entry.kind === "paid") await this.mutate(entry, target);
      else await this.reconcile(owner);
    });
  }
}
