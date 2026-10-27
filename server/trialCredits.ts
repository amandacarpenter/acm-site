import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { RequestHandler } from "express";
import { FREE_TRIAL_CREDITS, FREE_TRIAL_MS } from "../shared/trial";

export const TRIAL_EXHAUSTED = "Your one-time trial credits are used up. Choose a paid plan to continue at /pricing. Trial credits do not refill.";
export const TRIAL_EXPIRED = "Your 14-day trial has ended. No charge was made. Choose a paid plan at /pricing to continue processing.";

// Paid, complimentary, canceled, and legacy-trial metadata always take precedence.
// Public trials never write Clerk subscription metadata or call Stripe.
export function canUsePublicTrial(meta: Record<string, any>): boolean {
  return !meta.plan && meta.subscribed !== true && !meta.stripeCustomerId &&
    !meta.subscribedAt && !meta.orgId && !meta.trialCreditLimit &&
    !(meta.purchasedCredits > 0);
}

export class TrialCreditError extends Error {
  status = 402;
  code = "TRIAL_CREDITS_REQUIRED";
}

type Balance = { allocated: number; used: number; remaining: number };

// Same persistent SQLite database as jobs. Conditional SQL updates and transactions
// prevent concurrent requests/processes sharing the volume from overspending.
// INSERT OR IGNORE ensures metadata reads, month changes and restarts never refill.
export class TrialLedger {
  constructor(private db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trial_balances (
        user_id TEXT PRIMARY KEY,
        allocated INTEGER NOT NULL CHECK(allocated >= 0),
        used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0 AND used <= allocated)
      );
      CREATE TABLE IF NOT EXISTS trial_debits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK(amount > 0),
        refunded INTEGER NOT NULL DEFAULT 0,
        job_id INTEGER UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS free_trial_activations (
        user_id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        starts_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  activation(userId: string): { startsAt: number; expiresAt: number } | null {
    return (this.db.prepare("SELECT starts_at AS startsAt, expires_at AS expiresAt FROM free_trial_activations WHERE user_id = ?").get(userId) as { startsAt: number; expiresAt: number } | undefined) || null;
  }

  hasGrant(userId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM trial_balances WHERE user_id = ?").get(userId));
  }

  hasEmail(emailHash: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM free_trial_activations WHERE email_hash = ?").get(emailHash));
  }

  activate(userId: string, emailHash: string, now = Date.now()) {
    return this.db.transaction(() => {
      const current = this.activation(userId);
      if (current) return current;
      if (this.hasGrant(userId) || this.hasEmail(emailHash)) {
        throw new TrialCreditError("A free trial has already been used for this account or email. Choose a plan to continue.");
      }
      const expiresAt = now + FREE_TRIAL_MS;
      this.db.prepare("INSERT INTO free_trial_activations(user_id,email_hash,starts_at,expires_at) VALUES (?,?,?,?)")
        .run(userId,emailHash,now,expiresAt);
      this.balance(userId,FREE_TRIAL_CREDITS);
      return { startsAt: now, expiresAt };
    }).immediate();
  }

  balance(userId: string, allocation: number): Balance {
    if (!Number.isSafeInteger(allocation) || allocation < 1 || allocation > 10000) {
      throw new TrialCreditError("This trial is not configured. Please contact support.");
    }
    this.db.prepare("INSERT OR IGNORE INTO trial_balances(user_id, allocated, used) VALUES (?, ?, 0)").run(userId, allocation);
    const row = this.db.prepare("SELECT allocated, used FROM trial_balances WHERE user_id = ?").get(userId) as { allocated: number; used: number };
    return { ...row, remaining: row.allocated - row.used };
  }

  reserve(userId: string, requestId: string, total: number): Balance {
    if (!Number.isSafeInteger(total) || total < 1) throw new TrialCreditError("Invalid credit amount.");
    return this.db.transaction(() => {
      const current = this.db.prepare("SELECT amount, refunded FROM trial_debits WHERE id = ? AND user_id = ?").get(requestId, userId) as { amount: number; refunded: number } | undefined;
      const activation = this.activation(userId);
      // A previously accepted/reserved job can finish; new reservations cannot.
      if (!current && activation && Date.now() >= activation.expiresAt) throw new TrialCreditError(TRIAL_EXPIRED);
      if (current?.refunded) throw new TrialCreditError("This request has already been refunded. Start a new request.");
      const delta = total - (current?.amount || 0);
      if (delta < 0) throw new TrialCreditError("Credit reservation cannot be reduced.");
      if (delta > 0) {
        const changed = this.db.prepare("UPDATE trial_balances SET used = used + ? WHERE user_id = ? AND allocated - used >= ?").run(delta, userId, delta);
        if (!changed.changes) {
          const row = this.db.prepare("SELECT allocated - used AS remaining FROM trial_balances WHERE user_id = ?").get(userId) as { remaining: number } | undefined;
          throw new TrialCreditError(`This job needs ${total} credits; your trial has ${(row?.remaining || 0) + (current?.amount || 0)} available. Use a smaller file or choose a paid plan at /pricing. Trial credits do not refill.`);
        }
        this.db.prepare("INSERT INTO trial_debits(id, user_id, amount, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET amount = excluded.amount").run(requestId, userId, total, Date.now());
      }
      const row = this.db.prepare("SELECT allocated, used FROM trial_balances WHERE user_id = ?").get(userId) as { allocated: number; used: number };
      return { ...row, remaining: row.allocated - row.used };
    }).immediate();
  }

  linkJob(requestId: string, jobId: number) {
    this.db.prepare("UPDATE trial_debits SET job_id = ? WHERE id = ? AND refunded = 0").run(jobId, requestId);
  }

  refund(requestId: string, userId: string): boolean {
    return this.db.transaction(() => {
      const debit = this.db.prepare("SELECT amount, refunded FROM trial_debits WHERE id = ? AND user_id = ?").get(requestId, userId) as { amount: number; refunded: number } | undefined;
      if (!debit || debit.refunded) return false;
      this.db.prepare("UPDATE trial_debits SET refunded = 1 WHERE id = ?").run(requestId);
      this.db.prepare("UPDATE trial_balances SET used = used - ? WHERE user_id = ?").run(debit.amount, userId);
      return true;
    }).immediate();
  }

  refundJob(userId: string, jobId: number): boolean {
    const row = this.db.prepare("SELECT id FROM trial_debits WHERE user_id = ? AND job_id = ?").get(userId, jobId) as { id: string } | undefined;
    if (!row) return false;
    this.refund(row.id, userId);
    return true; // Already-refunded trial jobs must never fall through to paid refunds.
  }
}

type TrialRequest = {
  userId: string;
  requestId: string;
  ledger: TrialLedger;
  allocation: number;
  reserved: number;
};
export const trialRequest = new AsyncLocalStorage<TrialRequest>();

// Multipart parsers can invoke next() from a stream created outside our async
// context. Restore the verified context explicitly AFTER upload parsing.
export const restoreCreditContext: RequestHandler = (_req, res, next) => {
  const ctx = res.locals.trialCreditContext as TrialRequest | undefined;
  return ctx ? trialRequest.run(ctx, () => next()) : next();
};

// No-op for existing paid accounts. Trial handlers call this as soon as the
// actual cost is known, BEFORE any paid processing; deductions later reuse it.
export function reserveTrialCredits(total: number): void {
  const ctx = trialRequest.getStore();
  if (!ctx) return;
  ctx.ledger.reserve(ctx.userId, ctx.requestId, total);
  ctx.reserved = total;
}

export function trialDeduction(userId: string, amount: number): { creditsRemaining: number } | null {
  const ctx = trialRequest.getStore();
  if (!ctx) return null;
  if (ctx.userId !== userId || ctx.reserved !== amount) {
    throw new TrialCreditError("Trial credit reservation mismatch. Please contact support.");
  }
  return { creditsRemaining: ctx.ledger.balance(userId, ctx.allocation).remaining };
}

export function linkTrialJob(jobId: number): void {
  const ctx = trialRequest.getStore();
  if (ctx?.reserved) ctx.ledger.linkJob(ctx.requestId, jobId);
}

export function refundTrialRequest(userId: string): boolean {
  const ctx = trialRequest.getStore();
  if (!ctx || ctx.userId !== userId) return false;
  ctx.ledger.refund(ctx.requestId, userId);
  return true;
}

type Dependencies = {
  ledger: TrialLedger;
  verify: (token: string) => Promise<{ sub: string }>;
  getUser: (id: string) => Promise<{ publicMetadata: Record<string, any>; primaryEmailAddress?: { emailAddress: string } | null }>;
  hasTeam?: (id: string) => Promise<boolean>;
};

// Authenticate paid processing rather than trusting caller-supplied user IDs.
// Free checker/contact routes are intentionally outside this middleware.
export function createCreditAccessMiddleware({ ledger, verify, getUser, hasTeam }: Dependencies): RequestHandler {
  return async (req, res, next) => {
    if (req.method !== "POST") return next();
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : null;
    if (!token) return res.status(401).json({ error: "Please sign in again to continue.", code: "SIGN_IN_REQUIRED" });
    let userId: string;
    try {
      userId = (await verify(token)).sub;
      if (!userId) throw new Error("Missing user");
    } catch {
      return res.status(401).json({ error: "Please sign in again to continue.", code: "SIGN_IN_REQUIRED" });
    }
    try {
      const user = await getUser(userId);
      const meta = user.publicMetadata;
      const isAdmin = user.primaryEmailAddress?.emailAddress === "amandathecarpenter@gmail.com";
      const grant = canUsePublicTrial(meta) ? ledger.activation(userId) : null;
      const activation = grant && !(hasTeam && await hasTeam(userId)) ? grant : null;
      if (!isAdmin && meta.subscribed !== true && !activation) {
        return res.status(403).json({ error: "Choose a paid plan to access processing tools at /pricing.", code: "PLAN_REQUIRED" });
      }
      res.locals.creditUserId = userId;
      if (meta.plan !== "trial" && !activation) return next();
      const balance = ledger.balance(userId, activation ? FREE_TRIAL_CREDITS : meta.trialCreditLimit);
      // Refunds and post-processing PDF rendering must remain available at zero.
      const isProcessing = !req.originalUrl.split("?")[0].endsWith("/refund") &&
        !req.originalUrl.split("?")[0].endsWith("/fix-as-pdf");
      if (isProcessing && activation && Date.now() >= activation.expiresAt) {
        return res.status(402).json({ error: TRIAL_EXPIRED, code: "TRIAL_EXPIRED" });
      }
      if (isProcessing && balance.remaining === 0) {
        return res.status(402).json({ error: TRIAL_EXHAUSTED, code: "TRIAL_CREDITS_REQUIRED" });
      }
      const ctx: TrialRequest = { userId, requestId: randomUUID(), ledger, allocation: balance.allocated, reserved: 0 };
      res.locals.trialCreditContext = ctx;
      res.once("finish", () => {
        if (res.statusCode >= 400 && ctx.reserved > 0) {
          try { ledger.refund(ctx.requestId, userId); }
          catch (err) { console.error("[TRIAL REFUND] Manual review needed", ctx.requestId, err); }
        }
      });
      return trialRequest.run(ctx, () => next());
    } catch (err) {
      console.error("[CREDIT ACCESS]", err instanceof Error ? err.message : err);
      return res.status(503).json({ error: "We couldn't verify your credit balance. Please try again shortly.", code: "CREDIT_CHECK_UNAVAILABLE" });
    }
  };
}
