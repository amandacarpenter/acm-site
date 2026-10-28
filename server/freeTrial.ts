import { createHash } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { FREE_TRIAL_CREDITS, type FreeTrialStatus } from "../shared/trial";
import { canUsePublicTrial, TrialCreditError, TrialLedger, TRIAL_EXPIRED, TRIAL_EXHAUSTED } from "./trialCredits";

type User = {
  publicMetadata: Record<string, any>;
  primaryEmailAddress?: { emailAddress: string; verification?: { status: string } | null } | null;
};
export type TrialDependencies = {
  ledger: TrialLedger;
  verify: (token: string) => Promise<{ sub: string }>;
  getUser: (id: string) => Promise<User>;
  hasTeam: (id: string) => Promise<boolean>;
  // Optional owner alert after a brand-new trial activation (best-effort).
  onTrialStarted?: (userId: string, user: User) => void;
};

export async function getFreeTrialStatus(userId: string, user: User, deps: TrialDependencies): Promise<FreeTrialStatus> {
  const base = { allocated: FREE_TRIAL_CREDITS, remaining: 0, startsAt: null, expiresAt: null };
  if (!canUsePublicTrial(user.publicMetadata) || await deps.hasTeam(userId)) {
    return { ...base, state: "ineligible", message: "Your account already has a plan, previous trial, or team access. Your existing access is unchanged." };
  }
  const activation = deps.ledger.activation(userId);
  if (activation) {
    const balance = deps.ledger.balance(userId, FREE_TRIAL_CREDITS);
    const expired = Date.now() >= activation.expiresAt;
    return {
      ...base, ...activation, remaining: expired ? 0 : balance.remaining,
      state: expired ? "expired" : balance.remaining === 0 ? "exhausted" : "active",
      message: expired ? TRIAL_EXPIRED : balance.remaining === 0 ? TRIAL_EXHAUSTED : "Your free trial is ready. No credit card or automatic charge.",
    };
  }
  const email = user.primaryEmailAddress;
  if (!email?.emailAddress || email.verification?.status !== "verified") {
    return { ...base, state: "verification_required", message: "Verify your primary email address before starting your trial." };
  }
  const emailHash = hashTrialEmail(email.emailAddress);
  if (deps.ledger.hasGrant(userId) || deps.ledger.hasEmail(emailHash)) {
    return { ...base, state: "ineligible", message: "A trial has already been used for this account or email. Choose a plan to continue." };
  }
  return { ...base, state: "eligible", message: "Start your 14-day trial with 30 Credits. No credit card required." };
}

export function hashTrialEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function registerFreeTrialRoutes(app: Express, deps: TrialDependencies) {
  const authenticate: RequestHandler = async (req,res,next) => {
    const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : "";
    try {
      if (!token) throw new Error("Missing session");
      const { sub } = await deps.verify(token);
      if (!sub) throw new Error("Missing user");
      res.locals.trialUserId = sub;
      res.setHeader("Cache-Control","no-store");
      next();
    } catch {
      res.status(401).json({error:"Please sign in to start your trial."});
    }
  };
  app.get("/api/free-trial",authenticate,async (_req,res) => {
    try {
      const id = res.locals.trialUserId;
      res.json(await getFreeTrialStatus(id,await deps.getUser(id),deps));
    } catch {
      res.status(503).json({error:"We couldn't check your trial. Please try again."});
    }
  });
  app.post("/api/free-trial/start",authenticate,async (req,res) => {
    if (req.body?.acceptTerms !== true) return res.status(400).json({error:"Please accept the trial terms before starting."});
    try {
      const id = res.locals.trialUserId;
      const user = await deps.getUser(id);
      const status = await getFreeTrialStatus(id,user,deps);
      if (status.state === "active" || status.state === "exhausted" || status.state === "expired") return res.json(status);
      if (status.state !== "eligible") return res.status(403).json({error:status.message,...status});
      deps.ledger.activate(id,hashTrialEmail(user.primaryEmailAddress!.emailAddress));
      try { deps.onTrialStarted?.(id,user); } catch { /* alerts never block the trial */ }
      // No external metadata write: activation and Credit allocation commit together.
      res.json(await getFreeTrialStatus(id,user,deps));
    } catch (err) {
      res.status(err instanceof TrialCreditError ? 409 : 503).json({
        error:err instanceof TrialCreditError ? err.message : "We couldn't start your trial. Please try again; an existing grant will not be duplicated.",
      });
    }
  });
}
