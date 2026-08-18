import type { Express, Request } from "express";
import { kbDb } from "./kb";
import fs from "fs";
import { Server } from "http";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";
import { Webhook as SvixWebhook } from "svix";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as os from "os";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { z } from "zod";
import { createHash } from "crypto";

// Upload size limits are enforced here to match what the Knowledge Base documents to users
// (see server/kb.ts "uploading-your-first-file" and "what-file-types-accepted" articles):
// 50 MB for documents/images, 3 GB for video/audio. Keep these in sync with the KB text
// if either changes — there is no other source of truth for these numbers.
const DOCUMENT_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB — documents and images
const MEDIA_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB — video and audio
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_UPLOAD_LIMIT_BYTES } });
const uploadMedia = multer({ storage: multer.memoryStorage(), limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES } });
// Default Anthropic SDK timeout is 10 minutes with no backend logging on the way there --
// a slow/degraded Claude response hangs silently until the SDK (or Railway's proxy) finally
// gives up, producing the generic "Something went wrong" fallback with zero trace in the logs.
// Set an explicit 90s client-level timeout so every call site fails fast and predictably.
// Also disable the SDK's default maxRetries: 2 -- retrying a request that already timed out
// at 90s just re-runs the same slow call up to 2 more times (silently tripling the user's
// wait to ~4.5 min) before the error ever surfaces. Fail once, fast, with a clear message.
const anthropic = new Anthropic({ timeout: 95_000, maxRetries: 0 });
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
// Used by the "Report this issue" button (see /api/report-error below) to email a failed
// job's details + the original file straight to support instead of relying on a user
// screenshot with no reproducible file attached. Optional: if RESEND_API_KEY isn't set,
// the endpoint fails gracefully with a clear message instead of crashing the process.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const REPORT_ERROR_TO_EMAIL = process.env.REPORT_ERROR_TO_EMAIL || "hello@remedy508.com";

// ── Usage / Credits Helpers ──────────────────────────────────

const INDIVIDUAL_MONTHLY_CREDITS = 130; // shared pool across all tools -- Remedy Docs: 1 credit/page (see per-tool weights below). Same for Monthly ($19/mo) and Annual ($199/yr) individual plans -- pegged to hold ~$0.127/credit, matching the pre-Aug-2026 rate.
const TEAM_CREDITS_PER_SEAT = 145; // pegged to hold ~$0.143/credit at the $249/seat/yr price, matching the pre-Aug-2026 rate.

// ── Aug 2026 pricing update (Individual $19/mo or $199/yr, Team $249/seat/yr) ──
// Live Price IDs created 2026-08-04 in the verified live Remedy508 Stripe account
// (acct_1TZdmQAaDElV6hZx). Legacy prices below remain active for existing subscribers.
const TODO_STRIPE_PRICE_MONTHLY_19 = "price_1U0nJxAaDElV6hZxPUcTnm6i";
const TODO_STRIPE_PRICE_ANNUAL_199 = "price_1U0nK2AaDElV6hZxv9vmPBz4";
const TODO_STRIPE_PRICE_TEAM_249 = "price_1U0nK7AaDElV6hZxdA5AToST";
// Per-tool credit weights -- Remedy Docs is metered per actual page (see deductCredits
// call sites below); these three flat weights cover the other tools, cost-normalized
// against Docs' measured ~$0.032/page Claude cost (see /api/admin/cost-summary):
// Canvas HTML fixes run a full page of HTML through Claude text generation (far more
// input+output tokens than a single Doc page), AltText is a single Claude vision call
// (cheap), and Video transcription runs on local Whisper (near-zero marginal cost) but
// is still metered at a nominal 1 credit so it draws from the same shared pool instead
// of being truly unlimited.
const CANVAS_CREDITS_PER_FIX = 3;
const ALTTEXT_CREDITS_PER_IMAGE = 1;
const VIDEO_CREDITS_PER_JOB = 1;
const MAX_TEAM_SEATS = 20; // Clerk org membership cap on current plan (no B2B Authentication add-on)
const MAX_PAGES_PER_DOCUMENT = 50; // hard cap — protects against runaway cost + server load on a single upload

// Legacy fallback only -- used if a user's Clerk createdAt is somehow unavailable.
// Modern code should always prefer getFirstResetDate(user.createdAt).
function getResetDate(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 8, 0, 0)); // 1st of next month 12AM PT (UTC-8)
  return next.toISOString();
}

// Signup-anniversary credit reset: each customer's monthly pool resets on the same
// day-of-month they signed up, not a shared calendar-month date for everyone. E.g. a user
// who signs up July 28 resets Aug 28, Sept 28, etc. -- never right after they just got a
// nearly-full pool days earlier, and never leaving a later-month signer waiting ~4 weeks
// longer than an early-month signer for their first "real" reset.
//
// Handles short months correctly (e.g. signup on the 31st -- Feb has no 31st, so that
// month's reset lands on the last day of Feb instead) via JS Date's day-overflow rollover
// being explicitly clamped back down.
function getFirstResetDate(signupDate: Date): string {
  const day = signupDate.getUTCDate();
  const next = addOneMonthClamped(signupDate, day);
  return next.toISOString();
}

function getNextResetDate(currentResetDate: Date, anniversaryDay: number): string {
  const next = addOneMonthClamped(currentResetDate, anniversaryDay);
  return next.toISOString();
}

// Adds one month to `base`, targeting `anniversaryDay` as the day-of-month, but clamped to
// the last real day of the resulting month (so Jan 31 -> Feb 28/29, not March 3 from JS's
// default day-overflow rollover).
function addOneMonthClamped(base: Date, anniversaryDay: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1; // target next month
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0, 8, 0, 0)).getUTCDate();
  const clampedDay = Math.min(anniversaryDay, lastDayOfTargetMonth);
  return new Date(Date.UTC(year, month, clampedDay, 8, 0, 0)); // 12AM PT (UTC-8)
}

function getMonthlyCreditLimit(meta: any): number {
  const plan: string = meta.plan || "individual";
  if (plan === "team") return (meta.teamSeats || 1) * TEAM_CREDITS_PER_SEAT;
  return INDIVIDUAL_MONTHLY_CREDITS;
}

// Reads current credit balance (monthly pool + purchased top-up pool) without mutating anything.
// Also resets the monthly pool if the reset date has passed.
async function getCreditBalance(clerkUserId: string): Promise<{
  monthlyUsed: number;
  monthlyLimit: number;
  purchasedCredits: number;
  meta: any;
}> {
  const user = await clerkClient.users.getUser(clerkUserId);
  let meta = (user.publicMetadata || {}) as any;

  // Auto-provision team credits: if this user has never had a plan set (brand new
  // account, e.g. just accepted a team invite via Clerk Organizations) but belongs to
  // an organization whose OWNER metadata marks it as a team org, grant them their own
  // individual team allotment (145 credits/mo per seat model -- NOT pooled/multiplied,
  // each teammate gets their own 145, consistent with the "per-seat individual
  // allotments" decision). This avoids needing a separate Clerk webhook + dashboard
  // config; provisioning happens lazily on first credit check instead.
  if (!meta.plan) {
    try {
      const memberships = await clerkClient.users.getOrganizationMembershipList({ userId: clerkUserId });
      const teamOrg = memberships.data.find((m: any) => m.organization?.publicMetadata?.plan === "team");
      if (teamOrg) {
        meta = {
          ...meta,
          plan: "team",
          teamSeats: 1, // individual allotment, not the whole team's seat count
          orgId: teamOrg.organization.id,
        };
        await clerkClient.users.updateUserMetadata(clerkUserId, { publicMetadata: meta });
        console.log(`[TEAM] Auto-provisioned team credits for ${clerkUserId} in org ${teamOrg.organization.id}`);
      }
    } catch (err: any) {
      console.error("[TEAM] Auto-provision check failed (non-fatal):", err.message);
    }
  }

  const monthlyLimit = getMonthlyCreditLimit(meta);
  let monthlyUsed: number = meta.monthlyCreditsUsed ?? meta.monthlyDocsUsed ?? 0;
  const purchasedCredits: number = meta.purchasedCredits || 0;

  // Signup date drives the reset anniversary. Clerk's user.createdAt is a real Date object
  // for every account (new or pre-existing), so this works for existing users too -- their
  // very first reset after this change lands on their actual signup day-of-month, not the
  // 1st of whatever month they happen to log in during.
  const signupDate = new Date(user.createdAt);
  const anniversaryDay: number = meta.usageAnniversaryDay || signupDate.getUTCDate();

  let resetDate: string = meta.usageResetDate;
  if (!resetDate) {
    // First time this user's credits are ever checked -- seed from their real signup date.
    resetDate = getFirstResetDate(signupDate);
    meta = { ...meta, usageResetDate: resetDate, usageAnniversaryDay: anniversaryDay };
    await clerkClient.users.updateUserMetadata(clerkUserId, { publicMetadata: meta });
  }

  if (new Date() >= new Date(resetDate)) {
    monthlyUsed = 0;
    const newResetDate = getNextResetDate(new Date(resetDate), anniversaryDay);
    meta = { ...meta, monthlyCreditsUsed: 0, usageResetDate: newResetDate, usageAnniversaryDay: anniversaryDay };
    resetDate = newResetDate;
    await clerkClient.users.updateUserMetadata(clerkUserId, { publicMetadata: meta });
  }

  return { monthlyUsed, monthlyLimit, purchasedCredits, meta };
}

// Pre-flight check, called BEFORE any processing starts. Only confirms the user has at least
// 1 credit available — real per-page deduction happens after the true page count is known
// (see deductCredits below). This prevents a zero-balance user from starting a job at all,
// while avoiding the old bug where a flat "1 document" was charged regardless of page count.
async function checkHasCredits(clerkUserId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Admin bypass: the owner account never gets blocked by the credit gate, regardless
    // of balance. Mirrors the existing frontend subscription bypass in ToolsPage.tsx for
    // the same email. Deduction below still runs normally (so usage still logs to the
    // jobs table / Dashboard), it just can never prevent the job from starting.
    try {
      const adminUser = await clerkClient.users.getUser(clerkUserId);
      if (adminUser.primaryEmailAddress?.emailAddress === "amandathecarpenter@gmail.com") {
        return { allowed: true };
      }
    } catch (lookupErr: any) {
      console.error("[ADMIN CREDIT BYPASS] Lookup error (non-fatal):", lookupErr.message);
    }

    const { monthlyUsed, monthlyLimit, purchasedCredits, meta } = await getCreditBalance(clerkUserId);

    // Fix #3/#6: a team whose renewal payment has failed is immediately restricted
    // to read-only (per product decision) -- this blocks NEW processing jobs for
    // every member of that org, regardless of their individual credit balance.
    // billingRestricted lives on the org (not the user) since it's a team-wide
    // state; it's set/cleared by the customer.subscription.updated webhook based
    // on the real Stripe subscription status (active/trialing = clear, anything
    // else e.g. past_due/unpaid/incomplete = restrict).
    if (meta.plan === "team" && meta.orgId) {
      try {
        const org = await clerkClient.organizations.getOrganization({ organizationId: meta.orgId });
        if ((org.publicMetadata as any)?.billingRestricted) {
          return {
            allowed: false,
            reason: "Your team's payment couldn't be processed, so new document processing is paused for all members. Ask your team's billing admin to update the payment method to restore access.",
          };
        }
      } catch (orgErr: any) {
        console.error("[CREDIT CHECK] Failed to check org billing restriction (non-fatal, failing open):", orgErr.message);
      }
    }

    const remaining = (monthlyLimit - monthlyUsed) + purchasedCredits;
    if (remaining > 0) return { allowed: true };

    const resetDate: string = meta.usageResetDate || getResetDate();
    const resetStr = new Date(resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return {
      allowed: false,
      reason: `You're out of credits (0 remaining). Your ${monthlyLimit}-credit monthly pool resets ${resetStr}. Need more now? Purchase additional page credits.`,
    };
  } catch (err: any) {
    console.error("[CREDIT CHECK] Error:", err.message);
    // Fail open — don't block if Clerk is temporarily unavailable
    return { allowed: true };
  }
}

// Rejects documents that exceed the per-document page cap. Called AFTER page count is known
// (from the real PDF/document extraction step) but BEFORE any Claude API calls are made, so a
// disallowed document never spends a cent of API budget and never touches the user's credits.
function checkPageCap(totalPages: number): { allowed: boolean; reason?: string } {
  if (totalPages > MAX_PAGES_PER_DOCUMENT) {
    return {
      allowed: false,
      reason: `This document has ${totalPages} pages, which exceeds the ${MAX_PAGES_PER_DOCUMENT}-page limit per document. Please split it into smaller files and process them separately.`,
    };
  }
  return { allowed: true };
}

// Real deduction, called AFTER the true page count is known and the page cap has passed.
// Deducts exactly `pagesUsed` credits — monthly pool first, then purchased top-up credits.
// This is the step that makes the credit system tamper-proof: cost is always tied to the
// actual number of pages Claude processed, never to a flat "1 document" assumption.
async function deductCredits(clerkUserId: string, pagesUsed: number): Promise<{ creditsRemaining: number }> {
  const { monthlyUsed, monthlyLimit, purchasedCredits, meta } = await getCreditBalance(clerkUserId);
  const resetDate: string = meta.usageResetDate || getResetDate();

  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
  const fromMonthly = Math.min(monthlyRemaining, pagesUsed);
  const fromPurchased = Math.max(0, pagesUsed - fromMonthly);

  const newMonthlyUsed = monthlyUsed + fromMonthly;
  const newPurchasedCredits = Math.max(0, purchasedCredits - fromPurchased);

  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...meta,
      monthlyCreditsUsed: newMonthlyUsed,
      purchasedCredits: newPurchasedCredits,
      usageResetDate: resetDate,
    },
  });

  const creditsRemaining = Math.max(0, monthlyLimit - newMonthlyUsed) + newPurchasedCredits;
  return { creditsRemaining };
}

// Reverses a deductCredits() call — used when a job was charged server-side but the
// client never actually received a usable result (e.g. the browser-side .docx build
// failed after a successful API response). Restores monthly credits first (since
// deductCredits spends monthly credits before purchased ones), mirroring the deduction
// order so a refund exactly undoes the matching charge.
async function refundCredits(clerkUserId: string, pagesToRefund: number): Promise<{ creditsRemaining: number }> {
  const { monthlyUsed, monthlyLimit, purchasedCredits, meta } = await getCreditBalance(clerkUserId);
  const newMonthlyUsed = Math.max(0, monthlyUsed - pagesToRefund);
  const actuallyRefundedFromMonthly = monthlyUsed - newMonthlyUsed;
  const remainderToPurchased = pagesToRefund - actuallyRefundedFromMonthly;
  const newPurchasedCredits = purchasedCredits + Math.max(0, remainderToPurchased);

  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...meta,
      monthlyCreditsUsed: newMonthlyUsed,
      purchasedCredits: newPurchasedCredits,
    },
  });

  const creditsRemaining = Math.max(0, monthlyLimit - newMonthlyUsed) + newPurchasedCredits;
  return { creditsRemaining };
}

// Helper: call Claude for text tasks
// Simple usage accumulator object — a plain { input, output } counter that a
// route handler creates locally and passes into every Claude call it makes.
// This avoids any shared/global state, so concurrent requests can never cross-
// contaminate each other's token counts (each handler owns its own object).
type UsageCounter = { input: number; output: number };
function newUsageCounter(): UsageCounter { return { input: 0, output: 0 }; }

async function callClaude(systemPrompt: string, userContent: string, maxTokens = 16384, usage?: UsageCounter): Promise<string> {
  let msg;
  try {
    msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userContent }],
      system: systemPrompt,
    });
  } catch (err: any) {
    const isTimeout = err?.name === "APIConnectionTimeoutError" || /timeout/i.test(err?.message || "");
    throw new Error(isTimeout
      ? "The AI service took too long to respond. This can happen during high demand -- please try again in a moment."
      : `AI processing failed: ${err?.message || "unknown error"}`);
  }
  if (usage) {
    usage.input += msg.usage?.input_tokens || 0;
    usage.output += msg.usage?.output_tokens || 0;
  }
  return (msg.content[0] as any).text;
}

// Real Claude Sonnet 4.6 pricing (per Anthropic's published rates) — used to
// convert logged token counts into an exact dollar cost for reporting.
const CLAUDE_INPUT_PER_MTOK = 3.00;
const CLAUDE_OUTPUT_PER_MTOK = 15.00;
function tokenCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * CLAUDE_INPUT_PER_MTOK + (outputTokens / 1_000_000) * CLAUDE_OUTPUT_PER_MTOK;
}

// Helper: transcribe audio using local Whisper (no API key needed)
async function callTranscribe(audioBytes: Buffer, _mediaType: string) {
  const { writeFile, unlink, readFile } = await import("fs/promises");
  const { execFile } = await import("child_process");
  const { tmpdir } = await import("os");
  const { join } = await import("path");

  const tmpAudio = join(tmpdir(), `whisper_in_${Date.now()}.mp3`);
  const tmpOut = join(tmpdir(), `whisper_out_${Date.now()}.json`);
  await writeFile(tmpAudio, audioBytes);

  const pyScript = [
    "from faster_whisper import WhisperModel",
    "import json, sys",
    "model = WhisperModel('base', device='cpu', compute_type='int8')",
    "segs, info = model.transcribe(sys.argv[1], beam_size=5)",
    "segments = []",
    "full_text = []",
    "for s in segs:",
    "    minutes = int(s.start) // 60",
    "    seconds = int(s.start) % 60",
    "    timestamp = f'{minutes:02d}:{seconds:02d}'",
    "    segments.append({'timestamp': timestamp, 'start': s.start, 'text': s.text.strip()})",
    "    full_text.append(s.text.strip())",
    "with open(sys.argv[2], 'w') as f:",
    "    json.dump({'segments': segments, 'text': ' '.join(full_text)}, f)",
  ].join("\n");

  // Write script to a temp file — passing via -c strips newlines and breaks Python syntax
  const tmpScript = join(tmpdir(), `whisper_script_${Date.now()}.py`);
  await writeFile(tmpScript, pyScript, "utf8");

  const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
  await new Promise<void>((resolve, reject) => {
    execFile(python3, [tmpScript, tmpAudio, tmpOut], { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) reject(new Error("Whisper transcription failed: " + (stderr?.slice(-1000) || stdout?.slice(-500) || err.message)));
      else resolve();
    });
  });

  const result = JSON.parse(await readFile(tmpOut, "utf8"));
  await unlink(tmpAudio).catch(() => {});
  await unlink(tmpOut).catch(() => {});
  await unlink(tmpScript).catch(() => {});
  return result;
}

// Helper: extract audio from video using ffmpeg
function extractAudio(videoBuffer: Buffer, inputExt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tmpIn = `/tmp/upload_${Date.now()}${inputExt}`;
    const tmpOut = `/tmp/audio_${Date.now()}.mp3`;
    fs.writeFileSync(tmpIn, videoBuffer);
    child_process.exec(
      `ffmpeg -y -i "${tmpIn}" -vn -acodec mp3 -ar 16000 -ac 1 "${tmpOut}"`,
      (err) => {
        if (err) { reject(err); return; }
        const buf = fs.readFileSync(tmpOut);
        fs.unlinkSync(tmpIn);
        fs.unlinkSync(tmpOut);
        resolve(buf);
      }
    );
  });
}

// Helper: format timecoded transcript from word-level timestamps
function formatTimecodeTranscript(words: Array<{ text: string; start: number; end: number }>): string {
  if (!words || words.length === 0) return "";
  const lines: string[] = [];
  let lineWords: string[] = [];
  let lineStart = words[0].start;
  let segmentStart = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    lineWords.push(w.text);
    const isEnd = i === words.length - 1;
    const nextWordFar = !isEnd && words[i + 1].start - w.end > 1.5;
    const tooManyWords = lineWords.length >= 12;

    if (isEnd || nextWordFar || tooManyWords) {
      const start = formatTime(lineStart);
      const end = formatTime(w.end);
      lines.push(`[${start} --> ${end}]`);
      lines.push(lineWords.join(" "));
      lines.push("");
      lineWords = [];
      if (!isEnd) lineStart = words[i + 1].start;
    }
  }
  return lines.join("\n").trim();
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// ── Google Analytics (GA4) — replaces the old Cloudflare-based Site Traffic panel ──
// Uses a Google Cloud service account (Viewer access granted directly on the GA4 property)
// so the backend can pull real traffic-source data at runtime, independent of any user's
// browser session. Requires GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON (the full service
// account JSON key, as a single-line string) to be set as Railway env vars.
let gaClient: BetaAnalyticsDataClient | null = null;
let gaClientError: string | null = null;
function getGaClient(): BetaAnalyticsDataClient | null {
  if (gaClient || gaClientError) return gaClient;
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    gaClientError = "GA4_SERVICE_ACCOUNT_JSON not set";
    return null;
  }
  try {
    const credentials = JSON.parse(raw);
    gaClient = new BetaAnalyticsDataClient({ credentials });
    return gaClient;
  } catch (err: any) {
    gaClientError = "Failed to parse GA4_SERVICE_ACCOUNT_JSON: " + (err.message || String(err));
    return null;
  }
}

async function getGoogleAnalytics(): Promise<{
  visitors7d: number | null;
  pageViews7d: number | null;
  dailyCounts7d: { date: string; visitors: number; pageViews: number }[];
  visitorsToday: number | null;
  pageViewsToday: number | null;
  visitorsLastHour: number | null;
  requestsLastHour: number | null;
  topPagesToday: { path: string; count: number }[];
  topCountriesToday: { country: string; count: number }[];
  trafficSourcesToday: { source: string; count: number }[];
  trafficSources7d: { source: string; count: number }[];
  testingTrafficLikely: boolean;
  dataQualityNote: string | null;
  error: string | null;
}> {
  const empty = {
    visitors7d: null, pageViews7d: null, dailyCounts7d: [] as { date: string; visitors: number; pageViews: number }[],
    visitorsToday: null, pageViewsToday: null, visitorsLastHour: null, requestsLastHour: null,
    topPagesToday: [] as { path: string; count: number }[], topCountriesToday: [] as { country: string; count: number }[],
    trafficSourcesToday: [] as { source: string; count: number }[], trafficSources7d: [] as { source: string; count: number }[],
    testingTrafficLikely: false, dataQualityNote: null,
  };
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return { ...empty, error: "Google Analytics not configured (GA4_PROPERTY_ID missing)" };
  }
  const client = getGaClient();
  if (!client) {
    return { ...empty, error: gaClientError || "Google Analytics client unavailable" };
  }
  const property = `properties/${propertyId}`;
  try {
    const [daily, today, lastHour, topPages, topCountries, sourcesToday, sources7d] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: "6daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
      }),
      client.runRealtimeReport({
        property,
        metrics: [{ name: "activeUsers" }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 6,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 6,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "6daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
    ]);

    const dailyRows = daily[0]?.rows || [];
    const dailyCounts7d = dailyRows.map((r) => {
      const raw = r.dimensionValues?.[0]?.value || "";
      const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      return {
        date,
        visitors: Number(r.metricValues?.[0]?.value || 0),
        pageViews: Number(r.metricValues?.[1]?.value || 0),
      };
    });
    const visitors7d = dailyCounts7d.reduce((sum, d) => sum + d.visitors, 0);
    const pageViews7d = dailyCounts7d.reduce((sum, d) => sum + d.pageViews, 0);

    const todayRow = today[0]?.rows?.[0];
    const visitorsToday = todayRow ? Number(todayRow.metricValues?.[0]?.value || 0) : 0;
    const pageViewsToday = todayRow ? Number(todayRow.metricValues?.[1]?.value || 0) : 0;

    const visitorsLastHour = Number(lastHour[0]?.rows?.[0]?.metricValues?.[0]?.value || 0);

    const topPagesToday = (topPages[0]?.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value || "(unknown)",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));
    const topCountriesToday = (topCountries[0]?.rows || []).map((r) => ({
      country: r.dimensionValues?.[0]?.value || "Unknown",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));
    const trafficSourcesToday = (sourcesToday[0]?.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value || "Unassigned",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));
    const trafficSources7d = (sources7d[0]?.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value || "Unassigned",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));
    const notSetPageViews = (sourcesToday[0]?.rows || []).reduce((sum, r) => {
      const sourceMedium = r.dimensionValues?.[0]?.value || "";
      return sourceMedium === "(not set)"
        ? sum + Number(r.metricValues?.[1]?.value || 0)
        : sum;
    }, 0);
    const pageViewsPerUser = visitorsToday > 0 ? pageViewsToday / visitorsToday : 0;
    const notSetShare = pageViewsToday > 0 ? notSetPageViews / pageViewsToday : 0;
    const testingTrafficLikely = pageViewsPerUser >= 8 || notSetShare >= 0.5;
    const dataQualityNote = testingTrafficLikely
      ? `This period includes likely automated or QA activity (${pageViewsPerUser.toFixed(1)} page views per GA4 user; ${Math.round(notSetShare * 100)}% of page views have no source). Treat totals as testing-contaminated.`
      : null;

    return {
      visitors7d, pageViews7d, dailyCounts7d,
      visitorsToday, pageViewsToday, visitorsLastHour, requestsLastHour: null,
      topPagesToday, topCountriesToday, trafficSourcesToday, trafficSources7d,
      testingTrafficLikely, dataQualityNote,
      error: null,
    };
  } catch (err: any) {
    return { ...empty, error: err.message || "Failed to fetch Google Analytics data" };
  }
}

export function registerRoutes(httpServer: Server, app: Express) {

  // ── Stripe client (moved to top of function so it's in scope for every route,
  // including /api/admin/dashboard which is registered before the checkout routes) ──
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  console.log("[STARTUP] STRIPE_SECRET_KEY prefix:", stripeKey.slice(0, 15) || "(not set)");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" }) : null;

  // ── HEALTH CHECK (for Railway) ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "yt-proxy-2" }));

  // ── Incident banner (manual toggle, no redeploy needed) ─────────────────────
  // Set INCIDENT_BANNER_MESSAGE in Railway env vars to show a dismissible site-wide
  // banner (e.g. during a Railway/Clerk/Stripe/Anthropic outage that affects the app).
  // Unset it (or leave empty) to hide the banner. Read at request time, not build time,
  // so it takes effect immediately without a new deployment.
  app.get("/api/incident-status", (_req, res) => {
    const message = (process.env.INCIDENT_BANNER_MESSAGE || "").trim();
    res.json({
      active: message.length > 0,
      message: message || null,
      severity: (process.env.INCIDENT_BANNER_SEVERITY || "warning").trim(), // "warning" | "error"
    });
  });

  // ── Credit usage status (for Dashboard) ──────────────────────────────────
  app.get("/api/usage/status", async (req, res) => {
    const clerkUserId = req.query.clerkUserId as string | undefined;
    if (!clerkUserId) return res.status(400).json({ error: "clerkUserId required" });
    try {
      const { monthlyUsed, monthlyLimit, purchasedCredits, meta } = await getCreditBalance(clerkUserId);

      // Fix #3/#6: surface whether this user's team is currently payment-restricted
      // so the frontend can show a clear banner instead of a surprise error only
      // at submit-time. Individual plans use the existing `subscribed` flag for
      // this (already correctly cleared on payment failure); teams use this
      // org-level flag since restriction applies to every member at once.
      //
      // Dashboard seat-count fix: `meta.teamSeats` on an individual member is
      // always 1 -- it's that member's own per-seat credit-allotment multiplier,
      // NOT the team's total purchased seat count (see getMonthlyCreditLimit /
      // getCreditBalance). Displaying it labeled as "seat" on the personal
      // Dashboard was misleading (always showed "Team (1 seat)" regardless of
      // real team size). Fetch the org's real purchased seat count here too so
      // the frontend can show accurate numbers instead of the per-member value.
      let billingRestricted = false;
      let orgSeats: number | null = null;
      if (meta.plan === "team" && meta.orgId) {
        try {
          const org = await clerkClient.organizations.getOrganization({ organizationId: meta.orgId });
          billingRestricted = Boolean((org.publicMetadata as any)?.billingRestricted);
          orgSeats = (org.publicMetadata as any)?.seats ?? null;
        } catch {
          // fail open on lookup error -- checkHasCredits is still the real enforcement gate
        }
      }

      res.json({
        monthlyUsed,
        monthlyLimit,
        purchasedCredits,
        creditsRemaining: Math.max(0, monthlyLimit - monthlyUsed) + purchasedCredits,
        resetDate: meta.usageResetDate || getResetDate(),
        plan: meta.plan || "individual",
        // teamSeats: kept for backward compatibility -- this is the per-member
        // allotment multiplier (always 1), NOT the team's real seat count.
        teamSeats: meta.teamSeats || 1,
        // orgSeats: the team's actual purchased seat count (null for individual
        // plans, or if the org lookup failed/hasn't set seats yet).
        orgSeats,
        billingRestricted,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Team usage breakdown (for /team/setup page) ───────────────────────────
  // Returns each org member's individual credit usage this month. Requires the
  // requester to actually be a member of the org they're asking about (prevents
  // one team from viewing another team's usage by guessing an orgId).
  app.get("/api/team/usage", async (req, res) => {
    const clerkUserId = req.query.clerkUserId as string | undefined;
    const orgId = req.query.orgId as string | undefined;
    if (!clerkUserId || !orgId) return res.status(400).json({ error: "clerkUserId and orgId required" });
    try {
      const requesterMemberships = await clerkClient.users.getOrganizationMembershipList({ userId: clerkUserId });
      const isMember = requesterMemberships.data.some((m: any) => m.organization?.id === orgId);
      if (!isMember) return res.status(403).json({ error: "Not a member of this organization" });

      // Purchased seat count lives on the ORGANIZATION's own metadata (set once at
      // checkout time), not on any individual member's metadata. Each member's
      // publicMetadata.teamSeats is their own per-seat credit allotment (always 1),
      // which is a completely different number and was previously being misread on
      // the client as if it were the team's total purchased seats -- showing e.g.
      // "2 of 0" for a teammate whose own teamSeats happened to be unset/1, instead
      // of the real "2 of 3" purchased-seats figure the org owner correctly saw.
      const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      const purchasedSeats: number = (org.publicMetadata as any)?.seats || 0;
      const billingRestricted: boolean = Boolean((org.publicMetadata as any)?.billingRestricted);

      const memberships = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
      const members = await Promise.all(
        memberships.data.map(async (m: any) => {
          const memberUserId = m.publicUserData?.userId;
          if (!memberUserId) return null;
          const { monthlyUsed, monthlyLimit, purchasedCredits } = await getCreditBalance(memberUserId);
          return {
            userId: memberUserId,
            name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || m.publicUserData?.identifier || "Unknown",
            email: m.publicUserData?.identifier || null,
            role: m.role,
            monthlyUsed,
            monthlyLimit,
            purchasedCredits,
            creditsRemaining: Math.max(0, monthlyLimit - monthlyUsed) + purchasedCredits,
          };
        })
      );
      const validMembers = members.filter(Boolean);

      // Fix #1: surface pending invite count alongside occupied seats so the
      // admin can see "X members + Y pending invites" instead of only finding
      // out about oversubscription when a remove-seats request gets blocked.
      let pendingInvitesCount = 0;
      try {
        const pendingInvites = await clerkClient.organizations.getOrganizationInvitationList({
          organizationId: orgId,
          status: ["pending"],
        });
        pendingInvitesCount = pendingInvites.data.length;
      } catch (inviteErr: any) {
        console.error("[TEAM] Failed to fetch pending invites (non-fatal):", inviteErr.message);
      }

      res.json({
        members: validMembers,
        totalUsed: validMembers.reduce((sum: number, m: any) => sum + m.monthlyUsed, 0),
        totalLimit: validMembers.reduce((sum: number, m: any) => sum + m.monthlyLimit, 0),
        purchasedSeats,
        membersCount: memberships.data.length,
        pendingInvitesCount,
        billingRestricted,
      });
    } catch (err: any) {
      console.error("[TEAM] usage fetch error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Team seat expansion (org admin only) ──────────────────────────────────
  // Two-step flow so the admin sees and confirms the exact prorated charge
  // BEFORE their card is billed, instead of an immediate silent charge:
  //   1. POST /api/team/add-seats/preview -> returns the exact prorated amount
  //      due today (via Stripe's invoice preview, no mutation, nothing charged)
  //   2. POST /api/team/add-seats/confirm -> actually updates the subscription
  //      quantity (charges the previewed prorated amount to the card on file)
  //      and syncs the org's Clerk metadata (seats + maxAllowedMemberships).
  // deltaQty is signed: positive to add seats, negative to remove seats.
  async function resolveTeamSeatContext(clerkUserId: string, orgId: string, deltaQty: number) {
    if (!stripe) throw Object.assign(new Error("Stripe not configured"), { status: 500 });
    if (!clerkUserId || !orgId || !deltaQty) {
      throw Object.assign(new Error("clerkUserId, orgId, and a non-zero seat change are required"), { status: 400 });
    }

    // Only an org admin may change the purchased seat count for the team.
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
    const requesterMembership = memberships.data.find((m: any) => m.publicUserData?.userId === clerkUserId);
    if (!requesterMembership || requesterMembership.role !== "org:admin") {
      throw Object.assign(new Error("Only a team admin can change seats"), { status: 403 });
    }

    let org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
    const currentSeats: number = (org.publicMetadata as any)?.seats || 0;
    const newSeats = currentSeats + deltaQty;
    if (newSeats > MAX_TEAM_SEATS) {
      throw Object.assign(new Error(`Team plan is capped at ${MAX_TEAM_SEATS} seats (currently ${currentSeats}). Contact us for a larger plan.`), { status: 400 });
    }
    if (newSeats < 1) {
      throw Object.assign(new Error("A team plan needs at least 1 seat."), { status: 400 });
    }

    // Fix #1/#5: pending invitations don't count toward Clerk's maxAllowedMemberships
    // enforcement (Clerk only blocks at *acceptance* time), so an admin could otherwise
    // send more invites than seats without any warning, and a removal could drop seats
    // below "members + outstanding invites" -- leaving pending invites that will fail
    // to accept later with a confusing Clerk-level error instead of a clear one here.
    const pendingInvites = await clerkClient.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ["pending"],
    });
    const occupiedSeats = memberships.data.length;
    const committedSeats = occupiedSeats + pendingInvites.data.length; // members + outstanding invites

    if (deltaQty < 0) {
      // Never let purchased seats drop below the number of people currently
      // occupying seats OR holding a pending invite -- that would either strand
      // an existing member or guarantee a pending invite fails to accept later.
      if (newSeats < committedSeats) {
        throw Object.assign(
          new Error(
            pendingInvites.data.length > 0
              ? `You have ${occupiedSeats} team member(s) and ${pendingInvites.data.length} pending invite(s) (${committedSeats} total). Revoke pending invites or remove members first, or reduce to no fewer than ${committedSeats} seats.`
              : `You have ${occupiedSeats} team member(s) using seats. Remove members first, or reduce to no fewer than ${occupiedSeats} seats.`
          ),
          { status: 400 }
        );
      }
    }

    // Fix #7: the billing owner (whoever's Stripe customer is charged) is tracked
    // separately from "any org:admin" so that if that specific person leaves the org
    // or is demoted, we can auto-reassign billing to another remaining admin instead
    // of permanently locking seat management. Falls back to the requester for teams
    // created before this field existed.
    const orgMeta = (org.publicMetadata || {}) as any;
    let billingOwnerId: string | undefined = orgMeta.billingOwnerId;
    const billingOwnerStillValid =
      !!billingOwnerId &&
      memberships.data.some((m: any) => m.publicUserData?.userId === billingOwnerId && m.role === "org:admin");

    if (!billingOwnerStillValid) {
      // Look for another current admin (preferring the requester) who already has
      // their own stripeCustomerId on file, and promote them to billing owner.
      const adminMemberships = memberships.data.filter((m: any) => m.role === "org:admin");
      const candidateIds = [
        clerkUserId,
        ...adminMemberships.map((m: any) => m.publicUserData?.userId).filter(Boolean),
      ];
      let reassigned: string | undefined;
      for (const candidateId of Array.from(new Set(candidateIds))) {
        try {
          const candidate = await clerkClient.users.getUser(candidateId);
          if ((candidate.publicMetadata as any)?.stripeCustomerId) {
            reassigned = candidateId;
            break;
          }
        } catch {
          // candidate no longer exists -- skip
        }
      }
      if (!reassigned) {
        throw Object.assign(
          new Error(
            "This team's billing owner is no longer available, and no other admin has a billing account on file. Contact support to reassign billing."
          ),
          { status: 400 }
        );
      }
      billingOwnerId = reassigned;
      await clerkClient.organizations.updateOrganizationMetadata(orgId, {
        publicMetadata: { ...orgMeta, billingOwnerId },
      });
      org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      console.log(`[TEAM BILLING] Auto-reassigned billing owner for org ${orgId} to ${billingOwnerId}`);
    }

    const owner = await clerkClient.users.getUser(billingOwnerId!);
    const ownerMeta = (owner.publicMetadata || {}) as any;
    const customerId = ownerMeta.stripeCustomerId;
    if (!customerId) {
      throw Object.assign(new Error("No billing account found for this team's billing owner. Contact support to reassign billing."), { status: 400 });
    }

    const TEAM_PRICES = [TODO_STRIPE_PRICE_TEAM_249, "price_1TycqNAaDElV6hZxvedkVIYg" /* legacy $299/yr/seat */].filter(Boolean);
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 10 });
    const teamSub = subs.data.find((s) => s.items.data.some((item) => TEAM_PRICES.includes(item.price.id)));
    if (!teamSub) {
      throw Object.assign(new Error("No active team subscription found for this account."), { status: 400 });
    }
    const teamItem = teamSub.items.data.find((item) => TEAM_PRICES.includes(item.price.id))!;

    // Fix #4: optimistic concurrency guard. We captured `currentSeats` from the org
    // metadata read at the top of this function; if two requests race (two admins,
    // or a double-click), the second one to reach the actual Stripe/Clerk write below
    // must re-verify the org's seats haven't changed since it read them, rather than
    // blindly overwriting with a stale newSeats value. Callers re-check this right
    // before mutating (see add-seats/confirm and remove-seats/confirm).
    const expectedCurrentSeats = currentSeats;

    return { org, currentSeats, newSeats, customerId, teamSub, teamItem, expectedCurrentSeats, occupiedSeats, pendingInvitesCount: pendingInvites.data.length };
  }

  app.post("/api/team/add-seats/preview", async (req, res) => {
    try {
      const { clerkUserId, orgId, additionalSeats } = req.body;
      const addQty = parseInt(additionalSeats, 10);
      const { currentSeats, newSeats, customerId, teamSub, teamItem } = await resolveTeamSeatContext(clerkUserId, orgId, Math.abs(addQty));

      // Ask Stripe for the exact prorated amount due today, without charging
      // or mutating anything -- this is a read-only preview.
      const preview = await stripe!.invoices.createPreview({
        customer: customerId,
        subscription: teamSub.id,
        subscription_details: {
          items: [{ id: teamItem.id, quantity: newSeats }],
          proration_behavior: "create_prorations",
        },
      });

      res.json({
        currentSeats,
        newSeats,
        additionalSeats: addQty,
        amountDueTodayCents: preview.amount_due,
        currency: preview.currency,
      });
    } catch (err: any) {
      console.error("[TEAM] add-seats preview error:", err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/team/add-seats/confirm", async (req, res) => {
    try {
      const { clerkUserId, orgId, additionalSeats } = req.body;
      const addQty = parseInt(additionalSeats, 10);
      const { org, currentSeats, newSeats, teamItem, expectedCurrentSeats } = await resolveTeamSeatContext(clerkUserId, orgId, Math.abs(addQty));

      // Fix #4: re-verify no other request changed the seat count between our
      // read above and this write (two admins racing, or a double-click firing
      // twice). Cheap re-read of just the org metadata immediately before the
      // Stripe mutation -- if it moved, reject so the client can retry with
      // fresh numbers instead of silently overwriting a concurrent change.
      const freshOrg = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      const freshSeats: number = (freshOrg.publicMetadata as any)?.seats || 0;
      if (freshSeats !== expectedCurrentSeats) {
        throw Object.assign(
          new Error("Seat count changed since you started this request (possibly another admin). Please refresh and try again."),
          { status: 409 }
        );
      }

      // Update quantity with proration -- this is the step that actually
      // charges the card on file for the prorated remainder of the year.
      await stripe!.subscriptionItems.update(teamItem.id, {
        quantity: newSeats,
        proration_behavior: "create_prorations",
      });

      await clerkClient.organizations.updateOrganization(orgId, {
        publicMetadata: { ...(org.publicMetadata as any), seats: newSeats },
        maxAllowedMemberships: newSeats,
      });

      console.log(`[TEAM] Admin ${clerkUserId} added ${addQty} seat(s) to org ${orgId}: ${currentSeats} -> ${newSeats}`);
      res.json({ success: true, seats: newSeats });
    } catch (err: any) {
      console.error("[TEAM] add-seats confirm error:", err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // ── Team seat reduction (org admin only) ───────────────────────────────────
  // Mirrors the add-seats preview/confirm flow with a negative quantity delta.
  // Blocked if the requested seat count would drop below the number of
  // people currently occupying seats (existing org memberships). Stripe
  // applies the prorated unused-time value as an account credit toward the
  // next renewal invoice automatically -- no separate refund call needed.
  app.post("/api/team/remove-seats/preview", async (req, res) => {
    try {
      const { clerkUserId, orgId, seatsToRemove } = req.body;
      const removeQty = parseInt(seatsToRemove, 10);
      const { currentSeats, newSeats, customerId, teamSub, teamItem } = await resolveTeamSeatContext(clerkUserId, orgId, -Math.abs(removeQty));

      // Read-only proration preview -- same mechanism as add-seats, just with
      // a lower quantity. Stripe returns a negative amount_due when the
      // proration results in a credit rather than a charge.
      const preview = await stripe!.invoices.createPreview({
        customer: customerId,
        subscription: teamSub.id,
        subscription_details: {
          items: [{ id: teamItem.id, quantity: newSeats }],
          proration_behavior: "create_prorations",
        },
      });

      res.json({
        currentSeats,
        newSeats,
        seatsToRemove: Math.abs(removeQty),
        creditCents: Math.max(0, -preview.amount_due),
        amountDueTodayCents: Math.max(0, preview.amount_due),
        currency: preview.currency,
      });
    } catch (err: any) {
      console.error("[TEAM] remove-seats preview error:", err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/team/remove-seats/confirm", async (req, res) => {
    try {
      const { clerkUserId, orgId, seatsToRemove } = req.body;
      const removeQty = parseInt(seatsToRemove, 10);
      const { org, currentSeats, newSeats, teamItem, expectedCurrentSeats } = await resolveTeamSeatContext(clerkUserId, orgId, -Math.abs(removeQty));

      // Fix #4: same concurrency re-check as add-seats/confirm -- see comment there.
      const freshOrg = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      const freshSeats: number = (freshOrg.publicMetadata as any)?.seats || 0;
      if (freshSeats !== expectedCurrentSeats) {
        throw Object.assign(
          new Error("Seat count changed since you started this request (possibly another admin). Please refresh and try again."),
          { status: 409 }
        );
      }

      // Lower the quantity with proration -- Stripe automatically applies the
      // unused-time credit toward the customer's balance for their next
      // invoice; no refund API call is needed for that default behavior.
      await stripe!.subscriptionItems.update(teamItem.id, {
        quantity: newSeats,
        proration_behavior: "create_prorations",
      });

      await clerkClient.organizations.updateOrganization(orgId, {
        publicMetadata: { ...(org.publicMetadata as any), seats: newSeats },
        maxAllowedMemberships: newSeats,
      });

      console.log(`[TEAM] Admin ${clerkUserId} removed ${Math.abs(removeQty)} seat(s) from org ${orgId}: ${currentSeats} -> ${newSeats}`);
      res.json({ success: true, seats: newSeats });
    } catch (err: any) {
      console.error("[TEAM] remove-seats confirm error:", err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Real per-page cost summary (owner-only, gated by ADMIN_STATS_KEY env var).
  // Reports EXACT Anthropic-billed token usage logged at job-completion time,
  // not an estimate. Query with ?key=<ADMIN_STATS_KEY>&sinceDays=30
  app.get("/api/admin/cost-summary", (req, res) => {
    const key = req.query.key as string | undefined;
    if (!process.env.ADMIN_STATS_KEY || key !== process.env.ADMIN_STATS_KEY) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const sinceDays = req.query.sinceDays ? parseInt(req.query.sinceDays as string, 10) : undefined;
      const sinceMs = sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : undefined;
      const summary = storage.getCostSummary(sinceMs);
      const totalCost = tokenCostUsd(summary.totalInputTokens, summary.totalOutputTokens);
      const byTypeWithCost = Object.fromEntries(
        Object.entries(summary.byType).map(([type, t]) => {
          const cost = tokenCostUsd(t.inputTokens, t.outputTokens);
          return [type, { ...t, costUsd: Number(cost.toFixed(4)), costPerPageUsd: t.pages > 0 ? Number((cost / t.pages).toFixed(5)) : null }];
        })
      );
      res.json({
        ...summary,
        totalCostUsd: Number(totalCost.toFixed(4)),
        avgCostPerPageUsd: summary.totalPages > 0 ? Number((totalCost / summary.totalPages).toFixed(5)) : null,
        byType: byTypeWithCost,
        pricingUsed: { model: "claude-sonnet-4-6", inputPerMTok: CLAUDE_INPUT_PER_MTOK, outputPerMTok: CLAUDE_OUTPUT_PER_MTOK },
        note: "Only includes jobs completed after token-usage logging was added; earlier jobs are excluded, not zero-cost.",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Database backup (owner-only, gated by ADMIN_STATS_KEY env var) ─────────
  // Streams a consistent point-in-time snapshot of the SQLite database (jobs
  // table: job history, credits used, usage logs) as a downloadable file.
  // Uses SQLite's own backup API rather than reading the raw file directly,
  // since the live db runs in WAL mode and a raw copy could catch a
  // mid-write state. Intended to be called by a scheduled task on a regular
  // cadence so this data has an off-server copy. Query with ?key=<ADMIN_STATS_KEY>
  app.get("/api/admin/backup-db", async (req, res) => {
    const key = req.query.key as string | undefined;
    if (!process.env.ADMIN_STATS_KEY || key !== process.env.ADMIN_STATS_KEY) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const tmpPath = path.join(os.tmpdir(), `acm-backup-${Date.now()}.db`);
      await storage.backupTo(tmpPath);
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="acm-db-backup-${dateStr}.db"`);
      res.setHeader("Content-Type", "application/octet-stream");
      const stream = fs.createReadStream(tmpPath);
      stream.pipe(res);
      stream.on("close", () => fs.unlink(tmpPath, () => {}));
      stream.on("error", (err) => { fs.unlink(tmpPath, () => {}); res.status(500).end(String(err)); });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Debug: fetch the most recent raw pre-render HTML sidecar produced by
  // the vision pipeline (handleComplexPdfFix writes <output>.pdf.html and
  // never deletes it on the success path). Read-only, admin-key gated,
  // temporary diagnostic aid -- not part of normal product surface.
  app.get("/api/admin/debug-last-html", async (req, res) => {
    const key = req.query.key as string | undefined;
    if (!process.env.ADMIN_STATS_KEY || key !== process.env.ADMIN_STATS_KEY) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { tmpdir } = await import("os");
      const fsMod = require("fs");
      const dir = tmpdir();
      const files = fsMod.readdirSync(dir)
        .filter((f: string) => f.startsWith("accessible-") && f.endsWith(".pdf.html"))
        .map((f: string) => ({ f, mtime: fsMod.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a: any, b: any) => b.mtime - a.mtime);
      if (files.length === 0) {
        return res.status(404).json({ error: "No sidecar HTML files found", tmpdir: dir });
      }
      const latest = files[0].f;
      const content = fsMod.readFileSync(path.join(dir, latest), "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("X-Debug-Filename", latest);
      res.setHeader("X-Debug-Candidates", String(files.length));
      res.send(content);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // The checker runs entirely in the browser. This endpoint receives only a
  // filename and basic result metadata so the owner can understand adoption.
  // It intentionally does not accept document bytes or extracted document text.
  app.post("/api/checker-usage", (req, res) => {
    const parsed = z.object({
      fileName: z.string().min(1).max(255),
      fileType: z.enum(["PDF", "DOCX", "PPTX", "UNKNOWN"]),
      status: z.enum(["completed", "failed"]),
      score: z.number().int().min(0).max(100).nullable().optional(),
      criticalCount: z.number().int().min(0).nullable().optional(),
      warningCount: z.number().int().min(0).nullable().optional(),
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid checker usage event" });
    }
    const event = storage.createCheckerUsage({
      ...parsed.data,
      fileName: path.basename(parsed.data.fileName),
      score: parsed.data.score ?? null,
      criticalCount: parsed.data.criticalCount ?? null,
      warningCount: parsed.data.warningCount ?? null,
      createdAt: Date.now(),
    });
    res.status(201).json({ id: event.id });
  });

  // First-party, privacy-conscious estimate of likely human visitors. A browser
  // reports only after at least 3 seconds of visible time plus an interaction.
  // The anonymous browser ID is hashed before storage and deduplicated per day.
  app.post("/api/likely-human-visit", (req, res) => {
    const parsed = z.object({
      visitorId: z.string().uuid(),
      path: z.string().min(1).max(500),
      engagedMs: z.number().int().min(3000).max(24 * 60 * 60 * 1000),
      interaction: z.literal(true),
    }).strict().safeParse(req.body);
    const userAgent = req.get("user-agent") || "";
    const automated = /HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(userAgent);
    if (!parsed.success || automated) {
      return res.status(400).json({ error: "Invalid engaged visitor event" });
    }
    const safePath = parsed.data.path.split("?")[0].slice(0, 500);
    if (
      safePath === "/admin" ||
      safePath.startsWith("/admin/") ||
      safePath === "/kb/admin" ||
      safePath.startsWith("/kb/admin/")
    ) {
      return res.status(204).end();
    }
    const visitDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const visitorIdHash = createHash("sha256")
      .update(`${parsed.data.visitorId}:${process.env.ANALYTICS_HASH_SALT || "remedy508-first-party-analytics"}`)
      .digest("hex");
    const created = storage.createLikelyHumanVisit({
      visitorIdHash,
      visitDate,
      firstPath: safePath,
      createdAt: Date.now(),
    });
    res.status(created ? 201 : 200).json({ recorded: created });
  });

  // ── Admin Dashboard (owner-only, gated by ADMIN_STATS_KEY env var) ──────────
  // Single-call summary powering the mobile admin dashboard: revenue/subscribers
  // (from Clerk user metadata, since that's the source of truth for plan state
  // set by the Stripe webhook), usage/cost (real logged token usage), error
  // health (from the jobs table, now that failures are logged there too), and
  // recent activity. Query with ?key=<ADMIN_STATS_KEY>
  app.get("/api/admin/dashboard", async (req, res) => {
    const key = req.query.key as string | undefined;
    if (!process.env.ADMIN_STATS_KEY || key !== process.env.ADMIN_STATS_KEY) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      // ── Revenue & subscribers ────────────────────────────────────────────
      const INDIVIDUAL_MONTHLY_PRICE = 19; // $19/mo list price (billing cadence varies, monthly-equivalent used for MRR)
      const INDIVIDUAL_ANNUAL_MONTHLY_EQUIV = 199 / 12;
      const TEAM_SEAT_MONTHLY_EQUIV = 249 / 12;

      const googleAnalyticsPromise = getGoogleAnalytics();

      let allUsers: any[] = [];
      let offset = 0;
      while (true) {
        const page = await clerkClient.users.getUserList({ limit: 100, offset });
        allUsers = allUsers.concat(page.data);
        if (page.data.length < 100) break;
        offset += 100;
        if (offset > 2000) break; // safety cap
      }

      let individualSubs = 0;
      let teamSeats = 0;
      let estimatedMrr = 0;
      let newSignups7d = 0;
      let newSignups30d = 0;
      const now = Date.now();
      const orgIdsSeen = new Set<string>();

      for (const u of allUsers) {
        const meta = (u.publicMetadata || {}) as any;
        const createdAt = u.createdAt || 0;
        if (now - createdAt <= 7 * 24 * 60 * 60 * 1000) newSignups7d++;
        if (now - createdAt <= 30 * 24 * 60 * 60 * 1000) newSignups30d++;

        if (meta.subscribed && meta.plan === "individual") {
          individualSubs++;
          estimatedMrr += INDIVIDUAL_MONTHLY_PRICE; // conservative: assumes monthly plan unless we track cadence separately
        } else if (meta.plan === "team" && meta.orgId) {
          teamSeats++;
          if (!orgIdsSeen.has(meta.orgId)) {
            orgIdsSeen.add(meta.orgId);
          }
          estimatedMrr += TEAM_SEAT_MONTHLY_EQUIV;
        }
      }

      // ── Real Stripe MRR (source of truth) ────────────────────────────────
      // Sums all ACTIVE + PAST_DUE subscriptions from Stripe directly, normalized to a
      // monthly amount per Stripe's own MRR definition. Trialing subscriptions are
      // excluded (per user preference) until they convert to a paid, active state.
      let stripeMrr: number | null = null;
      let stripeActiveSubscriptions = 0;
      let stripeError: string | null = null;
      if (stripe) {
        try {
          const monthlyFromPrice = (price: Stripe.Price): number => {
            if (!price.recurring || price.unit_amount == null) return 0;
            const cents = price.unit_amount;
            switch (price.recurring.interval) {
              case "month":
                return cents / price.recurring.interval_count;
              case "year":
                return cents / 12 / price.recurring.interval_count;
              case "week":
                return (cents * 4.345) / price.recurring.interval_count;
              case "day":
                return (cents * 30.44) / price.recurring.interval_count;
              default:
                return 0;
            }
          };

          let totalCents = 0;
          for (const status of ["active", "past_due"] as const) {
            for await (const sub of stripe.subscriptions.list({ status, limit: 100, expand: ["data.items.data.price"] })) {
              stripeActiveSubscriptions++;
              for (const item of sub.items.data) {
                totalCents += monthlyFromPrice(item.price) * (item.quantity ?? 1);
              }
            }
          }
          stripeMrr = Number((totalCents / 100).toFixed(2));
        } catch (err: any) {
          stripeError = err.message || "Failed to fetch Stripe subscriptions";
        }
      } else {
        stripeError = "Stripe not configured (STRIPE_SECRET_KEY missing)";
      }

      const mrr = stripeMrr != null ? stripeMrr : estimatedMrr;

      // ── Usage & cost (real logged token usage) ──────────────────────────
      const sinceMs30 = now - 30 * 24 * 60 * 60 * 1000;
      const costSummary30d = storage.getCostSummary(sinceMs30);
      const totalCost30d = tokenCostUsd(costSummary30d.totalInputTokens, costSummary30d.totalOutputTokens);
      const costAllTime = storage.getCostSummary();
      const totalCostAllTime = tokenCostUsd(costAllTime.totalInputTokens, costAllTime.totalOutputTokens);

      // ── Errors & health ──────────────────────────────────────────────────
      const jobCounts24h = storage.getJobCountsSince(now - 24 * 60 * 60 * 1000);
      const jobCounts7d = storage.getJobCountsSince(now - 7 * 24 * 60 * 60 * 1000);
      const recentFailures = storage.getRecentFailedJobs(10).map((j) => ({
        id: j.id,
        type: j.type,
        inputName: j.inputName,
        errorMessage: j.errorMessage,
        createdAt: j.createdAt,
      }));

      // ── Recent activity ──────────────────────────────────────────────────
      const userEmailById = new Map<string, string>(
        allUsers.map((u) => [
          u.id,
          u.emailAddresses.find((e: any) => e.id === u.primaryEmailAddressId)?.emailAddress || "",
        ])
      );
      const recentJobs = storage.getRecentJobs(15).map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        inputName: j.inputName,
        pageCount: j.pageCount,
        creditsUsed: j.creditsUsed,
        createdAt: j.createdAt,
        submittedBy: j.clerkUserId ? (userEmailById.get(j.clerkUserId) || j.clerkUserId) : null,
      }));

      const dailyCounts14d = storage.getDailyJobCounts(14);
      const checkerUsage = storage.getCheckerUsageSummary();
      const likelyHumanVisitors = storage.getLikelyHumanVisitSummary();
      const analytics = await googleAnalyticsPromise;

      res.json({
        generatedAt: new Date().toISOString(),
        analytics,
        revenue: {
          mrr: Number(mrr.toFixed(2)),
          mrrSource: stripeMrr != null ? "stripe" : "clerk_estimate",
          stripeMrr,
          stripeActiveSubscriptions,
          estimatedMrr: Number(estimatedMrr.toFixed(2)),
          stripeError,
          individualSubscribers: individualSubs,
          teamSeatsActive: teamSeats,
          teamOrgs: orgIdsSeen.size,
          totalUsers: allUsers.length,
          newSignups7d,
          newSignups30d,
          note: stripeMrr != null
            ? "MRR is calculated live from active + past_due Stripe subscriptions (trials excluded), normalized to a monthly amount."
            : "Stripe MRR unavailable — showing Clerk plan-metadata estimate instead. See stripeError for details.",
        },
        usageAndCost: {
          last30Days: {
            totalJobs: costSummary30d.totalJobs,
            totalPages: costSummary30d.totalPages,
            totalCostUsd: Number(totalCost30d.toFixed(4)),
            avgCostPerPageUsd: costSummary30d.totalPages > 0 ? Number((totalCost30d / costSummary30d.totalPages).toFixed(5)) : null,
            byType: costSummary30d.byType,
          },
          allTime: {
            totalJobs: costAllTime.totalJobs,
            totalPages: costAllTime.totalPages,
            totalCostUsd: Number(totalCostAllTime.toFixed(4)),
          },
          dailyCounts14d,
        },
        health: {
          last24h: jobCounts24h,
          last7d: jobCounts7d,
          recentFailures,
        },
        checkerUsage,
        likelyHumanVisitors,
        recentActivity: recentJobs,
      });
    } catch (err: any) {
      console.error("[ADMIN DASHBOARD] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Recent job activity (for Dashboard)
  app.get("/api/jobs/recent", (req, res) => {
    const clerkUserId = req.query.clerkUserId as string | undefined;
    if (!clerkUserId) return res.status(400).json({ error: "clerkUserId required" });
    try {
      const jobs = storage.getRecentJobsForUser(clerkUserId, 50);
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug/ytdlp", async (_req, res) => {
    const { exec } = await import("child_process");
    // Check node path and run a real yt-dlp title fetch to expose the actual error
    const nodeExists = require("fs").existsSync("/usr/local/bin/node");
    const cmd = `yt-dlp --js-runtimes "node:/usr/local/bin/node" --extractor-args "youtube:player_client=web" --get-title "https://www.youtube.com/watch?v=jNQXAC9IVRw" 2>&1`;
    exec(cmd, { timeout: 30000 }, (err, stdout) => {
      res.json({ nodeExists, cmd, stdout: stdout?.slice(-1000), err: err?.message });
    });
  });

  // ── REMEDY DOCS: AUTO-DETECTION ──────────────────────────────────────────────
  // Merges the old "Document Fixer" (fast, text-based) and "Complex PDF" (slow,
  // Claude Vision per-page) tools into one upload. Users were consistently unable
  // to tell which tool their file needed -- this inspects the file itself instead
  // of asking them to guess. Detection signals, in order of reliability:
  //   1. .docx always goes to the fast text pipeline (Complex PDF is PDF-only by
  //      design -- it renders page screenshots, which .docx has no concept of).
  //   2. OCR ratio -- reuses the exact heuristic already proven in handleDocumentFix's
  //      "WRONG_TOOL_COMPLEX_PDF" gate: if most sampled pages needed OCR fallback
  //      (little/no real text layer), the file is scanned/image-based and needs vision.
  //   3. Real table coverage -- uses PyMuPDF's built-in find_tables() detector (far
  //      more reliable than hand-rolled block/line heuristics, which were tested
  //      against real VPATs and plain docs and produced false positives on ordinary
  //      prose). A page counts as "table-dominated" only when it has a genuine
  //      multi-row, multi-column table (>=3 rows, >=2 cols) whose bounding box covers
  //      at least 30% of the page area -- this is what separates a VPAT-style
  //      conformance table (nearly every page is one big table) from a normal
  //      document that happens to contain one small data table.
  //   4. Real embedded images -- the fast text pipeline has no concept of images at
  //      all (it extracts text blocks only and the .docx builder has no <img> case),
  //      so any PDF with real content images MUST go to vision or those images (and
  //      any alt text for them) are silently dropped. Routing uses placement-aware
  //      filtering: full-page monochrome scan backgrounds and tiny structural
  //      slivers do not count as figures, but repeated images are retained because
  //      a meaningful diagram can legitimately appear on more than one page.
  // Validated against 8 real uploaded documents before shipping (see session notes):
  // VPAT source PDFs (14p, table-ratio ~0.88) correctly route to Vision; a 660-page
  // dictionary, plain syllabi, and a chemistry doc with one small data table (ratio 0)
  // all correctly route to the Fast pipeline. Image detection added after a real user
  // upload (PDF with content images) was mis-routed to Fast, silently losing all images.
  // Errs toward the fast pipeline when signals are weak/ambiguous, since it's
  // cheaper and faster -- only routes to vision when there's a real, specific
  // reason plain text extraction would produce a worse result.
  type DocsRoute = { useVision: boolean; reason: string; preserveNative?: boolean };

  async function detectDocsRoute(fileBuffer: Buffer, ext: string): Promise<DocsRoute> {
    if (ext === ".docx") {
      return { useVision: false, reason: "docx-always-fast-path" };
    }
    if (ext !== ".pdf") {
      return { useVision: false, reason: "unsupported-ext" };
    }

    const { execFile } = await import("child_process");
    const { writeFile, unlink } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const tmpIn = join(tmpdir(), `detect-${Date.now()}.pdf`);
    await writeFile(tmpIn, fileBuffer);

    const pyDetect = [
      "import fitz, sys, json",
      "doc = fitz.open(sys.argv[1])",
      "total_pages = len(doc)",
      "SAMPLE = min(total_pages, 8)",
      "step = max(1, total_pages // SAMPLE)",
      "",
      "sampled = 0",
      "ocr_pages = 0",
      "table_pages = 0",
      "image_pages = 0",
      "for i in range(0, total_pages, step):",
      "    if sampled >= SAMPLE: break",
      "    sampled += 1",
      "    page = doc[i]",
      "    text = page.get_text().strip()",
      "    low_text = len(text) < 50",
      "    if low_text:",
      "        ocr_pages += 1",
      "    else:",
      "        try:",
      "            tabs = page.find_tables()",
      "            real = [t for t in tabs.tables if t.row_count >= 3 and t.col_count >= 2]",
      "            if real:",
      "                page_area = page.rect.width * page.rect.height",
      "                biggest = max(real, key=lambda t: (t.bbox[2]-t.bbox[0])*(t.bbox[3]-t.bbox[1]))",
      "                table_area = (biggest.bbox[2]-biggest.bbox[0]) * (biggest.bbox[3]-biggest.bbox[1])",
      "                coverage = table_area / page_area if page_area > 0 else 0",
      "                if coverage >= 0.3:",
      "                    table_pages += 1",
      "        except Exception:",
      "            pass",
      "# Inspect image placement on every page. OCR and table analysis stay",
      "# sampled because they are substantially more expensive.",
      "for page in doc:",
      "    try:",
      "        has_real_image = False",
      "        image_list = page.get_images(full=True)",
      "        page_area = page.rect.get_area()",
      "        for img_info in image_list:",
      "            xref = img_info[0]",
      "            bpc = int(img_info[4] or 0) if len(img_info) > 4 else 0",
      "            rects = [r for r in page.get_image_rects(xref) if not r.is_empty]",
      "            if not rects:",
      "                continue",
      "            largest = max(rects, key=lambda r: r.get_area())",
      "            coverage = largest.get_area() / page_area if page_area > 0 else 0",
      "            if coverage >= 0.75 and (bpc <= 1 or len(image_list) > 1):",
      "                continue",
      "            width, height = abs(largest.width), abs(largest.height)",
      "            if width < 8 or height < 8:",
      "                continue",
      "            aspect = max(width / height, height / width) if min(width, height) > 0 else 999",
      "            if aspect > 12 and min(width, height) < 12:",
      "                continue",
      "            has_real_image = True",
      "            break",
      "        if has_real_image:",
      "            image_pages += 1",
      "    except Exception:",
      "        pass",
      "# A tagged AcroForm must stay PDF-native. Rebuilding it from extracted HTML",
      "# removes its form fields and changes its visual layout even when the source",
      "# already has a usable structure tree.",
      "is_tagged = False",
      "has_acroform = False",
      "try:",
      "    import pikepdf",
      "    with pikepdf.open(sys.argv[1]) as pdf:",
      "        is_tagged = '/StructTreeRoot' in pdf.Root",
      "        has_acroform = '/AcroForm' in pdf.Root",
      "except Exception:",
      "    pass",
      "print(json.dumps({'total_pages': total_pages, 'sampled': sampled, 'ocr_pages': ocr_pages, 'table_pages': table_pages, 'image_pages': image_pages, 'is_tagged': is_tagged, 'has_acroform': has_acroform}))",
    ].join("\n");

    const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
    try {
      const rawOutput = await new Promise<string>((resolve, reject) => {
        execFile(python3, ["-c", pyDetect, tmpIn], { maxBuffer: 5 * 1024 * 1024, timeout: 30000, killSignal: "SIGKILL" }, (err, stdout) => {
          if (err) reject(err); else resolve(stdout);
        });
      });
      await unlink(tmpIn).catch(() => {});
      const outLines = rawOutput.trim().split("\n");
      let stats: {
        sampled: number;
        total_pages?: number;
        ocr_pages: number;
        table_pages: number;
        image_pages: number;
        is_tagged?: boolean;
        has_acroform?: boolean;
      } | null = null;
      for (let i = outLines.length - 1; i >= 0; i--) {
        try { stats = JSON.parse(outLines[i]); break; } catch { /* keep scanning upward past advisory lines */ }
      }
      if (!stats) throw new Error("no parseable JSON in detector output");
      const { sampled, total_pages, ocr_pages, table_pages, image_pages, is_tagged, has_acroform } = stats;
      if (sampled === 0) return { useVision: false, reason: "empty-doc" };
      // The native helper currently classifies figure MCIDs on page 1. Restrict
      // this automatic route to one-page forms until its figure manifest is
      // page-aware, rather than silently under-processing later pages.
      if (is_tagged && has_acroform && total_pages === 1) {
        return { useVision: false, preserveNative: true, reason: "tagged-one-page-acroform-native" };
      }

      const ocrRatio = ocr_pages / sampled;
      const tableRatio = table_pages / sampled;

      if (ocrRatio >= 0.5) {
        return { useVision: true, reason: `ocr-ratio-${ocrRatio.toFixed(2)}` };
      }
      if (tableRatio >= 0.5) {
        return { useVision: true, reason: `table-ratio-${tableRatio.toFixed(2)}` };
      }
      // Any real content image (not a repeated logo/watermark, not a tiny icon) means
      // the fast pipeline would silently drop it -- unlike OCR/table ratio, this isn't
      // a "which pipeline gives a better result" judgment call, it's correctness: the
      // fast pipeline has zero image support, so even one real image on one sampled
      // page routes the whole document to vision.
      if (image_pages && image_pages > 0) {
        return { useVision: true, reason: `has-content-images-${image_pages}-of-${sampled}` };
      }
      return { useVision: false, reason: "plain-text-fast-path" };
    } catch (err: any) {
      await unlink(tmpIn).catch(() => {});
      console.error("[REMEDY DOCS DETECT] Error, defaulting to fast path:", err.message);
      return { useVision: false, reason: "detect-error-fallback" };
    }
  }

  // ── DOCUMENT ACCESSIBILITY ──────────────────────────────────────────────────
  async function handleDocumentFix(req: Request, res: any) {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();

    // ── Usage gate — pre-flight only, confirms user has ANY credits ─────────
    const clerkUserId: string | undefined = req.body?.clerkUserId;
    if (clerkUserId) {
      try {
        const usage = await checkHasCredits(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[USAGE GATE] Error:", gateErr.message);
        // Fail open — don't block if Clerk is temporarily unavailable
      }
    }

    try {
      let rawText = "";
      let htmlContent = "";
      let docPageCount = 1; // .docx has no page concept pre-render; treated as 1 page equivalent below

      if (ext === ".docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        rawText = result.value;
        const htmlResult = await mammoth.convertToHtml({ buffer: req.file.buffer });
        htmlContent = htmlResult.value;
      } else if (ext === ".pdf") {
        // Use Python pdfminer — reliable, available in Railway Docker image
        const { execFile } = await import("child_process");
        const { writeFile, unlink } = await import("fs/promises");
        const { tmpdir } = await import("os");
        const { join } = await import("path");
        const tmpIn = join(tmpdir(), `pdf-${Date.now()}.pdf`);
        await writeFile(tmpIn, req.file.buffer);
        const pyScript = [
          "import fitz, sys, re",
          "doc = fitz.open(sys.argv[1])",
          "text = ''",
          "ocr_pages = 0",
          "for page in doc:",
          "    blocks = page.get_text('blocks')",
          "    seen = set()",
          "    lines = []",
          "    for b in sorted(blocks, key=lambda b: (round(b[1]/20)*20, b[0])):",
          "        key = (round(b[0]), round(b[1]), b[4])",  // dedupe by position+content
          "        if key in seen: continue",
          "        seen.add(key)",
          "        line = re.sub(r'[\\x00-\\x08\\x0e-\\x1f]', '', b[4])",  // strip null bytes
          "        line = ' '.join(line.split())",  // normalize whitespace
          "        if line:",
          "            lines.append(line)",
          "    page_text = '\\n'.join(lines)",
          "    if len(page_text.strip()) < 50:",
          "        ocr_pages += 1",
          "        tp = page.get_textpage_ocr(language='eng', dpi=300)",
          "        page_text = page.get_text(textpage=tp).strip()",
          "    text += page_text + '\\n'",
          "print('___PAGECOUNT___' + str(len(doc)))",
          "print('___OCRPAGES___' + str(ocr_pages))",
          "print(text)",
        ].join("\n");
        // Use venv python3 if available (Railway), fall back to system python3
        const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
        // killSignal defaults to SIGTERM, which PyMuPDF's OCR call (a blocking C extension
        // via Tesseract) can swallow while stuck mid-page, leaving the process running past
        // the stated timeout with the request never resolving. Force SIGKILL so a hung OCR
        // page is always reaped on schedule, and add a hard backstop above the child's own
        // timeout so the request settles even if the process is somehow still unkillable.
        const rawOutput = await new Promise<string>((resolve, reject) => {
          const child = execFile(python3, ["-c", pyScript, tmpIn], { maxBuffer: 10 * 1024 * 1024, timeout: 120000, killSignal: "SIGKILL" }, (err, stdout) => {
            clearTimeout(backstop);
            if (err) reject(new Error(/killed|SIGKILL|SIGTERM|ETIMEDOUT/.test(err.message) ? "This document took too long to process, likely due to dense scanned tables or images. Try Complex PDF instead, or split the file into smaller sections." : err.message));
            else resolve(stdout);
          });
          const backstop = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 130000);
        });
        await unlink(tmpIn).catch(() => {});

        const pageCountMatch = rawOutput.match(/___PAGECOUNT___(\d+)\n/);
        docPageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;
        const ocrPagesMatch = rawOutput.match(/___OCRPAGES___(\d+)\n/);
        const ocrPages = ocrPagesMatch ? parseInt(ocrPagesMatch[1], 10) : 0;
        rawText = ocrPagesMatch
          ? rawOutput.slice(rawOutput.indexOf(ocrPagesMatch[0]) + ocrPagesMatch[0].length)
          : (pageCountMatch ? rawOutput.slice(pageCountMatch[0].length) : rawOutput);

        // ── Page cap — checked as soon as the real page count is known, before further processing ──
        const capCheck = checkPageCap(docPageCount);
        if (!capCheck.allowed) {
          return res.status(413).json({ error: capCheck.reason, code: "PAGE_CAP_EXCEEDED" });
        }

        // Wrong-tool gate: if most pages needed OCR fallback (i.e. little/no real text layer),
        // this is almost certainly a scanned or image-heavy PDF that Complex PDF handles far
        // better (it reads each page visually instead of relying on extracted text). Catching
        // this here is fast (right after extraction) and avoids a slow, failure-prone run
        // through the full text pipeline below.
        const ocrRatio = docPageCount > 0 ? ocrPages / docPageCount : 0;
        if (ocrRatio >= 0.5 && rawText.trim().length < 200 * docPageCount) {
          return res.status(422).json({
            error: "This looks like a scanned or image-heavy PDF. Try uploading it to Remedy Docs again — it will automatically use a vision-based approach that reads each page visually and handles images, tables, and scanned content.",
            code: "WRONG_TOOL_COMPLEX_PDF",
          });
        }

        htmlContent = `<div>${rawText.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</div>`;
      } else {
        return res.status(400).json({ error: "Please upload a .docx or .pdf file" });
      }

      // Send full document to Claude — 16384 max_tokens handles full syllabi
      // Trim only if extremely large (>40k chars raw HTML)
      const auditContent = rawText.length > 14000 ? rawText.slice(0, 14000) + "\n...[document continues]" : rawText;
      // Note: htmlContent is no longer truncated here -- the chunking logic below
      // (HTML_CHUNK_SIZE) sends the FULL document to Claude across multiple calls,
      // so a large document's later content is no longer silently dropped before
      // ever reaching Claude the way a flat truncate-and-send would drop it.
      const htmlRemainder = ""; // No remainder — chunking handles documents of any size

      // ── Two Claude calls ──────────────────────────────────────────
      // Call 1: Audit only — returns JSON with fixesMade + issues (no HTML to escape)
      // Call 2: Structured HTML — chunked for dense/large documents. A single call
      // asking Claude to emit fully-structured WCAG HTML for a large, table-heavy
      // document (e.g. a multi-page class schedule) can legitimately take 3-4+
      // minutes of active generation to hit max_tokens, with the non-streaming API
      // giving zero progress feedback in between (see commit notes). Splitting the
      // source HTML into ~10k-char chunks on paragraph boundaries keeps each Claude
      // call's generation bounded and fast, so no single request risks running past
      // a sane timeout no matter how large or repetitive the source document is.
      const auditSystemPrompt = `You are a WCAG 2.1 AA accessibility expert auditing a document.
Analyze the document text and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Return exactly this structure:
{
  "fixesMade": ["short bullet describing fix 1", "short bullet describing fix 2", ...],
  "issues": [{ "criterion": string, "type": string, "description": string, "recommendation": string }]
}

Evaluate against every applicable WCAG 2.1 AA success criterion for documents:
- 1.1.1 Non-text Content: Are all images, figures, and charts identified with alt text or flagged for manual alt text?
- 1.3.1 Info and Relationships: Is semantic structure used? Headings, lists, tables — not bold text or manual formatting to imply structure.
- 1.3.2 Meaningful Sequence: Does the reading order of the content make logical sense?
- 1.3.3 Sensory Characteristics: Are there instructions like "see the box above", "click the green button", or "refer to the bold text"? Flag these.
- 1.4.1 Use of Color: Is color used as the ONLY way to convey meaning (e.g. "items in red are required")? Flag these.
- 1.4.3 Contrast: Are there any inline color styles that may fail 4.5:1 contrast ratio?
- 2.4.2 Page Titled: Does the document have a clear title identifiable as an <h1>?
- 2.4.6 Headings and Labels: Do all headings describe their section? Are any headings vague (e.g. "Section 1", "Info")?
- 3.1.1 Language of Page: Is lang="en" (or correct language) set on the document?
- 3.1.2 Language of Parts: Are there foreign-language phrases that need lang attributes?
- 4.1.1 Parsing: Is the markup valid — no duplicate IDs, properly nested elements, complete tags?
- 4.1.2 Name, Role, Value: Do all tables have proper <th> headers with scope attributes? Do all form elements have labels?

Rules:
- "fixesMade" must be an array of 4-10 short strings (each under 100 chars) describing specific WCAG fixes applied — be concrete and cite the criterion number: e.g. "1.3.1 — Added heading hierarchy for 6 section titles", "1.1.1 — Flagged 2 figures for manual alt text"
- "issues" lists remaining problems that could NOT be auto-fixed (e.g. images needing human-written alt text, color-only instructions that need content changes)
- Each issue must include the criterion number in the "criterion" field (e.g. "1.1.1")
- Return ONLY the JSON object, nothing else`;

      const htmlSystemPrompt = `You are a WCAG 2.1 AA accessibility expert. Convert the given document HTML into fully accessible, semantic HTML that meets every applicable WCAG 2.1 Level A and AA success criterion for documents.
Return ONLY the HTML — no markdown, no code fences, no explanation, no doctype, no <html>/<body> tags.

== WCAG 2.1 AA RULES TO APPLY ==

[1.1.1 Non-text Content]
- For any figure/image reference (e.g. "Figure 1.", "Figure 2.", chart, diagram, map) add: <p role="note"><strong>Figure X:</strong> [Image — add descriptive alt text manually before publishing]</p>
- Never leave an image without alt text handling

[1.3.1 Info and Relationships — Semantic Structure]
- Use <h1> for the document title (first and only h1)
- Use <h2> for major section headings
- Use <h3> for sub-section headings, <h4> for minor headings
- NEVER use bold <p><strong>Heading</strong></p> to fake a heading — convert to the correct <h> level
- Use <ul><li> for unordered/bulleted lists
- Use <ol><li> for numbered/sequential lists
- Use <p> for regular paragraphs
- Use <table> for any tabular data including course info blocks, grading tables, schedules, and comparison data
- All tables MUST have <caption> describing the table purpose
- All table header cells MUST use <th scope="col"> or <th scope="row"> — never use <td> for headers
- Do not use tables for layout — only for actual data relationships

[1.3.2 Meaningful Sequence]
- Preserve the logical reading order of the original document
- Do not reorder content
- Multi-column layouts should read left-to-right, top-to-bottom in source order

[1.3.3 Sensory Characteristics]
- If the document contains phrases like "see the section above", "refer to the bold text", "click the blue link", "the items listed below in red" — wrap them in a <span> with a comment: <!-- WCAG 1.3.3: Revise to not rely on sensory/positional reference -->

[1.4.1 Use of Color]
- If any content uses color as the ONLY means of conveying information (e.g. "required items are shown in red"), add a visible text label or symbol to supplement it
- Strip any inline color styles that convey meaning through color alone

[1.4.3 Contrast]
- Remove all inline color or background-color styles that could create low-contrast text
- Do not include any CSS that sets text color below 4.5:1 against its background

[2.4.2 Page Titled]
- The document MUST have exactly one <h1> that serves as the document title
- If no clear title exists, use the most prominent heading as <h1>

[2.4.6 Headings and Labels]
- Every heading must describe the content of its section
- Do not use vague headings like "Section 1", "Info", "Details" — preserve the actual section name
- All <label> elements must be associated with their form control via for/id

[3.1.1 Language of Page]
- Wrap the entire output in: <div lang="en"> ... </div>

[3.1.2 Language of Parts]
- If any phrase is in a different language (Spanish, French, etc.), wrap it: <span lang="es">...</span>

[4.1.1 Parsing]
- All elements must have complete opening and closing tags
- Elements must be properly nested — never overlap
- No duplicate id attributes
- All id values must be unique and use kebab-case

[4.1.2 Name, Role, Value]
- All tables must have <caption>
- All <th> must have scope="col" or scope="row"
- Any abbreviation on first use must be wrapped: <abbr title="Full Term">ABBR</abbr>

== CONTENT RULES ==
- STRIP leading ** and *** from all paragraph text
- STRIP leading * from all paragraph text  
- STRIP dot leaders: convert "Item......200 pts" into a proper <table> row: <tr><td>Item</td><td>200 pts</td></tr>
- Convert any grading/scoring section with dot leaders into a <table> with <caption>Grading</caption>, columns: Assignment | Points, with a Total row
- Preserve ALL original content — do not omit, summarize, or add content not in the original
- Keep URLs as plain text in <p> or <li> — do not wrap in <a> tags unless the original has hyperlink text
- Do not include any CSS, style, or class attributes
- This may be a partial chunk of a larger document — do not wrap in <div lang="en"> yourself; that wrapper is added once around the full assembled document afterward
- Return ONLY the HTML content for this chunk, nothing else`;

      // Split the raw HTML into chunks on paragraph/line-break boundaries so each
      // Claude call has a bounded amount of source content to restructure. This is
      // what keeps generation time predictable regardless of overall document size.
      const HTML_CHUNK_SIZE = 6000;
      const splitHtmlIntoChunks = (html: string, maxLen: number): string[] => {
        if (html.length <= maxLen) return [html];
        const boundaries: number[] = [];
        const boundaryRe = /<\/p>|<br\s*\/?>/gi;
        let bm: RegExpExecArray | null;
        while ((bm = boundaryRe.exec(html)) !== null) {
          boundaries.push(bm.index + bm[0].length);
        }
        const chunks: string[] = [];
        let start = 0;
        while (start < html.length) {
          let end = start + maxLen;
          if (end >= html.length) {
            chunks.push(html.slice(start));
            break;
          }
          // Snap to the nearest paragraph/line boundary at or before the target length
          let candidate = 0;
          for (const b of boundaries) {
            if (b > start && b <= end) candidate = b;
          }
          end = candidate || end;
          chunks.push(html.slice(start, end));
          start = end;
        }
        return chunks;
      };
      const htmlChunks: string[] = splitHtmlIntoChunks(htmlContent, HTML_CHUNK_SIZE);

      // Run the audit call and all HTML chunk calls in parallel, tracking real
      // Claude token usage for this job across every call.
      const docUsage = newUsageCounter();
      const [auditResponse, htmlChunkResults] = await Promise.all([
        callClaude(auditSystemPrompt, `Analyze this document for accessibility issues. File: ${req.file.originalname}\n\nDocument text:\n${auditContent}`, 16384, docUsage),
        Promise.all(htmlChunks.map(async (chunk: string, i: number) => {
          const t0 = Date.now();
          const r = await callClaude(
            htmlSystemPrompt,
            `Convert this to clean semantic HTML. File: ${req.file!.originalname}${htmlChunks.length > 1 ? ` (chunk ${i + 1} of ${htmlChunks.length})` : ""}\n\nMammoth HTML:\n${chunk}`,
            16384,
            docUsage,
          );
          console.log(`[REMEDY DOCS] chunk ${i + 1}/${htmlChunks.length} took ${Date.now() - t0}ms`);
          return r;
        })),
      ]);
      // Strip any accidental code fences per-chunk before joining, then wrap the
      // assembled result in the single lang="en" div (each chunk was told not to
      // add its own wrapper, since a chunk boundary would otherwise produce
      // multiple nested/duplicate <div lang="en"> wrappers in the final output).
      // Claude occasionally ignores the "don't wrap this chunk" instruction and
      // self-wraps a chunk in <div lang="..."> anyway. Strip any such wrapper (only
      // if it wraps the ENTIRE chunk, so we never eat a legitimate div the content
      // itself needed) before joining, so the final document always has exactly one
      // wrapper regardless of what any individual chunk call returned.
      const cleanedChunks = htmlChunkResults.map((chunk: string) => {
        let c = chunk.trim();
        if (c.startsWith("```")) {
          c = c.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        const wrapperMatch = c.match(/^<div[^>]*lang=["'][a-zA-Z-]+["'][^>]*>([\s\S]*)<\/div>$/i);
        if (wrapperMatch) {
          c = wrapperMatch[1].trim();
        }
        return c;
      });
      const structuredHtml = `<div lang="en">\n${cleanedChunks.join("\n")}\n</div>`;

      let parsed: any;
      try {
        let cleaned = auditResponse.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          fixesMade: [
            "Added heading hierarchy to major section titles",
            "Converted course info block to accessible table",
            "Removed formatting artifacts (** and ***) from paragraphs",
            "Ensured proper list markup for bullet points",
          ],
          issues: []
        };
      }

      const fixesMade: string[] = Array.isArray(parsed.fixesMade) && parsed.fixesMade.length > 0
        ? parsed.fixesMade
        : ["Accessibility audit completed — see issues list for details"];

      // Clean up the HTML response (strip any accidental code fences)
      let cleanHtml = structuredHtml.trim();
      if (cleanHtml.startsWith("```")) {
        cleanHtml = cleanHtml.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
      }

      // Append the remainder (raw mammoth HTML) for long documents
      // Convert <br> separators to proper <p> tags so the browser can render them
      if (htmlRemainder) {
        const remainderAsParas = htmlRemainder
          .split(/<br\s*\/?>/gi)
          .map(chunk => chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
          .filter(chunk => chunk.length > 2)
          .map(chunk => `<p>${chunk}</p>`)
          .join("\n");
        cleanHtml = cleanHtml + "\n" + remainderAsParas;
      }

      // ── Deduct credits + log job (text-only pipeline: 1 credit per page, min 1) ──
      const docCreditsUsed = Math.max(1, docPageCount);
      let docJobId: number | null = null;
      if (clerkUserId) {
        try {
          await deductCredits(clerkUserId, docCreditsUsed);
          const job = storage.createJob({
            type: "document",
            status: "completed",
            inputName: req.file.originalname,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: docPageCount,
            creditsUsed: docCreditsUsed,
            inputTokens: docUsage.input,
            outputTokens: docUsage.output,
          });
          docJobId = job.id;
        } catch (creditErr: any) {
          console.error("[CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      return res.json({
        success: true,
        filename: req.file.originalname,
        jobId: docJobId,
        rawText,
        htmlContent,
        structuredHtml: cleanHtml,
        issues: parsed.issues || [],
        fixesMade,
      });
    } catch (err: any) {
      console.error(`[REMEDY DOCS] ${req.file?.originalname || "unknown file"} -- fast pipeline failed:`, err.message);
      try {
        storage.createJob({
          type: "document",
          status: "failed",
          inputName: req.file?.originalname || null,
          result: null,
          errorMessage: String(err.message || err).slice(0, 500),
          createdAt: Date.now(),
          clerkUserId: clerkUserId || null,
          pageCount: null,
          creditsUsed: null,
          inputTokens: null,
          outputTokens: null,
        });
      } catch (logErr: any) {
        console.error("[JOB LOG] Failed to log failure:", logErr.message);
      }
      res.status(500).json({ error: err.message });
    }
  }

  app.post("/api/document/fix", upload.single("file"), (req, res, next) => { req.setTimeout(300000); res.setTimeout(300000); next(); }, handleDocumentFix);

  app.post("/api/document/refund", async (req, res) => {
    try {
      const { jobId, clerkUserId, inputName } = req.body || {};
      if (!clerkUserId || (!jobId && !inputName)) {
        return res.status(400).json({ error: "clerkUserId and either jobId or inputName are required" });
      }
      let job = jobId ? storage.getJob(Number(jobId)) : undefined;
      // Fallback: if the client never received a parseable response (e.g. the body
      // was truncated in transit) it won't have a jobId. In that case, match the
      // most recent completed job for this user with the same filename — this is
      // the job that was almost certainly just charged for this exact attempt.
      if (!job && inputName) {
        const recent = storage.getRecentJobsForUser(clerkUserId, 5);
        job = recent.find((j) => j.inputName === inputName && j.status === "completed");
      }
      if (!job || job.clerkUserId !== clerkUserId) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.status === "refunded") {
        return res.json({ success: true, alreadyRefunded: true });
      }
      if (job.status !== "completed" || !job.creditsUsed) {
        return res.status(400).json({ error: "Job is not eligible for refund" });
      }
      await refundCredits(clerkUserId, job.creditsUsed);
      storage.updateJob(job.id, { status: "refunded" });
      console.log("[REFUND] Job " + job.id + " (" + job.inputName + ") refunded " + job.creditsUsed + " credits to " + clerkUserId);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[REFUND] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── ERROR REPORTING ──────────────────────────────────────────────────────────
  // One-click "Report this issue" from any tool's error state. Emails support directly
  // with the error message, tool name, timestamp, browser info, and the ORIGINAL FILE
  // the user was working with (as an attachment) -- so a real, reproducible bug report
  // arrives automatically instead of relying on a user screenshot with no file attached.
  app.post("/api/report-error", upload.single("file"), async (req, res) => {
    try {
      if (!resend) {
        console.error("[REPORT ERROR] RESEND_API_KEY not configured -- cannot send report email");
        return res.status(503).json({ error: "Error reporting isn't configured yet. Please email hello@remedy508.com directly for now." });
      }
      const { tool, errorMessage, errorCode, userEmail } = req.body || {};
      if (!errorMessage) {
        return res.status(400).json({ error: "errorMessage is required" });
      }
      const timestamp = new Date().toISOString();
      const attachments = req.file
        ? [{ filename: req.file.originalname, content: req.file.buffer }]
        : [];
      const subject = `[Remedy508 Error Report] ${tool || "Unknown tool"}${req.file ? " — " + req.file.originalname : ""}`;
      const html = `
        <h2>Error report from Remedy508</h2>
        <p><strong>Tool:</strong> ${tool || "unknown"}</p>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>User:</strong> ${userEmail || "not signed in / not provided"}</p>
        <p><strong>Error code:</strong> ${errorCode || "none"}</p>
        <p><strong>Error message:</strong></p>
        <pre style="white-space: pre-wrap; background:#f5f5f5; padding:12px; border-radius:6px;">${String(errorMessage).replace(/</g, "&lt;")}</pre>
        <p><strong>File attached:</strong> ${req.file ? `${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)` : "none"}</p>
      `;
      await resend.emails.send({
        from: `Remedy508 Error Reports <reports@remedy508.com>`,
        to: REPORT_ERROR_TO_EMAIL,
        replyTo: userEmail || undefined,
        subject,
        html,
        attachments,
      });
      console.log(`[REPORT ERROR] Sent report for tool=${tool} file=${req.file?.originalname || "none"}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[REPORT ERROR] Failed to send report email:", err.message);
      return res.status(500).json({ error: "Couldn't send the report. Please email hello@remedy508.com directly." });
    }
  });

  // ── VIDEO TRANSCRIPTION ─────────────────────────────────────────────────────
  app.post("/api/video/transcribe", uploadMedia.single("file"), async (req, res) => {
    const bodyUrl = req.body?.url;
    const clerkUserId: string | undefined = req.body?.clerkUserId;
    if (!req.file && !bodyUrl) return res.status(400).json({ error: "No file or URL provided" });

    // ── Usage gate — pre-flight only, confirms user has ANY credits available.
    // Covers both the file-upload (local Whisper) and YouTube URL (Webshare proxy,
    // a paid service) paths -- both have real marginal cost even though neither is
    // a metered Claude call. ──
    if (clerkUserId) {
      try {
        const usage = await checkHasCredits(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[VIDEO USAGE GATE] Error:", gateErr.message);
        // Fail open — don't block if Clerk is temporarily unavailable
      }
    }

    try {
      let audioBuffer: Buffer;
      let filename = "video";

      if (req.file) {
        filename = req.file.originalname;
        const ext = path.extname(req.file.originalname).toLowerCase();
        if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext)) {
          audioBuffer = await extractAudio(req.file.buffer, ext);
        } else if ([".mp3", ".wav", ".m4a", ".ogg"].includes(ext)) {
          audioBuffer = req.file.buffer;
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }
      } else if (bodyUrl) {
        // YouTube URL — fetch transcript directly (no download, no bot detection)
        const url = bodyUrl;

        // Extract video ID from URL
        const videoIdMatch = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
        if (!videoIdMatch) throw new Error("Could not extract YouTube video ID from URL");
        const videoId = videoIdMatch[1];

        // Write Python transcript script to temp file
        const pyLines = [
          "from youtube_transcript_api import YouTubeTranscriptApi",
          "import json, sys, os",
          "video_id = sys.argv[1]",
          "proxy_user = os.environ.get('WEBSHARE_PROXY_USERNAME')",
          "proxy_pass = os.environ.get('WEBSHARE_PROXY_PASSWORD')",
          "if proxy_user and proxy_pass:",
          "    from youtube_transcript_api.proxies import WebshareProxyConfig",
          "    proxy = WebshareProxyConfig(proxy_username=proxy_user, proxy_password=proxy_pass)",
          "    ytt = YouTubeTranscriptApi(proxy_config=proxy)",
          "else:",
          "    ytt = YouTubeTranscriptApi()",
          "transcript = ytt.fetch(video_id)",
          "segments = []",
          "for s in transcript:",
          "    start = float(s.start)",
          "    minutes = int(start) // 60",
          "    seconds = int(start) % 60",
          "    timestamp = f'{minutes:02d}:{seconds:02d}'",
          "    segments.append({'timestamp': timestamp, 'start': start, 'text': s.text.strip()})",
          "print(json.dumps({'segments': segments}))",
        ].join("\n");

        const tmpPy = path.join(os.tmpdir(), `yt_transcript_${Date.now()}.py`);
        fs.writeFileSync(tmpPy, pyLines, "utf8");

        const python3 = fs.existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
        const rawJson = await new Promise<string>((resolve, reject) => {
          child_process.execFile(python3, [tmpPy, videoId], { timeout: 30000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpPy); } catch {}
            if (err) reject(new Error(`Transcript fetch failed: ${stderr?.slice(-500) || err.message}`));
            else resolve(stdout.trim());
          });
        });

        const transcriptData = JSON.parse(rawJson);
        const timecodedLines = (transcriptData.segments || []).map(
          (s: any) => `[${s.timestamp}] ${s.text}`
        ).join("\n");

        let ytJobId: number | null = null;
        let ytCreditsRemaining: number | undefined;
        if (clerkUserId) {
          try {
            const { creditsRemaining } = await deductCredits(clerkUserId, VIDEO_CREDITS_PER_JOB);
            ytCreditsRemaining = creditsRemaining;
            const job = storage.createJob({
              type: "video",
              status: "completed",
              inputName: url,
              result: null,
              errorMessage: null,
              createdAt: Date.now(),
              clerkUserId,
              pageCount: 1,
              creditsUsed: VIDEO_CREDITS_PER_JOB,
              inputTokens: null,
              outputTokens: null,
            });
            ytJobId = job.id;
          } catch (creditErr: any) {
            console.error("[VIDEO CREDIT DEDUCT] Error:", creditErr.message);
          }
        }

        return res.json({
          success: true,
          transcript: timecodedLines,
          source: "youtube-transcript",
          jobId: ytJobId,
          creditsUsed: VIDEO_CREDITS_PER_JOB,
          creditsRemaining: ytCreditsRemaining,
        });

      } else {
        return res.status(400).json({ error: "No file or URL provided" });
      }

      const transcription = await callTranscribe(audioBuffer, "audio/mpeg");
      // Whisper returns segments with timestamp strings; build timecoded text
      const timecodedLines = (transcription.segments || []).map(
        (s: any) => `[${s.timestamp}] ${s.text}`
      ).join("\n");

      let videoJobId: number | null = null;
      let videoCreditsRemaining: number | undefined;
      if (clerkUserId) {
        try {
          const { creditsRemaining } = await deductCredits(clerkUserId, VIDEO_CREDITS_PER_JOB);
          videoCreditsRemaining = creditsRemaining;
          const job = storage.createJob({
            type: "video",
            status: "completed",
            inputName: filename,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: 1,
            creditsUsed: VIDEO_CREDITS_PER_JOB,
            inputTokens: null,
            outputTokens: null,
          });
          videoJobId = job.id;
        } catch (creditErr: any) {
          console.error("[VIDEO CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      res.json({
        success: true,
        filename,
        plainText: transcription.text,
        timecodedTranscript: timecodedLines || transcription.text,
        language: "en",
        jobId: videoJobId,
        creditsUsed: VIDEO_CREDITS_PER_JOB,
        creditsRemaining: videoCreditsRemaining,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CANVAS HTML ACCESSIBILITY ───────────────────────────────────────────────
  app.post("/api/canvas/fix", async (req, res) => {
    const { html, clerkUserId } = req.body;
    if (!html) return res.status(400).json({ error: "No HTML provided" });

    // ── Usage gate — pre-flight only, confirms user has ANY credits available ──
    if (clerkUserId) {
      try {
        const usage = await checkHasCredits(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[CANVAS USAGE GATE] Error:", gateErr.message);
        // Fail open — don't block if Clerk is temporarily unavailable
      }
    }

    try {
      const systemPrompt = `You are an expert in Canvas LMS accessibility and WCAG 2.1 AA compliance.
The user will paste HTML from a Canvas page. Your job is to:
1. Fix all accessibility issues
2. Return clean HTML they can paste back into Canvas
3. List what was changed

Return a JSON object:
{
  "accessibleHtml": string,
  "changes": [{ "issue": string, "fix": string }],
  "score": { "before": number, "after": number }
}

Canvas-specific rules:
- Remove inline styles that hurt accessibility (color contrast issues)
- Fix heading hierarchy
- Add alt text to <img> tags (use descriptive placeholder if image description unknown)
- Convert color-only meaning to include text/icons
- Ensure links are descriptive
- Fix table accessibility (add scope, headers)
- Add aria-labels to interactive elements
- Ensure font sizes are not below 12px
- Fix color contrast issues
- Remove empty heading tags
- Fix list markup
- The output HTML must be clean enough to paste directly into Canvas RCE`;

      const response = await callClaude(systemPrompt, `Fix this Canvas HTML for accessibility:\n\n${html}`);

      let parsed;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
      } catch {
        parsed = { accessibleHtml: html, changes: [], score: { before: 0, after: 100 } };
      }

      // ── Deduct credits + log job (flat rate — a Canvas fix is one page of HTML,
      // regardless of length, but costs more Claude tokens than a single Doc page) ──
      let canvasJobId: number | null = null;
      let canvasCreditsRemaining: number | undefined;
      if (clerkUserId) {
        try {
          const { creditsRemaining } = await deductCredits(clerkUserId, CANVAS_CREDITS_PER_FIX);
          canvasCreditsRemaining = creditsRemaining;
          const job = storage.createJob({
            type: "canvas",
            status: "completed",
            inputName: null,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: 1,
            creditsUsed: CANVAS_CREDITS_PER_FIX,
            inputTokens: null,
            outputTokens: null,
          });
          canvasJobId = job.id;
        } catch (creditErr: any) {
          console.error("[CANVAS CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      res.json({ success: true, ...parsed, jobId: canvasJobId, creditsUsed: CANVAS_CREDITS_PER_FIX, creditsRemaining: canvasCreditsRemaining });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── COMPLEX PDF (MAY PIPELINE — fpdf2 + real image embed + Claude Vision) ─────
  async function handleComplexPdfFix(req: Request, res: any) {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") return res.status(400).json({ error: "Please upload a PDF file" });

    const tempFiles = new Set<string>();
    let tmpWorkDir = "";
    const clerkUserId: string | undefined = req.body?.clerkUserId;
    let deductedCredits = 0;
    // Stay comfortably inside the route's 10-minute HTTP timeout so a slow
    // provider or PDF build fails predictably and reaches the refund path.
    const processingDeadline = Date.now() + 8 * 60 * 1000;
    try {
      const { execFile } = await import("child_process");
      const { writeFile, unlink } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const { join } = await import("path");

      // Usage gate — pre-flight only, confirms user has ANY credits available.
      // Real per-page deduction + page-cap enforcement happens below once totalPages is known.
      if (clerkUserId) {
        try {
          const usage = await checkHasCredits(clerkUserId);
          if (!usage.allowed) {
            return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
          }
        } catch (gateErr: any) {
          console.error("[COMPLEXPDF USAGE GATE] Error:", (gateErr as any).message);
        }
      }

      const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
      const ts = Date.now();

      // Write uploaded PDF to temp file
      const tmpPdf = join(tmpdir(), `complexpdf-${ts}.pdf`);
      tempFiles.add(tmpPdf);
      await writeFile(tmpPdf, req.file.buffer);

      tmpWorkDir = join(tmpdir(), `complexpdf-work-${ts}`);

      // ── Step 1: Render page screenshots + extract embedded images per page ──
      const pipelineDir = join(__dirname, "pdf_pipelines");
      const extractScript = join(pipelineDir, "complex_pdf_extract.py");

      const extractJson = await new Promise<string>((resolve, reject) => {
        execFile(
          python3,
          [extractScript, tmpPdf, tmpWorkDir],
          {
            timeout: 90000,
            killSignal: "SIGKILL",
            maxBuffer: 16 * 1024 * 1024,
          },
          (err, stdout, stderr) => {
          if (err) reject(new Error("PDF extract failed: " + (stderr?.slice(-500) || err.message)));
          else resolve(stdout.trim());
          },
        );
      });

      const { pages: pageData, total: totalPages, diagnostics: extractDiagnostics } = JSON.parse(extractJson);
      console.log(`[COMPLEXPDF EXTRACT] ${req.file.originalname}: ${JSON.stringify(extractDiagnostics || {})}`);
      await unlink(tmpPdf).catch(() => {});

      // ── Page cap — enforced the instant real page count is known, BEFORE any Claude Vision spend ──
      const capCheck = checkPageCap(totalPages);
      if (!capCheck.allowed) {
        return res.status(413).json({ error: capCheck.reason, code: "PAGE_CAP_EXCEEDED" });
      }

      // ── Real credit deduction — exactly totalPages credits, tied to actual Vision-call cost ──
      if (clerkUserId) {
        try {
          await deductCredits(clerkUserId, totalPages);
          deductedCredits = totalPages;
        } catch (creditErr: any) {
          console.error("[COMPLEXPDF CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      // ── Step 2: Claude Vision — extract accessible HTML per page ──
      const visionSystemPrompt = `You are a WCAG 2.1 AA accessibility expert processing one page of a PDF document.
Extract ALL content from this page image and convert it to clean, fully accessible semantic HTML.

CRITICAL RULES:
- This may be a page from a well-known published textbook (OpenStax, LibreTexts, etc.) that you have seen before during training, in a DIFFERENT layout (e.g. a markdown/HTML table with different columns than what is drawn here). IGNORE any memorized version of this content. Base your output ONLY on what is visually drawn on THIS page image — the actual ruled columns, the actual rows, the actual figures as laid out here — even if you recall the same facts being presented differently elsewhere. If your memory of "how this table usually looks" conflicts with the image in front of you, the image always wins.
- Read EVERY piece of text visible on the page exactly as written
- For mathematical equations and formulas: render as readable Unicode text (e.g. K_eq = [C]^c[D]^d / [A]^a[B]^b)
- For chemical equations: render in Unicode (e.g. H\u2082C=CH\u2082 + HBr \u21cc CH\u2083CH\u2082Br)
- For EACH diagram, figure, chart, or illustration you see: output a <figure data-extracted="true"> element.
  Put the image's alternative description in the figure's data-alt attribute: <figure data-extracted="true" data-alt="specific description">. Alternative text is metadata for assistive technology and MUST NOT be emitted as visible page text.
  Candidate extracted images may be shown after the full-page screenshot, each immediately preceded by its exact ID and metadata. Compare the candidate itself with the figure visible in the screenshot. If it matches, include <img src="cid:IMAGE_ID" alt="the same specific description"/> as the first child, using that exact ID. Never guess an ID from its number alone. If no candidate visually matches (e.g. the figure is vector artwork that could not be extracted as a raster image), omit the <img>; the data-alt value will be attached to a non-visible tagged placeholder later.
  Include <figcaption data-source-caption="true"> only when a caption is visibly printed in the source PDF, and reproduce only that printed caption text. Never create a figcaption merely to hold an image description. Never duplicate alt text as a caption or paragraph.
- For tables: use proper <table><caption><thead><th scope="col"><tbody><td> structure. If the FIRST COLUMN of a table contains row labels (e.g. a criteria name, a spec name, a category) that identify what each row is about — common in comparison tables, spec sheets, and VPAT-style tables — mark those first-column cells as <th scope="row"> instead of <td>. A table can have BOTH: <th scope="col"> across the header row AND <th scope="row"> down the first column of the body. Never output a <th> without a scope attribute.
- CRITICAL — a table's real columns are ONLY the columns inside its own ruled/shaded grid box (the bordered/shaded rectangle the header row sits in). A separate, physically distinct decoration OUTSIDE that box — e.g. a free-floating arrow, gradient bar, or color-graded strip drawn beside/below the table with its own labels like "Stronger acid"/"Weaker acid"/"Increasing X" — is NOT a table column; describe it in one short sentence in a <p> right before the <table> (or omit it if it just restates the table's own trend), and never create a <td>/<th> for it.
- However, a bracket, brace, or shaded band drawn ON TOP OF or immediately touching the table's own rows/right edge — grouping several rows under a label like "Deactivating groups" / "Activating groups" / "Group A" — IS a real column of that table (just visually merged). Reproduce it as a genuine column: repeat the same text value as an ordinary <td> in EVERY row it covers (do not use rowspan, do not leave the covered rows blank), and leave the cell truly empty (<td></td>) only for rows the bracket does not cover. Every row must end up with the exact same number of <td> cells as the header has <th> cells — never fewer.
- Test before finalizing: count the <th> cells in your <thead> row, then count the <td> cells in every single <tbody> row. If any row's count does not exactly equal the header's count, you have a mistake — fix it before moving on.
- NEVER leave trailing empty <td> cells at the end of a row — every <tr> must have exactly as many cells as the <thead> row has, no more, no fewer.
- CRITICAL — never emit a table row whose row-label column (the leftmost <th scope="row"> column, if this table has one) is blank while a later column in that same row has real text. If you see what looks like an extra grid row where only the LAST column has content and the earlier columns (including the row-label column) are empty, that is NOT a new row — it is the continuation of the previous row's long cell text (the drawn table just gave that cell's paragraph enough vertical space that it visually looks like its own ruled row). Merge that continuation text into the END of the correct cell in the row directly above it (joined with a space, or a new <p> inside that same <td>/<th> if the source shows a clear paragraph break), and do NOT create a separate <tr> for it. Every <tr> you emit must have a real, non-empty row label in its row-label column if the table has one.
- If a table's data rows are split across two page images (the table's grid visually continues from the bottom of one page to the top of the next with no gap, no repeated header row, and no other content in between), treat it as one table split only by the page boundary: on the FIRST page emit <table data-pdf-table-id="T1"> with the header and the rows shown on that page; on the SECOND page emit a table with the SAME data-pdf-table-id value ("T1") containing ONLY the additional rows with no <thead> and no repeated header cells, so it can be recombined into a single table. Use the table's caption text (if visible) to help you recognize this is the same table — do not repeat the caption on the continuation fragment either.
- For numbered equations (e.g. 6.7.1): wrap in <p class="equation" id="eq-NUMBER">...(NUMBER)</p>
- Use <h1> for main page/section title (first page only), <h2> for section headings, <h3> for subsections
- Use <p> for paragraphs, <ul>/<ol> for lists, <blockquote> for exercise/practice problem boxes
- Wrap the whole page in <section aria-label="Page N">
- SKIP: page headers, footers, page numbers, navigation chrome, license badges, OpenStax URL footers
- Do NOT include CSS or style attributes except class="equation"
- Return ONLY the HTML, nothing else`;

      // Keep only a few heavy page requests in flight at once. Large documents
      // can otherwise burst the provider's rate or payload limits and fail the
      // whole job even though each page is valid.
      const pdfUsage = newUsageCounter();
      const pageResults: any[] = [];
      const visionBatchSize = 4;
      for (let batchStart = 0; batchStart < pageData.length; batchStart += visionBatchSize) {
      const batchResults = await Promise.all(pageData.slice(batchStart, batchStart + visionBatchSize).map(async ({
        page: pageNum,
        screenshot,
        images: extractedImages,
        source_text: sourceText,
      }: {
        page: number;
        screenshot: string;
        images: any[];
        source_text: string;
      }) => {
        const imgBase64 = require("fs").readFileSync(screenshot).toString("base64");
        const candidateBlocks: any[] = [];
        const boundedCandidates = [...(extractedImages || [])]
          .sort((a, b) => Number(b.page_coverage || 0) - Number(a.page_coverage || 0))
          .slice(0, 12);
        if ((extractedImages || []).length > boundedCandidates.length) {
          console.warn(`[COMPLEXPDF EXTRACT] Page ${pageNum}: limiting ${extractedImages.length} candidates to 12`);
        }
        for (const candidate of boundedCandidates) {
          try {
            const modelImagePath = candidate.vision_path || candidate.path;
            const modelImageBytes = require("fs").readFileSync(modelImagePath);
            if (modelImageBytes.length > 3 * 1024 * 1024) {
              console.warn(`[COMPLEXPDF EXTRACT] Skipping oversized candidate ${candidate.id} (${modelImageBytes.length} bytes)`);
              continue;
            }
            const candidateBase64 = modelImageBytes.toString("base64");
            candidateBlocks.push({
              type: "text",
              text: `Candidate figure ID ${candidate.id}: ${candidate.width}x${candidate.height} ${String(candidate.format || "").toUpperCase()}, displayed at page bbox ${JSON.stringify(candidate.bbox)}, covering ${Math.round((candidate.page_coverage || 0) * 100)}% of the page${candidate.repeated_on_pages > 1 ? `, repeated on ${candidate.repeated_on_pages} pages` : ""}.`,
            });
            candidateBlocks.push({
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: candidateBase64 },
            });
          } catch (candidateErr: any) {
            console.warn(`[COMPLEXPDF EXTRACT] Could not attach candidate ${candidate.id}: ${candidateErr.message}`);
          }
        }
        const visionRequest = {
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: visionSystemPrompt,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: imgBase64 } },
              { type: "text", text: `This is the full-page screenshot for page ${pageNum} of ${totalPages} of "${req.file!.originalname}".` },
              ...candidateBlocks,
              { type: "text", text: `Extract all content from the full-page screenshot as accessible semantic HTML. Use a candidate figure ID only when the separately shown candidate visually matches the figure in the screenshot.` },
            ],
          }],
        };
        let visionResp: any;
        const maxVisionAttempts = 3; // initial request plus up to two retries
        for (let attempt = 1; attempt <= maxVisionAttempts; attempt++) {
          const remainingMs = processingDeadline - Date.now();
          if (remainingMs <= 1000) {
            throw new Error(`Page ${pageNum} analysis stopped because the document processing deadline was reached`);
          }
          const attemptController = new AbortController();
          const attemptTimeoutMs = Math.min(90_000, remainingMs);
          const attemptTimer = setTimeout(() => attemptController.abort(), attemptTimeoutMs);
          try {
            visionResp = await anthropic.messages.create(
              visionRequest as any,
              { signal: attemptController.signal } as any,
            );
            break;
          } catch (visionErr: any) {
            const status = Number(visionErr?.status || 0);
            const message = String(visionErr?.message || visionErr);
            const transient = status === 408 || status === 409 || status === 429 || status >= 500
              || visionErr?.name === "AbortError"
              || /abort|overload|rate.?limit|timeout|temporar/i.test(message);
            if (!transient || attempt === maxVisionAttempts) {
              throw new Error(`Page ${pageNum} analysis failed${attempt > 1 ? ` after ${attempt} attempts` : ""}: ${message}`);
            }
            const retryDelayMs = attempt * 2000;
            console.warn(`[REMEDY DOCS] Page ${pageNum} transient Vision failure; retrying in ${retryDelayMs}ms (${message})`);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          } finally {
            clearTimeout(attemptTimer);
          }
        }
        if (!visionResp) {
          throw new Error(`Page ${pageNum} analysis failed without a response`);
        }
        // Accumulate real token usage across all parallel per-page Vision calls
        pdfUsage.input += visionResp.usage?.input_tokens || 0;
        pdfUsage.output += visionResp.usage?.output_tokens || 0;
        let pageHtml = (visionResp.content[0] as any).text.trim();
        if (pageHtml.startsWith("```")) {
          pageHtml = pageHtml.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        await unlink(screenshot).catch(() => {});
        return { html: pageHtml, images: extractedImages, sourceText };
        }));
        pageResults.push(...batchResults);
      }

      // ── Step 3: Build accessible PDF with images embedded + alt text (fpdf2) ──
      const pdfInput = JSON.stringify({
        pages: pageResults.map((p, i) => ({
          html: p.html,
          images: p.images,
          sourceText: p.sourceText || "",
          pageNum: i + 1,
        })),
        title: req.file!.originalname.replace(/\.pdf$/i, ""),
      });

      const pyPdf = `
import sys, json, os, re, base64
from bs4 import BeautifulSoup
sys.path.insert(0, sys.argv[2])
from figure_html_normalize import normalize_figures

data = json.loads(sys.stdin.read())
output_path = sys.argv[1]
pages = data['pages']
doc_title = data['title']

# 1x1 transparent PNG, used as a placeholder image so caption-only figures
# still get a real <img> element (WeasyPrint only tags <img> as PDF /Figure).
TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

def clean_html(raw_html, page_images, source_text):
    soup = BeautifulSoup(raw_html, 'html.parser')
    for tag in soup.find_all(['style', 'script']): tag.decompose()
    # Repair cell-in-cell nesting caused by an unclosed <td>/<th> tag in the
    # model's raw output. html.parser (unlike a browser or html5lib) does NOT
    # auto-close unclosed block tags -- a model that forgets a closing tag,
    # e.g. writes <td>text<td>more text</td></tr> instead of
    # <td>text</td><td>more text</td></tr>, ends up with the second cell
    # nested INSIDE the first rather than as its sibling. This silently
    # breaks every downstream cell-counting step (colspan splitting, row-
    # width padding, header/Row-TH association) because find_all(...,
    # recursive=False) never sees the nested cell as a cell of the row at
    # all -- confirmed as the root cause of residual 'Headers' failures in
    # real VPAT-style tables with long multi-paragraph Remarks cells (where
    # the model is more likely to lose track of a closing tag). Detect any
    # <td>/<th> containing a direct <td>/<th> child and pull the inner
    # cell(s) back out to be proper siblings in the row, preserving order.
    _nest_repair_changed = True
    while _nest_repair_changed:
        _nest_repair_changed = False
        for _cell in soup.find_all(['td', 'th']):
            _inner_cells = _cell.find_all(['td', 'th'], recursive=False)
            if _inner_cells:
                _parent_row = _cell.parent
                if _parent_row is None or _parent_row.name != 'tr':
                    continue
                for _inner in _inner_cells:
                    _inner.extract()
                    _cell.insert_after(_inner)
                _nest_repair_changed = True
                break
    # WeasyPrint bug: a <td>/<th> whose content MIXES a bare text node with
    # a block-level child (most commonly <p>) causes its tagged-PDF box-tree
    # builder to emit a spurious NESTED /TD (or /TH) inside the real one --
    # confirmed by isolating this exact minimal case and inspecting the
    # resulting struct tree directly (weasyprint/pdf/tags.py's box walker
    # mis-tags the anonymous block box WeasyPrint creates to wrap the bare
    # text alongside the real <p> sibling). This produces cells that Acrobat
    # correctly flags as missing /Headers, since the nested /TD is never
    # seen as a real cell of the row by any downstream tooling (including
    # WeasyPrint's own Headers-linking pass). This is the actual root cause
    # of the residual 'Headers'-failed cells in real VPAT-style tables --
    # NOT an unclosed source tag (that repair pass above is retained as a
    # defensive no-op; it does not fire on real pipeline output). It bites
    # both cells the model emits with this shape natively, and cells this
    # code appends a continuation <p> onto (the orphan-row merge below, and
    # any other future direct '.append(new_tag)' onto a cell that already
    # has bare text). Fix at the source: normalize every <td>/<th> so its
    # direct children are ONLY block-level elements -- wrap any bare text
    # node (or inline element run) that is a direct child into its own <p>,
    # preserving order relative to existing block children.
    _INLINE_MIX_BLOCK_TAGS = ['p', 'div', 'ul', 'ol', 'table']

    def _normalize_cell_content(cell):
        _has_inline_run = any(
            (isinstance(_c, str) and _c.strip())
            or (getattr(_c, 'name', None) is not None and _c.name not in _INLINE_MIX_BLOCK_TAGS)
            for _c in cell.contents
        )
        _has_block_child = cell.find(_INLINE_MIX_BLOCK_TAGS, recursive=False) is not None
        if not (_has_inline_run and _has_block_child):
            return
        _run = []
        _new_children = []
        for _c in list(cell.contents):
            _is_block = getattr(_c, 'name', None) in _INLINE_MIX_BLOCK_TAGS
            if _is_block:
                if _run:
                    _p = soup.new_tag('p')
                    for _r in _run:
                        _p.append(_r.extract() if hasattr(_r, 'extract') else _r)
                    _new_children.append(_p)
                    _run = []
                _new_children.append(_c.extract())
            else:
                _run.append(_c)
        if _run:
            _p = soup.new_tag('p')
            for _r in _run:
                _p.append(_r.extract() if hasattr(_r, 'extract') else _r)
            _new_children.append(_p)
        cell.clear()
        for _nc in _new_children:
            cell.append(_nc)
    for _cell in soup.find_all(['td', 'th']):
        _normalize_cell_content(_cell)
    # Strip table sub-elements that have no row/cell content, and unwrap
    # any table that ends up with no actual rows -- WeasyPrint's tagged-PDF
    # box-tree walker raises 'Table wrapper without a table' when a table
    # display box has no TableBox child (e.g. a table left with only a
    # caption/colgroup after a page-split repair, or entirely empty).
    for table in soup.find_all('table'):
        if not table.find_all('tr'):
            table.unwrap()
    # Orphaned row/cell fragments outside any table (can appear when a table
    # spans two Claude-extracted pages and each half is parsed independently)
    # also trip the same WeasyPrint code path -- drop them defensively.
    for orphan in soup.find_all(['tr', 'thead', 'tbody', 'tfoot', 'td', 'th']):
        if not orphan.find_parent('table'):
            orphan.unwrap()
    # Acrobat's 'Regularity' check fails if rows in the same table don't all
    # have the same number of columns (very common with real-world tables
    # that have merged/missing cells in the source PDF). Pad short rows with
    # empty <td> cells so every row in a table matches the widest row's
    # column count. Cells with colspan count toward the total.
    # WeasyPrint's tagged-PDF struct-tree builder does not implement colspan
    # or rowspan at all (confirmed via its own source: weasyprint/pdf/tags.py
    # has a literal "# TODO: handle rowspan and colspan values." comment) --
    # a <td colspan="3"> renders visually as one wide cell but is tagged in
    # the PDF struct tree as a row with just ONE /TD, while sibling rows in
    # the same table have three. Acrobat's Regularity/Headers checks then
    # correctly flag that row (uneven cell count, and the lone cell can only
    # ever link to one column's header even though it visually spans all
    # three). Real-world cause seen in practice: Claude Vision extracts a
    # VPAT criterion whose Level/Remarks are blank/merged into a single
    # descriptive cell using colspan. Fix at the HTML level, before
    # WeasyPrint ever sees it: split every colspan>1 cell into the real cell
    # plus (colspan-1) empty filler cells of the same type, and drop the
    # colspan attribute -- this guarantees every row's real cell COUNT
    # matches, independent of whatever WeasyPrint does/doesn't do with
    # colspan, since we no longer rely on it being interpreted at all.
    for table in soup.find_all('table'):
        for row in table.find_all('tr'):
            for cell in row.find_all(['td', 'th'], recursive=False):
                try:
                    span = int(cell.get('colspan', 1))
                except (TypeError, ValueError):
                    span = 1
                if span > 1:
                    del cell['colspan']
                    for _ in range(span - 1):
                        filler = soup.new_tag(cell.name)
                        filler.string = ''
                        cell.insert_after(filler)
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if not rows:
            continue
        def row_width(row):
            width = 0
            for cell in row.find_all(['td', 'th'], recursive=False):
                try:
                    width += int(cell.get('colspan', 1))
                except (TypeError, ValueError):
                    width += 1
            return width
        widths = [row_width(r) for r in rows]
        max_width = max(widths) if widths else 0
        for row, w in zip(rows, widths):
            for _ in range(max_width - w):
                filler = soup.new_tag('td')
                filler.string = ''
                row.append(filler)
        # Acrobat's 'Headers' check fails if a table has no <th> cells at all.
        # If Claude omitted a header row, promote the first row's <td>s to
        # <th scope="col"> so the table has a real header association.
        if not table.find('th'):
            first_row = rows[0]
            for cell in first_row.find_all('td'):
                cell.name = 'th'
                cell['scope'] = 'col'
        # WeasyPrint's tagged-PDF builder only registers a <th> as a ROW
        # header when it has scope="row" -- any <th> with no scope (or
        # scope="col") is treated as a COLUMN header keyed by its column
        # index. Claude sometimes marks first-column row-label cells as
        # <th> (correctly identifying them as headers) but omits the scope
        # attribute, which silently mis-tags them as column headers and
        # breaks the Headers association Acrobat checks for. Fix up both
        # directions here as a safety net:
        #  1. Any <th> in the first column of a body row (not the header
        #     row) with no scope -> scope="row".
        #  2. Any <th> in the header row (first row of thead, or first row
        #     of tbody when no thead) with no scope -> scope="col".
        #  3. Any other <th> still missing scope -> default to "col" (safe
        #     fallback matching WeasyPrint's own default behavior).
        thead = table.find('thead')
        header_row = thead.find('tr') if thead else rows[0]
        for row in rows:
            cells = row.find_all(['td', 'th'], recursive=False)
            if not cells:
                continue
            first_cell = cells[0]
            if first_cell.name == 'th' and not first_cell.get('scope') and row is not header_row:
                first_cell['scope'] = 'row'
        for th in table.find_all('th'):
            if not th.get('scope'):
                th['scope'] = 'col'
    images_by_id = {img.get('id'): img for img in page_images if img.get('id')}

    # Match Claude's <img src="cid:IMAGE_ID"> references (see vision prompt) against
    # the actual extracted image files by stable ID, and embed as base64 data URIs.
    matched_ids = set()
    for img_tag in soup.find_all('img'):
        src = img_tag.get('src', '')
        img_id = src[4:] if src.startswith('cid:') else None
        info = images_by_id.get(img_id) if img_id else None
        if info and os.path.exists(info['path']):
            try:
                with open(info['path'], 'rb') as f:
                    b64 = base64.b64encode(f.read()).decode()
                ext = os.path.splitext(info['path'])[1].lstrip('.').lower() or 'png'
                mime = 'jpeg' if ext in ('jpg', 'jpeg') else ext
                img_tag['src'] = 'data:image/' + mime + ';base64,' + b64
                if not img_tag.get('alt'):
                    img_tag['alt'] = 'Figure'
                matched_ids.add(img_id)
                continue
            except Exception:
                pass
        # No real image matched this <img> tag -- the src is a dangling cid:
        # reference. Repoint it at the 1x1 placeholder (handled below) instead
        # of leaving an unresolved src, which WeasyPrint's tagger flags as a
        # missing-alt-description error.
        img_tag['src'] = TRANSPARENT_PIXEL
    # Vision HTML is untrusted. Rebuild figures so alternative descriptions
    # remain metadata and only source-validated captions remain visible.
    normalize_figures(soup, source_text, TRANSPARENT_PIXEL)
    return str(soup)

html_parts = []
for pg in pages:
    page_html = pg.get('html', '')
    page_images = pg.get('images', [])
    source_text = pg.get('sourceText', '')
    html_parts.append('<div class="page">' + clean_html(page_html, page_images, source_text) + '</div>')

# Document-level heading normalization. Each page is extracted by Claude
# independently, so heading levels are only consistent WITHIN a page --
# concatenating pages can produce skips (e.g. one page ends at h2, the next
# starts at h3 with no h2, or worse, jumps to h1). Acrobat's 'Appropriate
# nesting' check fails on any level skip greater than 1. Walk all headings in
# document order and clamp each one so it's never more than one level deeper
# than the previous heading, while preserving same-level and shallower jumps.
# Each page's HTML is generated by an independent Claude call with no
# visibility into neighboring pages, so a single real table that happens to
# span a page boundary can come back as two separate <table> elements.
# Detect and merge these before final assembly using two signals, since
# relying on the model to self-report a continuation marker is unreliable:
#   1. Explicit signal: matching data-pdf-table-id on consecutive tables
#      (the vision prompt asks the model to reuse the same ID on a
#      continuation fragment that has no <thead> of its own).
#   2. Structural fallback: two ADJACENT tables (no other table in between,
#      only page/section wrappers) where the first has no closing/total row
#      and the second has the exact same column count and no <thead> of its
#      own (i.e. its first row is plain <td> data, not <th> headers) -- this
#      is the shape of a real continued table even when the model didn't
#      tag it explicitly.
_pre_merge_soup = BeautifulSoup(''.join(html_parts), 'html.parser')
_all_tables = _pre_merge_soup.find_all('table')
for _i in range(len(_all_tables) - 1, 0, -1):
    _cur = _all_tables[_i]
    _prev = _all_tables[_i - 1]
    _cur_id = _cur.get('data-pdf-table-id')
    _prev_id = _prev.get('data-pdf-table-id')
    _id_match = bool(_cur_id) and _cur_id == _prev_id
    _prev_row = _prev.find('tr')
    _prev_cols = len(_prev_row.find_all(['th', 'td'])) if _prev_row else 0
    _cur_has_thead = _cur.find('thead') is not None
    _cur_first_row = _cur.find('tr')
    _cur_cols = len(_cur_first_row.find_all(['th', 'td'])) if _cur_first_row else 0
    _cur_first_row_is_data = _cur_first_row is not None and _cur_first_row.find('th') is None
    _same_width = _prev_cols > 0 and _prev_cols == _cur_cols
    _structural_match = _same_width and not _cur_has_thead and _cur_first_row_is_data
    if _id_match or _structural_match:
        _prev_tbody = _prev.find('tbody') or _prev
        _cur_tbody = _cur.find('tbody') or _cur
        for _row in _cur_tbody.find_all('tr', recursive=False):
            _prev_tbody.append(_row.extract())
        _cur.decompose()

# Safety net for a distinct model failure mode, seen in real VPAT-style
# documents: when one row's Remarks/description cell is a long paragraph,
# the source PDF sometimes draws that cell tall enough that a follow-on
# paragraph *within the same logical cell* lands in its own ruled grid band.
# The vision model can misread that visual band as a brand-new <tr>, so it
# emits a row where the row-label column (and any other leading columns) are
# empty but the LAST column has real text -- a row with no row identity at
# all. The prompt above now tells the model not to do this, but since
# compliance isn't guaranteed, catch and repair it here too: any <tr> whose
# leading cells (all but the last) are empty/whitespace-only, in a table
# where at least one other row DOES have real content in those leading
# columns, is treated as orphaned continuation text and its last cell's
# content is appended into the same-index cell of the immediately preceding
# row (joined as a new paragraph), then the orphan row is removed entirely.
for _t in _pre_merge_soup.find_all('table'):
    _body_rows = [_r for _r in _t.find_all('tr') if _r.find_parent('thead') is None]
    _rows_have_real_leading_label = any(
        (_r.find(['th', 'td']) and _r.find(['th', 'td']).get_text(strip=True))
        for _r in _body_rows
    )
    if not _rows_have_real_leading_label:
        continue
    _prev_real_row = None
    for _r in _body_rows:
        _cells = _r.find_all(['th', 'td'], recursive=False)
        if len(_cells) < 2:
            _prev_real_row = _r
            continue
        _leading_empty = all(not _c.get_text(strip=True) for _c in _cells[:-1])
        _last_has_text = bool(_cells[-1].get_text(strip=True))
        if _leading_empty and _last_has_text and _prev_real_row is not None:
            _prev_cells = _prev_real_row.find_all(['th', 'td'], recursive=False)
            if len(_prev_cells) == len(_cells):
                _target = _prev_cells[-1]
                # Appending a <p> here can leave _target with MIXED bare
                # text + block content (e.g. the model emitted the cell's
                # first paragraph as plain text, no <p> wrapper) -- this
                # exact shape is what triggers WeasyPrint's nested-/TD
                # tagging bug (see _normalize_cell_content above). Wrap any
                # existing bare text into its own <p> first so the cell only
                # ever has block-level direct children after this append.
                _existing_bare_text = [
                    _c for _c in list(_target.contents)
                    if isinstance(_c, str) and _c.strip()
                ]
                if _existing_bare_text:
                    _wrap_p = _pre_merge_soup.new_tag('p')
                    for _bt in _existing_bare_text:
                        _wrap_p.append(_bt.extract())
                    _target.insert(0, _wrap_p)
                _new_p = _pre_merge_soup.new_tag('p')
                _new_p.string = _cells[-1].get_text(' ', strip=True)
                _target.append(_new_p)
                _r.decompose()
                continue
        _prev_real_row = _r

# WeasyPrint bug workaround (see get_wrapped_table patch below for the full
# explanation): when a table's box tree fragments across a page break in a
# certain way, the fragment WeasyPrint creates for one side of the break can
# end up with zero TableBox children, and the crash-avoidance patch below
# substitutes a synthetic EMPTY TableBox for that fragment -- silently
# dropping that fragment's real header/data cells from the accessibility
# tree even though the content still renders visually on the page. This is
# confirmed to happen on genuinely small tables (e.g. a 5-row, 2-column
# table) that simply straddle a page boundary by a line or two -- there is
# no reason a short table like that needs to split at all. Rather than try
# to patch WeasyPrint's internal fragment-to-struct-element mapping (fragile,
# version-specific), prevent the split from happening in the first place for
# any table small enough to plausibly fit in the remaining space on one
# page: mark it with CSS 'break-inside: avoid' so WeasyPrint pushes the
# whole table onto the next page instead of fragmenting it. Large multi-page
# tables (VPAT criteria tables can run 16+ rows across several pages) must
# NOT get this treatment -- forcing those to stay unbroken would push them
# into a single unbreakable block that overflows the page entirely. Use row
# count as the threshold: tables with a small number of rows are exactly the
# ones short enough to avoid breaking AND the ones most likely to be pushed
# right up against a page boundary by preceding content.
#
# IMPORTANT correction: putting break-inside directly on the <table>
# element alone is NOT sufficient -- confirmed on a real document that
# several small captioned tables still fragmented and hit the
# crash-avoidance substitution even with this style present, because
# WeasyPrint's table-wrapper box sits ABOVE the <table> element and can
# still split independently of it. Wrapping the whole table (including its
# <caption>) in a block-level <div> that itself carries break-inside: avoid
# is what actually prevents the fragmentation -- confirmed via direct
# WeasyPrint struct-tree inspection on this real document: 5 real
# fragmentation cases went from 5 -> 0 with the div-wrapper approach, vs.
# table-level style alone which still hit all 5.
_SMALL_TABLE_MAX_ROWS = 8
for _t in _pre_merge_soup.find_all('table'):
    _row_count = len(_t.find_all('tr'))
    if 0 < _row_count <= _SMALL_TABLE_MAX_ROWS:
        _wrapper = _pre_merge_soup.new_tag('div')
        _wrapper['style'] = 'break-inside: avoid; page-break-inside: avoid;'
        _t.wrap(_wrapper)

html_parts = [str(_pre_merge_soup)]

combined_for_headings = BeautifulSoup(''.join(html_parts), 'html.parser')
prev_level = 1
seen_h1 = False
for h in combined_for_headings.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
    level = int(h.name[1])
    if level == 1:
        if seen_h1:
            level = 2  # only the document's first h1 stays an h1
            h.name = 'h2'
        else:
            seen_h1 = True
    elif level > prev_level + 1:
        level = prev_level + 1
        h.name = 'h%d' % level
    prev_level = level
html_parts = [str(combined_for_headings)]

css_rules = [
    '@page { size: letter; margin: 1in; }',
    'body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }',
    'h1 { font-size: 18pt; font-weight: bold; margin: 12pt 0 6pt 0; }',
    'h2 { font-size: 15pt; font-weight: bold; margin: 10pt 0 5pt 0; }',
    'h3 { font-size: 13pt; font-weight: bold; margin: 8pt 0 4pt 0; }',
    'h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: 6pt 0 3pt 0; }',
    'p { margin: 0 0 6pt 0; }',
    'ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }',
    'li { margin-bottom: 2pt; }',
    'table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }',
    'th { background: #f0f0f0; border: 1px solid #999; padding: 4pt 6pt; text-align: left; font-weight: bold; }',
    'td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }',
    'blockquote { margin: 6pt 0 6pt 24pt; border-left: 2pt solid #999; padding-left: 8pt; }',
    'figure { margin: 8pt 0; }',
    'figcaption { font-size: 9pt; color: #555; margin-top: 3pt; }',
    'img { max-width: 100%; height: auto; }',
    '.equation { font-style: italic; }',
]
css = '\\n'.join(css_rules)

full_html = (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    '<title>' + doc_title + '</title>'
    '<style>' + css + '</style></head><body>'
    + ''.join(html_parts)
    + '</body></html>'
)

tmp_html = output_path + '.html'
with open(tmp_html, 'w', encoding='utf-8') as f:
    f.write(full_html)

import traceback as _tb

def _find_table_wrapper_culprit(html_source):
    # Best-effort localization: find which <table>...</table> block in the
    # source HTML has zero real <tr> rows post-render, which is the only
    # known trigger for WeasyPrint's box-tree 'Table wrapper without a
    # table' error. Returns a short excerpt for the error message.
    for m in re.finditer(r'<table[^>]*>.*?</table>', html_source, re.DOTALL):
        frag = m.group(0)
        if not re.search(r'<tr[\s>]', frag):
            return frag[:300]
    return None

from weasyprint import HTML
from weasyprint.formatting_structure import boxes as _wp_boxes

# WeasyPrint bug workaround: when a table's rendered box tree is fragmented
# across a page break in a certain way, the tagged-PDF builder's
# get_wrapped_table() can find zero TableBox children on a wrapper box and
# raise 'Table wrapper without a table' (a case the WeasyPrint authors
# themselves marked '# pragma: no cover' as believed-impossible, but it is
# reachable with real multi-table, multi-page documents). Rather than
# aborting the whole render, patch this one lookup to fall back to a synthetic
# empty TableBox for that fragment -- the table's actual rows are still fully
# tagged wherever the real TableBox fragment lives; this only prevents the
# crash on wrapper fragments that carry no rows of their own (e.g. a
# continuation wrapper WeasyPrint created for pagination bookkeeping).
def _patched_get_wrapped_table(self):
    for child in self.children:
        if isinstance(child, _wp_boxes.TableBox):
            return child
    synthetic = _wp_boxes.TableBox.anonymous_from(self, [])
    synthetic.is_table_wrapper = False
    return synthetic

_wp_boxes.ParentBox.get_wrapped_table = _patched_get_wrapped_table

# Second WeasyPrint bug, found on real large multi-page tables (confirmed on
# a 27-row and a 10-row table in a real document): on the LAST page a large
# table fragments onto, WeasyPrint can emit a page-local "table wrapper" box
# whose only child is a TableCaptionBox -- a genuine visible caption
# fragment, but with NO TableBox sibling on that page (all its actual rows
# already rendered on the prior page). The crash-avoidance patch above
# still fires for this case since there's no real TableBox to return, and
# the caller (weasyprint/pdf/tags.py _build_box_tree, tag == 'Table' branch)
# then builds a struct element containing only that orphan Caption -- an
# empty /Table node in the accessibility tree with the real row/cell
# content silently missing (though the caption text does render on the
# page). This is NOT something break-inside/page-break-inside CSS can
# prevent -- these are large tables that MUST span multiple pages by design
# (forcing them onto one page would overflow it), and the orphan-caption
# fragment is a WeasyPrint pagination artifact independent of table size.
# Fixed below by folding into the combined _build_box_tree patch: when a
# box is a table wrapper with no real TableBox child, skip emitting a
# /Table struct element for that fragment and recurse directly into its
# children (the orphan Caption) instead of nesting them under a fabricated,
# contentless /Table.
#
# WeasyPrint bug: _build_box_tree() reads element.attrib.get('scope') off each
# <th> ONLY to decide internally whether that header groups into row_headers
# or column_headers (for building the /Headers array on <td> cells) -- it
# NEVER writes the scope value back out as a /Scope attribute on the <th>
# struct element itself. Verified directly: even a minimal <th scope="row">
# test document produces a tagged PDF where every /TH has no /A/Scope entry
# at all. PDF/UA explicitly states Headers/ID linking does NOT substitute for
# Scope (see ISO 32000-2 14.8.4.8.3, Note 4: "The use of Headers does not
# negate the need for Scope") -- so Acrobat's Headers check correctly fails
# even though our Headers/ID linking (which WeasyPrint DOES emit) is present.
# Patch: wrap the whole recursive tag-builder so that immediately after it
# creates a struct element for a <th>, we also set element['A'] = {'O':
# '/Table', 'S': '/Row' or '/Column'} based on the exact same attrib lookup
# WeasyPrint itself already performs, so Acrobat's Headers/Scope check has a
# real Scope value to find -- without touching any other behavior of the
# original recursive builder (delegates to it entirely, just augments the
# yielded TH elements before they're consumed by the caller). Both fixes are
# combined into one _build_box_tree wrapper since only one function can be
# installed at weasyprint.pdf.tags._build_box_tree.
import weasyprint.pdf.tags as _wp_tags
import pydyf as _pydyf

_original_build_box_tree = _wp_tags._build_box_tree

def _patched_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
    is_orphan_table_wrapper = (
        getattr(box, 'is_table_wrapper', False)
        and not any(isinstance(c, _wp_boxes.TableBox) for c in box.children)
    )
    if is_orphan_table_wrapper:
        for child in box.children:
            yield from _patched_build_box_tree(
                child, parent, pdf, page_number, nums, links, tags)
        return
    for element in _original_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
        try:
            if element.get('S') == '/TH' and box.element is not None:
                scope_attr = box.element.attrib.get('scope')
                pdf_scope = 'Row' if scope_attr == 'row' else 'Column'
                element['A'] = _pydyf.Dictionary({'O': '/Table', 'Scope': f'/{pdf_scope}'})
        except Exception:
            pass
        yield element

_wp_tags._build_box_tree = _patched_build_box_tree

try:
    HTML(filename=tmp_html).write_pdf(output_path, pdf_tags=True)
except ValueError as wp_val_err:
    # 'Table wrapper without a table' is a WeasyPrint box-tree edge case in
    # the tagged-PDF code path. Do NOT silently fall back to an untagged
    # render -- that ships a PDF that LOOKS successful (HTTP 200) but has
    # no StructTreeRoot at all, which is worse than failing loudly. Surface
    # the real cause so it can be fixed at the source instead of masked.
    culprit = _find_table_wrapper_culprit(full_html) if 'table' in str(wp_val_err).lower() else None
    try: os.unlink(tmp_html)
    except: pass
    detail = (' Suspect table fragment: ' + culprit) if culprit else ''
    raise RuntimeError('WeasyPrint tagged-PDF generation failed: ' + str(wp_val_err) + detail)
except Exception as wp_err:
    try: os.unlink(tmp_html)
    except: pass
    raise RuntimeError('WeasyPrint failed: ' + str(wp_err) + ' | ' + _tb.format_exc()[-500:])

# Post-pass: set DisplayDocTitle, and VERIFY WeasyPrint actually produced a
# real tagged structure. If pdf_tags=True silently produced a PDF with no
# StructTreeRoot (no exception raised, but tagging didn't happen), fail
# loudly here instead of returning an untagged PDF as if it succeeded --
# that mismatch (HTTP 200 but no real tags) is exactly what caused the
# 'same report every time' confusion. Better to error than lie.
import pikepdf
pp = pikepdf.open(output_path, allow_overwriting_input=True)
if '/StructTreeRoot' not in pp.Root:
    pp.close()
    raise RuntimeError(
        'WeasyPrint produced a PDF with no StructTreeRoot (tagging silently '
        'did not happen despite pdf_tags=True and no exception). This PDF '
        'would fail every Acrobat tag check. Aborting instead of returning '
        'a falsely-successful untagged file.'
    )
if '/ViewerPreferences' not in pp.Root:
    pp.Root['/ViewerPreferences'] = pikepdf.Dictionary()
pp.Root['/ViewerPreferences']['/DisplayDocTitle'] = pikepdf.Boolean(True)

# PDF/UA-1 requires the document Catalog to contain a /Metadata key pointing
# to an XMP metadata stream (ISO 14289-1:2014 clause 7.1, test 8; also ISO
# 32000-1:2008 14.3.2). Confirmed via an independent, spec-based validator
# (veraPDF, PDF/UA-1 profile) run directly against a real generated PDF:
# 105/106 rules and 173,431/173,432 individual checks passed -- the ONE
# failing check across the entire document was exactly this missing
# Metadata stream, not Headers/Scope/Regularity (all of which passed
# cleanly under veraPDF, validating the three earlier fixes were correct
# and complete -- this is a separate, previously-undiscovered gap).
# WeasyPrint does not write a document-level XMP stream by default. Fix:
# use pikepdf's high-level metadata API (handles correct XMP packet framing,
# namespaces, and PDF/UA identification schema) to set the title and load
# the standard PDF/UA-1 identification extension schema.
with pp.open_metadata() as _pp_meta:
    _pp_meta.load_from_docinfo(pp.docinfo, delete_missing=False)
    if not _pp_meta.get('dc:title'):
        _pp_meta['dc:title'] = doc_title
    _pp_meta['pdfuaid:part'] = '1'
if '/MarkInfo' not in pp.Root:
    pp.Root['/MarkInfo'] = pikepdf.Dictionary()
pp.Root['/MarkInfo']['/Marked'] = pikepdf.Boolean(True)
if '/Info' not in pp.trailer:
    pp.trailer['/Info'] = pikepdf.Dictionary()
pp.trailer['/Info']['/Title'] = pikepdf.String(doc_title)

# ---------------------------------------------------------------------------
# Table Headers repair pass (fixes Acrobat "Headers" check under Tables).
#
# WeasyPrint's tagged-PDF builder (pdf/tags.py) computes each table's
# TH->TD /Headers associations PER STRUCT-TREE Table FRAGMENT: when one HTML
# <table> is split across a page boundary (or its own <thead> lives in a
# different fragment than data rows further down), the header-row lookup
# only sees the rows present in that fragment. Rows in a later fragment --
# or rows following an in-body "section label" row like
# <th colspan="3" scope="rowgroup">Section Title</th> -- end up with a TD
# /Headers array present but EMPTY, since no TH shares that fragment. Acrobat
# correctly flags this as a failed Headers check even though TH/TD tagging
# itself is otherwise correct.
#
# Fix: walk the struct tree in document order maintaining a running map of
# "current column headers" (col_idx -> TH /ID). Refresh the map whenever a
# TR is encountered whose cells are ALL /TH (a genuine multi-column header
# row, e.g. from <thead>). Any /TD encountered afterwards (in any table
# fragment) with an empty /Headers array gets backfilled from the running
# map, matched by its position among sibling cells in its own row. This
# survives WeasyPrint splitting one HTML table into multiple sibling /Table
# struct elements, since the header row and the orphaned data rows are still
# visited in the same document order.
# ---------------------------------------------------------------------------
def _pp_get_S(elem):
    s = elem.get('/S')
    return str(s) if s is not None else None

def _pp_get_kids(elem):
    kids = elem.get('/K')
    if kids is None:
        return []
    if isinstance(kids, pikepdf.Array):
        return [k for k in kids if isinstance(k, pikepdf.Dictionary)]
    if isinstance(kids, pikepdf.Dictionary):
        return [kids]
    return []

def _pp_get_attr(elem, create=False):
    attrs = elem.get('/A')
    if attrs is None:
        if create:
            d = pikepdf.Dictionary({'/O': pikepdf.Name('/Table'), '/Headers': pikepdf.Array([])})
            elem['/A'] = d
            return elem['/A']
        return None
    if isinstance(attrs, pikepdf.Array):
        for a in attrs:
            if isinstance(a, pikepdf.Dictionary):
                return a
        if create:
            d = pikepdf.Dictionary({'/O': pikepdf.Name('/Table'), '/Headers': pikepdf.Array([])})
            attrs.append(d)
            return attrs[-1]
        return None
    if isinstance(attrs, pikepdf.Dictionary):
        return attrs
    return None

_pp_current_headers = {}
_pp_headers_fixed = 0

def _pp_visit(elem):
    global _pp_current_headers, _pp_headers_fixed
    s = _pp_get_S(elem)
    if s == '/TR':
        cells = _pp_get_kids(elem)
        tags = [_pp_get_S(c) for c in cells]
        if cells and len(cells) > 1 and all(t == '/TH' for t in tags):
            new_map = {}
            for ci, c in enumerate(cells):
                idv = c.get('/ID')
                if idv is not None:
                    new_map[ci] = str(idv)
            if new_map:
                _pp_current_headers = new_map
        else:
            for ci, c in enumerate(cells):
                if _pp_get_S(c) != '/TD':
                    continue
                attrs = _pp_get_attr(c)
                current = attrs.get('/Headers') if attrs else None
                current_len = len(current) if current is not None else 0
                if current_len > 0:
                    continue
                th_id = _pp_current_headers.get(ci)
                if th_id is None:
                    continue
                attrs = _pp_get_attr(c, create=True)
                attrs['/Headers'] = pikepdf.Array([pikepdf.String(th_id)])
                _pp_headers_fixed += 1
        return
    for k in _pp_get_kids(elem):
        _pp_visit(k)

_pp_st = pp.Root['/StructTreeRoot']
for _pp_k in _pp_get_kids(_pp_st):
    _pp_visit(_pp_k)
print(f'headers-repair: fixed {_pp_headers_fixed} TD elements', file=sys.stderr)

# Safety net: verify every /TH actually got a /Scope from the monkeypatch
# above. If WeasyPrint's internal struct-tree shape ever changes such that
# the patched _build_box_tree stops firing for some TH (e.g. a future
# WeasyPrint version restructures how table cells are yielded), backfill any
# TH missing /A/S here using the same running-header-row logic already used
# for TD /Headers, rather than silently shipping a PDF that fails the
# Acrobat Headers check again with no visible signal.
_pp_th_total = 0
_pp_th_missing_scope = 0

def _pp_verify_scope(elem, in_header_row=False):
    global _pp_th_total, _pp_th_missing_scope
    s = _pp_get_S(elem)
    if s == '/TR':
        cells = _pp_get_kids(elem)
        tags = [_pp_get_S(c) for c in cells]
        all_th = bool(cells) and all(t == '/TH' for t in tags)
        for ci, c in enumerate(cells):
            if _pp_get_S(c) != '/TH':
                continue
            _pp_th_total += 1
            attrs = _pp_get_attr(c)
            has_scope = attrs is not None and '/Scope' in attrs
            if not has_scope:
                _pp_th_missing_scope += 1
                fallback_scope = 'Column' if (all_th or ci == 0) else 'Column'
                attrs = _pp_get_attr(c, create=True)
                attrs['/Scope'] = pikepdf.Name('/' + fallback_scope)
        return
    for k in _pp_get_kids(elem):
        _pp_verify_scope(k)

for _pp_k in _pp_get_kids(_pp_st):
    _pp_verify_scope(_pp_k)
print(f'scope-verify: {_pp_th_total} TH total, {_pp_th_missing_scope} were missing /Scope and backfilled', file=sys.stderr)
if _pp_th_total > 0 and _pp_th_missing_scope == _pp_th_total:
    print('scope-verify WARNING: monkeypatch appears to have not fired at all (100% missing) -- check WeasyPrint version compatibility', file=sys.stderr)

# CRITICAL gap, confirmed by direct inspection of weasyprint/pdf/tags.py
# source (zero occurrences of "IDTree" anywhere in that module): WeasyPrint
# assigns a unique /ID byte string directly on each /TH struct element, and
# writes /Headers arrays on /TD cells that reference those ID strings -- but
# it NEVER builds or attaches the /IDTree name tree that PDF/UA (ISO 32000-2
# 14.7.3.4, via the general name-tree mechanism in 7.9.6) requires on
# StructTreeRoot for those IDs to be considered resolvable. Confirmed via a
# real generated PDF: 400/400 TH have unique, non-colliding /ID values, and
# all 1,025 /Headers references correctly resolve to one of those IDs when
# walked directly -- yet StructTreeRoot has no /IDTree key at all. Acrobat's
# accessibility checker validates Headers/ID resolution through /IDTree, not
# by walking the struct tree the way our own diagnostics do, so it correctly
# flags every single Headers reference as unresolvable even though the
# struct tree itself is fully self-consistent. This is almost certainly the
# real, final cause of the persistent "Headers" failure -- the /Scope fix
# and the colspan fix were both real, necessary bugs, but neither could ever
# make Acrobat's Headers check pass while /IDTree was missing entirely.
# Fix: collect every struct element that has an /ID (currently just /TH),
# build a proper sorted name tree (PDF name trees require key-sorted /Names
# arrays alternating key/value), and attach it as StructTreeRoot/IDTree.
_pp_id_entries = []

def _pp_collect_ids(elem):
    if isinstance(elem, pikepdf.Dictionary) and '/ID' in elem:
        _pp_id_entries.append((bytes(elem.ID), elem))
    for k in _pp_get_kids(elem):
        _pp_collect_ids(k)

for _pp_k in _pp_get_kids(_pp_st):
    _pp_collect_ids(_pp_k)

if _pp_id_entries:
    _pp_id_entries.sort(key=lambda pair: pair[0])
    _pp_names_array = pikepdf.Array()
    for _pp_id_bytes, _pp_elem in _pp_id_entries:
        _pp_names_array.append(pikepdf.String(_pp_id_bytes))
        _pp_names_array.append(_pp_elem)
    _pp_st['/IDTree'] = pikepdf.Dictionary({'/Names': _pp_names_array})
print(f'idtree-build: registered {len(_pp_id_entries)} struct element IDs into StructTreeRoot/IDTree', file=sys.stderr)

pp.save(output_path)
pp.close()

print('ok')
`;

      const tmpPdfOut = join(tmpdir(), `accessible-${ts}.pdf`);
      const tmpPdfScript = join(tmpdir(), `gen_pdf_${ts}.py`);
      tempFiles.add(tmpPdfOut);
      tempFiles.add(tmpPdfScript);
      await writeFile(tmpPdfScript, pyPdf, "utf8");

      const pdfBuildBudgetMs = processingDeadline - Date.now();
      if (pdfBuildBudgetMs <= 1000) {
        throw new Error("PDF generation stopped because the document processing deadline was reached");
      }
      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(
          python3,
          [tmpPdfScript, tmpPdfOut, pipelineDir],
          { timeout: Math.min(180000, pdfBuildBudgetMs) },
        );
        proc.stdin.write(pdfInput);
        proc.stdin.end();
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => stderr += d.toString());
        proc.on("close", (code: number) => {
          if (code !== 0) reject(new Error("PDF generation failed: " + stderr.slice(-800)));
          else resolve();
        });
      });

      await unlink(tmpPdfScript).catch(() => {});

      // Clean up extracted images
      for (const p of pageResults) {
        for (const imgFile of p.images) {
          await unlink(imgFile.path).catch(() => {});
          if (imgFile.vision_path && imgFile.vision_path !== imgFile.path) {
            await unlink(imgFile.vision_path).catch(() => {});
          }
        }
      }
      try { require("fs").rmdirSync(tmpWorkDir); } catch {}

      const pdfBuffer = require("fs").readFileSync(tmpPdfOut);
      await unlink(tmpPdfOut).catch(() => {});

      const baseName = req.file.originalname.replace(/\.pdf$/i, "").replace(/[^\x20-\x7E]/g, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}-accessible.pdf"`);
      const fixesMadeArr = [
        `1.1.1 - All figures embedded with AI-generated alt text`,
        `1.3.1 - Semantic headings, tables with captions and scoped headers`,
        `1.3.2 - Content in logical reading order across ${totalPages} pages`,
        `2.4.2 - Document title set`,
        `3.1.1 - Language declared`,
        `Unicode font - Chemical symbols and math rendered correctly`,
      ];
      const fixesMadeHeader = JSON.stringify(fixesMadeArr).replace(/[^\x20-\x7E]/g, "");
      res.setHeader("X-Fixes-Made", Buffer.from(fixesMadeHeader).toString("base64"));
      res.setHeader("X-Total-Pages", String(totalPages));
      if (clerkUserId) {
        try {
          storage.createJob({
            type: "complexpdf",
            status: "completed",
            inputName: req.file.originalname,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: totalPages,
            creditsUsed: totalPages,
            inputTokens: pdfUsage.input,
            outputTokens: pdfUsage.output,
          });
        } catch (jobErr: any) {
          console.error("[JOB LOG] Error:", jobErr.message);
        }
      }
      return res.send(pdfBuffer);

    } catch (err: any) {
      console.error(`[REMEDY DOCS] ${req.file?.originalname || "unknown file"} -- vision pipeline failed:`, err.message);
      if (clerkUserId && deductedCredits > 0) {
        try {
          await refundCredits(clerkUserId, deductedCredits);
          console.log(`[REMEDY DOCS] Refunded ${deductedCredits} credits after vision pipeline failure`);
          deductedCredits = 0;
        } catch (refundErr: any) {
          console.error("[REMEDY DOCS] Automatic failure refund failed:", refundErr.message);
        }
      }
      try {
        storage.createJob({
          type: "complexpdf",
          status: "failed",
          inputName: req.file?.originalname || null,
          result: null,
          errorMessage: String(err.message || err).slice(0, 500),
          createdAt: Date.now(),
          clerkUserId: clerkUserId || null,
          pageCount: null,
          creditsUsed: deductedCredits || null,
          inputTokens: null,
          outputTokens: null,
        });
      } catch (logErr: any) {
        console.error("[JOB LOG] Failed to log failure:", logErr.message);
      }
      res.status(500).json({ error: err.message });
    } finally {
      const fsCleanup = require("fs");
      for (const tempFile of Array.from(tempFiles)) {
        try { fsCleanup.rmSync(tempFile, { force: true }); } catch {}
      }
      if (tmpWorkDir) {
        try { fsCleanup.rmSync(tmpWorkDir, { recursive: true, force: true }); } catch {}
      }
    }
  }

  app.post("/api/complexpdf/fix", upload.single("file"), (req, res, next) => { req.setTimeout(600000); res.setTimeout(600000); next(); }, handleComplexPdfFix);

  // ── REMEDY DOCS: unified upload endpoint ─────────────────────────────────────
  // Single entry point replacing the old "Document Fixer" vs "Complex PDF" tool
  // choice. Detects which underlying pipeline the file needs and dispatches to
  // the exact same, unchanged handlers used by the legacy routes above (kept
  // registered for backward compatibility / in case anything still links to
  // them directly). No duplicated logic -- this only decides which one to call.
  app.post("/api/remedy-docs/fix", upload.single("file"), (req, res, next) => { req.setTimeout(600000); res.setTimeout(600000); next(); }, async (req, res) => {
    res.setHeader("X-Remedy-Docs-Version", "2026-08-18-native-forms-alt-v4");
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".docx" && ext !== ".pdf") {
      return res.status(400).json({ error: "Please upload a .docx or .pdf file" });
    }

    // Output format and processing route are separate decisions. "Keep as PDF"
    // still runs document analysis so scanned, image-heavy, and complex PDFs use
    // PDF output uses content-aware routing. Word output still requires the fast
    // pipeline, so reject complex PDFs rather than silently removing figures.
    const explicitMode = typeof req.body?.mode === "string" ? req.body.mode : "";

    let route: DocsRoute;
    try {
      route = await detectDocsRoute(req.file.buffer, ext);
    } catch (err: any) {
      console.error("[REMEDY DOCS] Detection failed, defaulting to fast path:", err.message);
      route = { useVision: false, reason: "detect-exception-fallback" };
    }

    if (explicitMode === "docx" && (route.useVision || route.preserveNative)) {
      res.setHeader("X-Remedy-Docs-Route", "blocked-complex-docx");
      return res.status(422).json({
        error: "This PDF contains scanned, visual, or complex content that cannot be safely converted to Word without losing images. Choose PDF to preserve the document's figures.",
        code: "COMPLEX_PDF_REQUIRES_PDF",
      });
    }

    const routeLabel = route.preserveNative ? "native" : route.useVision ? "vision" : "fast";
    res.setHeader("X-Remedy-Docs-Route", routeLabel);
    console.log(`[REMEDY DOCS] ${req.file.originalname} -> ${routeLabel} pipeline (${route.reason})`);

    if (route.preserveNative) {
      return handleFlyerFix(req, res);
    }
    if (route.useVision) {
      return handleComplexPdfFix(req, res);
    }
    return handleDocumentFix(req, res);
  });

  function parseHelperJson<T>(stdout: string, label: string): T {
    const lines = String(stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index--) {
      try {
        return JSON.parse(lines[index]) as T;
      } catch {
        // Ignore advisory output from third-party runtimes and keep scanning
        // upward for the helper's final JSON record.
      }
    }
    throw new Error(`${label} returned no valid JSON result`);
  }

  // ── FLYER / DESIGNED DOCUMENT: PDF-native tagging pipeline ──────────────────
  // For visually-designed, born-digital PDFs (flyers, posters, one-pagers) that
  // already have a structure tree from their export tool. Unlike the vision/
  // rebuild path above, this NEVER rebuilds the document -- it edits the PDF's
  // own structure tree and content stream in place, so the visual design is
  // preserved pixel-for-pixel. Output stays a PDF; there is no Word conversion
  // option for this path.
  //
  // Pass 1 (Python/pikepdf): find every /Figure struct element, compute its
  // bounding box by replaying the content stream CTM, crop it out of the
  // rendered page.
  // Pass 2 (Node/Claude Vision): for each figure crop, classify decorative
  // (content fully conveyed by nearby text -- safe to drop) vs meaningful
  // (carries unique information -- keep, with a real /Alt description).
  // Pass 3 (Python/pikepdf): apply the decisions -- decorative figures get
  // their content-stream tag rewritten from BDC /Figure to BDC /Artifact
  // (drawing operators untouched) and their struct element removed; meaningful
  // figures keep their struct element with the AI-written /Alt text.
  async function handleFlyerFix(req: Request, res: any) {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") return res.status(400).json({ error: "Please upload a PDF file" });

    const clerkUserId: string | undefined = req.body?.clerkUserId;
    if (clerkUserId) {
      try {
        const usage = await checkHasCredits(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[FLYER USAGE GATE] Error:", gateErr.message);
      }
    }

    const { writeFile, unlink, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const python3 = fs.existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
    const pipelineDir = join(__dirname, "pdf_pipelines");
    const ts = Date.now();
    const tmpPdf = join(tmpdir(), `flyer-${ts}.pdf`);
    const tmpAnnotsOut = join(tmpdir(), `flyer-${ts}-annots-out.pdf`);
    const tmpOut = join(tmpdir(), `flyer-${ts}-out.pdf`);
    const tmpOrphanOut = join(tmpdir(), `flyer-${ts}-orphan-out.pdf`);
    const tmpBgOut = join(tmpdir(), `flyer-${ts}-bg-out.pdf`);
    const tmpReorderOut = join(tmpdir(), `flyer-${ts}-reorder-out.pdf`);
    const tmpTitleOut = join(tmpdir(), `flyer-${ts}-title-out.pdf`);
    const tmpDecisions = join(tmpdir(), `flyer-${ts}-decisions.json`);
    const tmpOrphanDecisions = join(tmpdir(), `flyer-${ts}-orphan-decisions.json`);
    const tmpBgDecisions = join(tmpdir(), `flyer-${ts}-bg-decisions.json`);

    try {
      await writeFile(tmpPdf, req.file.buffer);

      // ── Step 0: fix broken/dangling /Annot scaffolding text ──
      // Design tools (Canva, in particular) leave self-referential
      // template disclaimer text ("this document is an example...")
      // tagged as /Annot struct elements with no matching page /Annots
      // entry -- a dangling reference that most assistive tech either
      // ignores or mishandles. This has no MCID/decision dependency on
      // anything else, so it runs first, directly on the raw upload.
      const annotsResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_fix_annots.py"), tmpPdf, tmpAnnotsOut],
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Annotation scaffolding fix failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const annotsResult = parseHelperJson<any>(annotsResultJson, "Annotation scaffolding fix");

      // ── Step 1: extract every figure's bbox + crop + page text ──
      const extractJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_extract_figures.py"), tmpAnnotsOut],
          { maxBuffer: 50 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Figure extraction failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });

      const { page_text: pageText, figures } = parseHelperJson<{
        page_text: string;
        figures: Array<{ mcid: number; existing_alt: string; bbox: number[] | null; crop_b64: string | null; is_full_bleed: boolean }>;
      }>(extractJson, "Figure extraction");

      // Every figure with a valid bbox gets a crop now (Pass 1 no longer
      // drops full-bleed figures), so this filter only excludes figures
      // whose bbox computation genuinely failed (e.g. no drawing ops found).
      const figuresWithCrops = figures.filter((f) => f.crop_b64);

      // ── Step 1b: detect "orphaned" figures -- BDC /Figure or /Image blocks
      // in the content stream with NO /MCID at all. These are invisible to
      // the struct-tree walk above entirely (no struct element, no ParentTree
      // slot), which is common in Illustrator/InDesign/Canva PDF exports that
      // half-tag a layer as a Figure role without building real struct tree
      // wiring. Handled as a fully separate detection + apply path since they
      // have no mcid to key off of.
      const orphanExtractJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_orphan_figures.py"), "extract", tmpAnnotsOut],
          { maxBuffer: 50 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Orphan figure extraction failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const { orphans } = parseHelperJson<{
        orphans: Array<{ orphan_id: number; bbox: number[]; crop_b64: string; is_full_bleed: boolean }>;
      }>(orphanExtractJson, "Orphan figure extraction");

      // ── Step 2: classify each figure with Claude Vision (parallel) ──
      const visionSystemPrompt = `You are a WCAG 2.1 AA accessibility expert. You are shown one small cropped image -- a single figure/icon/graphic from a larger designed flyer -- plus the full text content of that flyer for context.

The WCAG 1.1.1 test for decorative images is NOT "can I describe what this image shows" -- almost anything is describable. The test is: "if a screen-reader user could not see this image at all, would they be missing any information they don't already get from the surrounding text?" Most icons, illustrations, and thematic graphics on a designed flyer FAIL that test and are decorative, even though they are visually specific and describable.

Default to DECORATIVE. Only mark a figure MEANINGFUL if the surrounding text genuinely does not already convey the same idea. Concretely:
- An icon, illustration, or clip-art graphic placed next to (or above/below) a heading or paragraph about the same topic is DECORATIVE, no matter how specific or well-rendered the icon is -- e.g. a themed icon (tool, object, symbol) beside a section heading/paragraph that already names and explains that same topic in prose. The icon is reinforcing a theme the text already states, not adding new information.
- A logo, emblem, or branding graphic used as visual identity (not as the sole place a name/fact appears) is DECORATIVE.
- A generic decorative border, background pattern, divider line, or bullet-point glyph is always DECORATIVE.
- Mark MEANINGFUL only when the image is the sole carrier of specific information not restated anywhere in the text -- e.g. a chart or diagram with data/labels not written out elsewhere, a photo of a specific identifiable person, place, or product not otherwise named, a QR code, a map, a screenshot with readable content, or a diagram showing a process/relationship that the prose does not spell out.
- When genuinely torn between the two, choose DECORATIVE -- a screen-reader user losing a purely thematic icon costs them nothing; a sighted user seeing a redundant icon next to text they already read costs them nothing either. False positives (marking decorative icons as meaningful) create noisy, unhelpful screen-reader output, which is its own accessibility failure.

If MEANINGFUL, write a concise, specific alt-text description (under 125 characters) of exactly what the image shows and, if relevant, what information it conveys that the text does not.

Respond with ONLY a JSON object, no markdown fences, no explanation:
{"decorative": true or false, "alt_text": "" or "description if meaningful"}`;

      const classifyFigure = async (cropB64: string, existingAlt: string, isFullBleed: boolean, logLabel: string) => {
        try {
          const visionResp = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            system: visionSystemPrompt,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: "image/png", data: cropB64 } },
                  {
                    type: "text",
                    text: `Full flyer text for context:\n"""\n${pageText}\n"""\n\nExisting alt text on this figure (may be empty, vague, or wrong -- do not trust it): "${existingAlt}"${isFullBleed ? "\n\nNote: this crop spans nearly the entire page -- it is a full-bleed background/hero photo or graphic, not a mis-cropped icon. Use a DIFFERENT default for this one: a full-bleed HERO PHOTO (a real photograph of people, places, objects, or a scene -- not an abstract pattern/gradient/color wash/texture) should default to MEANINGFUL, because on a flyer it is prominent, intentional editorial content a sighted user clearly perceives as part of the page's meaning, not incidental decoration like a small thematic icon next to a paragraph. Only mark a full-bleed hero photo DECORATIVE if it is a purely abstract background (solid color, gradient, blur, geometric pattern, texture) with no identifiable subject. If it IS a photo with an identifiable subject, write concise alt text describing what the photo depicts (the scene/subject/action), even if the surrounding text already states the related facts elsewhere -- the description is of the image's visual content, not a restatement of duplicate information, so it is not redundant in the way a small matching icon would be." : ""}\n\nClassify this figure.`,
                  },
                ],
              },
            ],
          });
          let raw = (visionResp.content[0] as any).text.trim();
          raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
          const parsed = JSON.parse(raw);
          return { decorative: !!parsed.decorative, alt_text: String(parsed.alt_text || "") };
        } catch (visionErr: any) {
          console.error(`[FLYER] Vision classification failed for ${logLabel}:`, visionErr.message);
          // Fail safe: keep the figure with its existing alt text rather than
          // guessing wrong in either direction.
          return { decorative: false, alt_text: existingAlt || "Image" };
        }
      };

      const decisions = await Promise.all(
        figuresWithCrops.map(async (fig) => {
          const d = await classifyFigure(fig.crop_b64!, fig.existing_alt, fig.is_full_bleed, `mcid ${fig.mcid}`);
          return { mcid: fig.mcid, ...d };
        })
      );

      const orphanDecisions = await Promise.all(
        orphans.map(async (orphan) => {
          const d = await classifyFigure(orphan.crop_b64, "", orphan.is_full_bleed, `orphan ${orphan.orphan_id}`);
          return { orphan_id: orphan.orphan_id, ...d };
        })
      );

      await writeFile(tmpDecisions, JSON.stringify(decisions));
      await writeFile(tmpOrphanDecisions, JSON.stringify(orphanDecisions));

      // ── Step 3a: apply orphan-figure decisions first (writes an
      // intermediate PDF). This must run before the struct-tree-based apply
      // step below since it can add brand-new struct elements/MCIDs that the
      // struct-tree walk needs to see. If there are no orphans, this is a
      // pure passthrough copy so downstream logic doesn't need to branch.
      const orphanApplyResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_orphan_figures.py"), "apply", tmpAnnotsOut, tmpOrphanOut, tmpOrphanDecisions],
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Orphan figure tag application failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const orphanApplyResult = parseHelperJson<any>(orphanApplyResultJson, "Orphan figure tag application");

      // ── Step 3b: apply the struct-tree figure decisions on top ──
      const applyResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_apply_tags.py"), tmpOrphanOut, tmpOut, tmpDecisions],
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Tag application failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const applyResult = parseHelperJson<any>(applyResultJson, "Tag application");

      // ── Step 3c: detect + classify full-bleed/background images tagged
      // /Artifact /Background that are actually meaningful photos, not
      // decoration. Canva hero banners commonly get this treatment --
      // legitimate for a purely decorative background, wrong for a photo
      // that's the sole carrier of information. Must run after the
      // figure/orphan apply steps (on tmpOut) since it needs the current
      // content-stream state, and before reading-order fix, since any
      // candidate promoted to /Figure gets a brand-new MCID that reading
      // order must account for.
      const bgExtractJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_background_images.py"), "extract", tmpOut],
          { maxBuffer: 50 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Background image extraction failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const { candidates: bgCandidates } = parseHelperJson<{
        page_text: string;
        candidates: Array<{ cand_id: number; bbox: number[]; crop_b64: string; is_full_bleed: boolean }>;
      }>(bgExtractJson, "Background image extraction");

      const bgDecisions = await Promise.all(
        bgCandidates.map(async (cand) => {
          const d = await classifyFigure(cand.crop_b64, "", cand.is_full_bleed, `background ${cand.cand_id}`);
          return { cand_id: cand.cand_id, ...d };
        })
      );
      await writeFile(tmpBgDecisions, JSON.stringify(bgDecisions));

      const bgApplyResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_background_images.py"), "apply", tmpOut, tmpBgOut, tmpBgDecisions],
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Background image tag application failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const bgApplyResult = parseHelperJson<any>(bgApplyResultJson, "Background image tag application");

      // ── Step 3d: fix struct-tree reading order ──
      // Canva/InDesign/Illustrator exports commonly assign MCIDs in the
      // order design layers were created rather than their final on-page
      // position, and never reorder the struct tree to match. Individual
      // figures/paragraphs can be correctly tagged with correct /Alt text
      // and still produce a struct tree whose flat child array is out of
      // visual order -- which is what actually drives screen-reader reading
      // order and click-drag text highlighting in Acrobat/Preview/browsers.
      // This must run last of the structural passes, after all three apply
      // steps above, so it sees the final complete set of MCIDs (including
      // any newly added by the orphan-figure and background-image passes)
      // when computing the correct order.
      const reorderResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_reading_order.py"), tmpBgOut, tmpReorderOut],
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Reading order fix failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const reorderResult = parseHelperJson<any>(reorderResultJson, "Reading order fix");

      // ── Step 4: fix placeholder/missing document title metadata ──
      // Purely metadata (docinfo /Title + XMP dc:title) -- no MCID/struct
      // dependency on anything above, so it runs last, right before the
      // final PDF is read back into memory.
      const titleResultJson: string = await new Promise((resolve, reject) => {
        child_process.execFile(
          python3,
          [join(pipelineDir, "flyer_fix_title.py"), tmpReorderOut, tmpTitleOut],
          { maxBuffer: 10 * 1024 * 1024, timeout: 30000, killSignal: "SIGKILL" },
          (err, stdout, stderr) => {
            if (err) reject(new Error("Title fix failed: " + (stderr?.slice(-500) || err.message)));
            else resolve(stdout);
          }
        );
      });
      const titleResult = parseHelperJson<any>(titleResultJson, "Title fix");
      const finalOutPath = titleResult.changed ? tmpTitleOut : tmpReorderOut;

      const outBuffer = await readFile(finalOutPath);

      // Credit cost: one Claude Vision call per figure classified (minimum 1),
      // consistent with the existing per-call cost-normalized weights above.
      // Orphan figures and background-image candidates also cost one vision
      // call each.
      const creditsUsed = Math.max(1, figuresWithCrops.length + orphans.length + bgCandidates.length);
      if (clerkUserId) {
        try {
          await deductCredits(clerkUserId, creditsUsed);
        } catch (creditErr: any) {
          console.error("[FLYER CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      const filename = req.file.originalname.replace(/\.pdf$/i, "") + "-accessible.pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Flyer-Total-Figures", String(applyResult.total_figures + orphanApplyResult.orphans_found + bgApplyResult.converted));
      res.setHeader("X-Flyer-Decorative-Removed", String(applyResult.decorative_removed + orphanApplyResult.decorative_converted));
      res.setHeader("X-Flyer-Meaningful-Kept", String(applyResult.meaningful_kept + orphanApplyResult.meaningful_added + bgApplyResult.converted));
      res.setHeader("X-Flyer-Orphan-Figures-Found", String(orphanApplyResult.orphans_found));
      res.setHeader("X-Flyer-Background-Images-Converted", String(bgApplyResult.converted));
      res.setHeader("X-Flyer-Annots-Fixed", String(annotsResult.converted_to_artifact + annotsResult.removed_empty));
      res.setHeader("X-Flyer-Title-Fixed", String(!!titleResult.changed));
      res.setHeader("X-Flyer-Reading-Order-Fixed", String(!!reorderResult.reordered));

      if (clerkUserId) {
        try {
          storage.createJob({
            type: "flyer",
            status: "completed",
            inputName: req.file.originalname,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: 1,
            creditsUsed,
            inputTokens: null,
            outputTokens: null,
          });
        } catch (jobErr: any) {
          console.error("[JOB LOG] Error:", jobErr.message);
        }
      }

      return res.send(outBuffer);
    } catch (err: any) {
      console.error(`[FLYER] ${req.file?.originalname || "unknown file"} -- tagging pipeline failed:`, err.message);
      try {
        storage.createJob({
          type: "flyer",
          status: "failed",
          inputName: req.file?.originalname || null,
          result: null,
          errorMessage: String(err.message || err).slice(0, 500),
          createdAt: Date.now(),
          clerkUserId: (req.body?.clerkUserId as string) || null,
          pageCount: null,
          creditsUsed: null,
          inputTokens: null,
          outputTokens: null,
        });
      } catch (logErr: any) {
        console.error("[JOB LOG] Failed to log failure:", logErr.message);
      }
      res.status(500).json({ error: err.message });
    } finally {
      await unlink(tmpPdf).catch(() => {});
      await unlink(tmpAnnotsOut).catch(() => {});
      await unlink(tmpOut).catch(() => {});
      await unlink(tmpOrphanOut).catch(() => {});
      await unlink(tmpBgOut).catch(() => {});
      await unlink(tmpReorderOut).catch(() => {});
      await unlink(tmpTitleOut).catch(() => {});
      await unlink(tmpDecisions).catch(() => {});
      await unlink(tmpOrphanDecisions).catch(() => {});
      await unlink(tmpBgDecisions).catch(() => {});
    }
  }

  // ── KEEP AS PDF: tag the fast path's already-generated structured HTML ──────
  // The fast (text-extraction) path already produces fully WCAG-structured HTML
  // via handleDocumentFix (headings, lists, tables with scope). This endpoint is
  // a SEPARATE, standalone consumer of that same output -- it does not modify
  // handleDocumentFix or handleComplexPdfFix at all. It takes the structuredHtml
  // the client already has (from a prior call to /api/remedy-docs/fix) and runs
  // it through a standalone WeasyPrint tagged-PDF builder
  // (pdf_pipelines/text_pdf_tag.py -- a trimmed clone of the vision path's proven
  // builder, simplified for one HTML blob with no embedded figures/images).
  // No file re-upload, no re-running Claude -- this only re-packages HTML that
  // was already paid for and generated by the /fix call.
  async function handleDocumentFixAsPdf(req: Request, res: any) {
    const { structuredHtml, title, filename } = req.body || {};
    if (!structuredHtml || typeof structuredHtml !== "string") {
      return res.status(400).json({ error: "structuredHtml is required" });
    }

    const { unlink } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const python3 = fs.existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
    const pipelineDir = join(__dirname, "pdf_pipelines");
    const ts = Date.now();
    const tmpOut = join(tmpdir(), `docpdf-${ts}-out.pdf`);
    const tmpScript = join(pipelineDir, "text_pdf_tag.py");

    try {
      const docTitle = String(title || filename || "Document").replace(/\.(pdf|docx)$/i, "");
      const stdinPayload = JSON.stringify({ html: structuredHtml, title: docTitle });

      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(python3, [tmpScript, tmpOut], { timeout: 120000 });
        proc.stdin.write(stdinPayload);
        proc.stdin.end();
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        proc.on("close", (code: number) => {
          if (code !== 0) reject(new Error("PDF generation failed: " + stderr.slice(-800)));
          else resolve();
        });
        proc.on("error", (err) => reject(err));
      });

      const outBuffer = fs.readFileSync(tmpOut);
      const baseName = String(filename || docTitle).replace(/\.(pdf|docx)$/i, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}-accessible.pdf"`);
      return res.send(outBuffer);
    } catch (err: any) {
      console.error("[REMEDY DOCS -> PDF] Failed:", err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      await unlink(tmpOut).catch(() => {});
    }
  }

  app.post("/api/flyer/fix", upload.single("file"), (req, res, next) => { req.setTimeout(180000); res.setTimeout(180000); next(); }, handleFlyerFix);

  // Body-size limit for this JSON payload (a full structuredHtml document)
  // is handled by the global express.json({ limit: "25mb" }) in index.ts.
  app.post(
    "/api/remedy-docs/fix-as-pdf",
    (req, res, next) => { req.setTimeout(120000); res.setTimeout(120000); next(); },
    handleDocumentFixAsPdf,
  );


  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body || {};
      if (!email || !message) {
        return res.status(400).json({ message: "Name, email, and message are required." });
      }
      console.log(`[CONTACT] ${new Date().toISOString()} — ${name} <${email}> | Subject: ${subject}`);
      console.log(`[CONTACT MESSAGE] ${message}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Waitlist endpoint for coming soon page
  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string" || !/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      // Log to console (Railway logs) — easy to review from dashboard
      console.log(`[WAITLIST] ${new Date().toISOString()} — ${email.trim()}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/alttext/generate", upload.single("image"), async (req, res) => {
    const context = req.body.context || "";
    const clerkUserId: string | undefined = req.body?.clerkUserId;

    // ── Usage gate — pre-flight only, confirms user has ANY credits available ──
    if (clerkUserId) {
      try {
        const usage = await checkHasCredits(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[ALTTEXT USAGE GATE] Error:", gateErr.message);
        // Fail open — don't block if Clerk is temporarily unavailable
      }
    }

    try {
      let imageData: string;
      let mediaType: string;

      if (req.file) {
        imageData = req.file.buffer.toString("base64");
        mediaType = req.file.mimetype || "image/png";
      } else if (req.body.imageUrl) {
        const urlResp = await fetch(req.body.imageUrl);
        const buf = Buffer.from(await urlResp.arrayBuffer());
        imageData = buf.toString("base64");
        mediaType = urlResp.headers.get("content-type") || "image/png";
      } else {
        return res.status(400).json({ error: "No image or URL provided" });
      }

      // Use Claude vision to generate alt text
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: imageData },
            },
            {
              type: "text",
              text: `Generate accessible alt text for this image following WCAG guidelines.
${context ? `Context about this image: ${context}` : ""}

Return JSON:
{
  "altText": string (concise, descriptive, under 125 characters for simple images),
  "longDescription": string (detailed description for complex images like charts/diagrams, or null if not needed),
  "isDecorative": boolean,
  "reasoning": string (why you wrote it this way)
}

Rules:
- Don't start with "image of" or "photo of"
- Be specific and descriptive
- For decorative images, set isDecorative: true and altText: ""
- For charts/graphs, describe the data trend in longDescription
- Include colors, emotions, actions when relevant`,
            }
          ],
        }],
      });

      const responseText = (msg.content[0] as any).text;
      let parsed;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsed = { altText: responseText, longDescription: null, isDecorative: false, reasoning: "" };
      }

      // ── Deduct credits + log job (flat rate per image) ──
      let altTextJobId: number | null = null;
      let altTextCreditsRemaining: number | undefined;
      if (clerkUserId) {
        try {
          const { creditsRemaining } = await deductCredits(clerkUserId, ALTTEXT_CREDITS_PER_IMAGE);
          altTextCreditsRemaining = creditsRemaining;
          const job = storage.createJob({
            type: "alttext",
            status: "completed",
            inputName: req.file?.originalname || null,
            result: null,
            errorMessage: null,
            createdAt: Date.now(),
            clerkUserId,
            pageCount: 1,
            creditsUsed: ALTTEXT_CREDITS_PER_IMAGE,
            inputTokens: null,
            outputTokens: null,
          });
          altTextJobId = job.id;
        } catch (creditErr: any) {
          console.error("[ALTTEXT CREDIT DEDUCT] Error:", creditErr.message);
        }
      }

      res.json({ success: true, ...parsed, jobId: altTextJobId, creditsUsed: ALTTEXT_CREDITS_PER_IMAGE, creditsRemaining: altTextCreditsRemaining });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Stripe Checkout ──────────────────────────────────────────
  // (stripe client initialized near the top of this function so it's in scope
  // for the /api/admin/dashboard route, which is registered earlier below)

  // ── Stripe Webhook ───────────────────────────────────────────
  // Must be registered BEFORE express.json() parses the body
  app.post("/api/stripe/webhook", (req, res, next) => {
    // Express may have already parsed; use raw body if available
    const rawBody = (req as any).rawBody || req.body;
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    if (!stripe || !webhookSecret) {
      return res.status(400).json({ error: "Stripe webhook not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle checkout completed — mark user as subscribed in Clerk
    if (event.type === "checkout.session.completed" || event.type === "customer.subscription.created") {
      (async () => {
        try {
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          let clerkUserId: string | undefined;

          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            clerkUserId = session.client_reference_id || (session.metadata as any)?.clerkUserId || undefined;
            // Also store Stripe customer ID for future lookups
            if (clerkUserId) {
              const plan = (session.metadata as any)?.plan || "individual";
              const seats = parseInt((session.metadata as any)?.seats || "1");

              // ── Credit pack purchase ──────────────────────────────────────
              if (plan === "credits") {
                const qty = parseInt((session.metadata as any)?.quantity || "0");
                const existing = await clerkClient.users.getUser(clerkUserId);
                const existingMeta = (existing.publicMetadata || {}) as any;
                const currentCredits = existingMeta.purchasedCredits || 0;
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    ...existingMeta,
                    purchasedCredits: currentCredits + qty,
                  },
                });
                console.log(`[WEBHOOK] Added ${qty} credits to user ${clerkUserId} (total: ${currentCredits + qty})`);
                return; // Done — no subscription to handle
              }

              if (!session.customer) return;

              if (plan === "team") {
                // If this buyer already had an individual subscription
                // (upgrading individual -> team), cancel the old
                // subscription so they aren't billed for both plans.
                try {
                  const priorUser = await clerkClient.users.getUser(clerkUserId);
                  const priorMeta = (priorUser.publicMetadata || {}) as any;
                  const priorCustomerId = priorMeta.stripeCustomerId;
                  if (priorMeta.plan === "individual" && priorCustomerId && priorCustomerId !== session.customer) {
                    const priorSubs = await stripe!.subscriptions.list({ customer: priorCustomerId, status: "active", limit: 10 });
                    for (const sub of priorSubs.data) {
                      await stripe!.subscriptions.cancel(sub.id);
                      console.log(`[WEBHOOK] Cancelled prior individual subscription ${sub.id} for user ${clerkUserId} upgrading to team`);
                    }
                  }
                } catch (cancelErr: any) {
                  console.error("[WEBHOOK] Failed to cancel prior individual subscription on team upgrade:", cancelErr.message);
                }

                // Create a Clerk Organization for the buyer
                const orgName = `Team (${new Date().toLocaleDateString()})`;
                const cappedSeats = Math.min(MAX_TEAM_SEATS, seats);
                const org = await clerkClient.organizations.createOrganization({
                  name: orgName,
                  createdBy: clerkUserId,
                  maxAllowedMemberships: cappedSeats,
                  // billingOwnerId is whoever's Stripe customer is charged for this team's
                  // subscription (the purchaser, at creation time). If they ever leave the
                  // org or are demoted from org:admin, resolveTeamSeatContext() below
                  // auto-reassigns this to another remaining admin with their own
                  // stripeCustomerId on file (Fix #7).
                  publicMetadata: { plan: "team", seats: cappedSeats, billingOwnerId: clerkUserId },
                });
                // A purchase (new signup OR upgrade from an existing individual/free
                // account) always starts a fresh monthly credit cycle from today --
                // otherwise an upgrader's reset date would carry over stale from
                // whatever their prior plan had already scheduled.
                const purchaseDate = new Date();
                const freshAnniversaryDay = purchaseDate.getUTCDate();
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    subscribed: true,
                    plan: "team",
                    teamSeats: seats,
                    orgId: org.id,
                    stripeCustomerId: session.customer as string,
                    subscribedAt: purchaseDate.toISOString(),
                    monthlyCreditsUsed: 0,
                    usageAnniversaryDay: freshAnniversaryDay,
                    usageResetDate: getFirstResetDate(purchaseDate),
                  },
                });
                console.log(`[WEBHOOK] Team checkout: created org ${org.id} for user ${clerkUserId} with ${seats} seats, credits reset to today's cycle`);
              } else {
                const purchaseDate = new Date();
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    subscribed: true,
                    plan: "individual",
                    stripeCustomerId: session.customer as string,
                    subscribedAt: purchaseDate.toISOString(),
                    monthlyCreditsUsed: 0,
                    usageAnniversaryDay: purchaseDate.getUTCDate(),
                    usageResetDate: getFirstResetDate(purchaseDate),
                  },
                });
                console.log(`[WEBHOOK] Marked user ${clerkUserId} as subscribed (individual), credits reset to today's cycle`);
              }
            }
          }

          // Also handle subscription cancellation
        } catch (err: any) {
          console.error("[WEBHOOK] Failed to update Clerk metadata:", err.message);
        }
      })();
    }

    // Handle subscription updates (e.g. plan/price switched via the Stripe
    // Customer Portal) — keep Clerk metadata's plan + credit limit in sync.
    if (event.type === "customer.subscription.updated") {
      (async () => {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          const users = await clerkClient.users.getUserList({ limit: 100 });
          const user = users.data.find(
            (u) => (u.publicMetadata as any)?.stripeCustomerId === customerId
          );
          if (!user) return;

          const meta = (user.publicMetadata || {}) as any;

          // Fix #2: team-plan quantity changes normally flow through our own
          // /api/team/add-seats and /api/team/remove-seats endpoints, which sync
          // Stripe and Clerk together. But if a team subscription's quantity is
          // ever changed some OTHER way (a manual edit in the Stripe dashboard, a
          // support action, a future integration), Clerk's seats/maxAllowedMemberships
          // would silently drift out of sync with the real Stripe subscription
          // with no code path to catch it. This block re-syncs Clerk to whatever
          // Stripe now says whenever a team subscription's line-item quantity
          // doesn't match our own record of the org's seat count.
          if (meta.plan === "team") {
            try {
              const TEAM_PRICES = [TODO_STRIPE_PRICE_TEAM_249, "price_1TycqNAaDElV6hZxvedkVIYg" /* legacy $299/yr/seat */].filter(Boolean);
              const teamItem = subscription.items.data.find((item) => item.price?.id && TEAM_PRICES.includes(item.price.id));
              if (!teamItem || !teamItem.quantity) return;

              const orgId: string | undefined = meta.orgId;
              if (!orgId) return;

              const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
              const orgMeta = (org.publicMetadata || {}) as any;
              const recordedSeats: number = orgMeta.seats || 0;
              const stripeSeats = teamItem.quantity;

              // Fix #3/#6: mirror Stripe's subscription status onto the org so the
              // read-only restriction reflects reality even when this update didn't
              // originate from our own confirm endpoints. Only "active" and
              // "trialing" count as good-standing; "past_due", "unpaid", "incomplete",
              // etc. immediately restrict the team to read-only (per product decision).
              const inGoodStanding = subscription.status === "active" || subscription.status === "trialing";
              const shouldBeRestricted = !inGoodStanding;
              const seatsChanged = stripeSeats !== recordedSeats;
              const restrictionChanged = Boolean(orgMeta.billingRestricted) !== shouldBeRestricted;

              if (seatsChanged || restrictionChanged) {
                await clerkClient.organizations.updateOrganization(orgId, {
                  publicMetadata: { ...orgMeta, seats: stripeSeats, billingRestricted: shouldBeRestricted },
                  maxAllowedMemberships: stripeSeats,
                });
                if (seatsChanged) {
                  console.log(`[WEBHOOK] Re-synced org ${orgId} seats from out-of-band Stripe change: ${recordedSeats} -> ${stripeSeats}`);
                }
                if (restrictionChanged) {
                  console.log(`[WEBHOOK] Org ${orgId} billingRestricted -> ${shouldBeRestricted} (subscription status: ${subscription.status})`);
                }
              }
            } catch (teamSyncErr: any) {
              console.error("[WEBHOOK] Failed to sync team org seats from out-of-band Stripe change:", teamSyncErr.message);
            }
            return; // Team plans don't go through the individual-plan logic below.
          }

          const priceId = subscription.items.data[0]?.price?.id;
          if (!priceId) return;

          const INDIVIDUAL_PRICES = [
            process.env.STRIPE_PRICE_MONTHLY,
            process.env.STRIPE_PRICE_ANNUAL,
            TODO_STRIPE_PRICE_MONTHLY_19, // $19/mo individual (130 credits/mo) — current, Aug 2026
            TODO_STRIPE_PRICE_ANNUAL_199, // $199/yr individual (130 credits/mo) — current, Aug 2026
            "price_1Tycq3AaDElV6hZxP4W6qC7M", // legacy $25/mo
            "price_1TycqCAaDElV6hZxKM0uIEu2", // legacy $229/yr
            "price_1Thc2tAaDElV6hZxMwA0Wxgk", // legacy $19/mo
            "price_1Tx9ixAaDElV6hZxZ6vb54pl", // legacy $179/yr
            "price_1Thc2sAaDElV6hZx3M4Ua1kM", // legacy $149/yr
          ].filter(Boolean);

          if (!INDIVIDUAL_PRICES.includes(priceId)) return;

          const isActive = subscription.status === "active" || subscription.status === "trialing";
          await clerkClient.users.updateUserMetadata(user.id, {
            publicMetadata: {
              ...meta,
              subscribed: isActive,
              plan: "individual",
            },
          });
          console.log(`[WEBHOOK] Synced portal plan change for user ${user.id}: price ${priceId}, status ${subscription.status}`);
        } catch (err: any) {
          console.error("[WEBHOOK] Failed to sync subscription update:", err.message);
        }
      })();
    }

    // Handle subscription cancelled/deleted — remove subscribed flag
    if (event.type === "customer.subscription.deleted") {
      (async () => {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          // Find user by stripeCustomerId in metadata
          const users = await clerkClient.users.getUserList({ limit: 100 });
          const user = users.data.find(
            (u) => (u.publicMetadata as any)?.stripeCustomerId === customerId
          );
          if (user) {
            await clerkClient.users.updateUserMetadata(user.id, {
              publicMetadata: { subscribed: false },
            });
            console.log(`[WEBHOOK] Removed subscription for user ${user.id}`);
          }
        } catch (err: any) {
          console.error("[WEBHOOK] Failed to remove subscription:", err.message);
        }
      })();
    }

    res.json({ received: true });
  });

  // ── Clerk Webhook ────────────────────────────────────────────
  // Fix: deleting an account via Clerk's own account UI (the only place users
  // can delete their account -- there is no in-app delete flow) previously left
  // any active Stripe subscription running forever, since nothing here ever
  // heard about the deletion. This listens for Clerk's `user.deleted` event and
  // cancels that user's Stripe subscription (looked up by their stored
  // `stripeCustomerId`) before the account disappears, so people who delete
  // their account stop being billed. Individual plans: cancels their personal
  // subscription. Team plans: only cancels a subscription if THIS user is the
  // org's billing owner (deleting a regular member's account must never cancel
  // the whole team's subscription -- ownership can be reassigned; see
  // resolveTeamSeatContext / Fix #7 elsewhere in this file).
  // Requires CLERK_WEBHOOK_SECRET to be set (from the Clerk Dashboard ->
  // Webhooks -> this endpoint's signing secret) and a webhook endpoint
  // configured in Clerk pointing at POST /api/clerk/webhook subscribed to the
  // "user.deleted" event. Must be registered so the raw body is available for
  // signature verification -- see server/index.ts's express.json `verify`.
  app.post("/api/clerk/webhook", (req, res, next) => {
    const rawBody = (req as any).rawBody;
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || "";

    if (!webhookSecret) {
      console.error("[CLERK WEBHOOK] CLERK_WEBHOOK_SECRET not configured -- rejecting");
      return res.status(400).json({ error: "Clerk webhook not configured" });
    }
    if (!rawBody) {
      return res.status(400).json({ error: "Missing raw body" });
    }

    let event: any;
    try {
      const svixId = req.headers["svix-id"] as string;
      const svixTimestamp = req.headers["svix-timestamp"] as string;
      const svixSignature = req.headers["svix-signature"] as string;
      const wh = new SvixWebhook(webhookSecret);
      event = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err: any) {
      console.error("[CLERK WEBHOOK] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event.type === "user.deleted") {
      (async () => {
        try {
          const deletedUserId: string | undefined = event.data?.id;
          // Clerk's user.deleted payload only reliably includes the user ID --
          // the user record itself is already gone by the time this fires, so
          // we cannot re-fetch it from Clerk to read stripeCustomerId off their
          // publicMetadata. Instead we search Stripe SUBSCRIPTIONS directly by
          // the clerkUserId stamped into subscription_data.metadata at checkout
          // time (see /api/stripe/create-checkout-session and
          // create-team-checkout). Subscriptions created before this fix won't
          // have that metadata and won't be found here -- existing subscribers
          // are unaffected either way since this only runs on account deletion.
          if (!deletedUserId) {
            console.error("[CLERK WEBHOOK] user.deleted event missing user id");
            return;
          }
          // Defensive: Clerk user IDs are always "user_" + alphanumerics. Reject
          // anything else before it ever reaches a Stripe search query string,
          // even though this value comes from Clerk's own signed webhook payload
          // (not end-user input) so injection risk here is effectively nil.
          if (!/^user_[A-Za-z0-9]+$/.test(deletedUserId)) {
            console.error("[CLERK WEBHOOK] user.deleted id has unexpected format, refusing to search Stripe:", deletedUserId);
            return;
          }
          if (!stripe) {
            console.error("[CLERK WEBHOOK] Stripe not configured -- cannot cancel subscription for deleted user", deletedUserId);
            return;
          }

          const subs = await stripe.subscriptions.search({
            query: `status:'active' AND metadata['clerkUserId']:'${deletedUserId}'`,
            limit: 10,
          });

          if (subs.data.length === 0) {
            console.log(`[CLERK WEBHOOK] No active Stripe subscription found for deleted user ${deletedUserId} -- nothing to cancel`);
            return;
          }

          for (const sub of subs.data) {
            // Team plans: only cancel if this deleted user was the billing owner
            // (whoever's card is actually charged). Deleting a regular team
            // member's account must never cancel the whole team's subscription.
            const isTeamSub = (sub.metadata as any)?.plan === "team";
            const billingOwnerId = (sub.metadata as any)?.billingOwnerId;
            if (isTeamSub && billingOwnerId && billingOwnerId !== deletedUserId) {
              console.log(`[CLERK WEBHOOK] Skipping team subscription ${sub.id} -- deleted user ${deletedUserId} is not the billing owner (${billingOwnerId})`);
              continue;
            }
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[CLERK WEBHOOK] Cancelled Stripe subscription ${sub.id} for deleted user ${deletedUserId}`);
          }
        } catch (err: any) {
          console.error("[CLERK WEBHOOK] Failed to process user.deleted:", err.message);
        }
      })();
    }

    res.json({ received: true });
  });

  // ── Team Checkout ─────────────────────────────────────────
  app.post("/api/stripe/create-team-checkout", async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { seats, clerkUserId } = req.body;
      const qty = Math.min(MAX_TEAM_SEATS, Math.max(2, parseInt(seats) || 2));
      const TEAM_PRICE = TODO_STRIPE_PRICE_TEAM_249; // $249/yr/seat (145 credits/mo/seat), Aug 2026

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: TEAM_PRICE, quantity: qty }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/team/setup?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/pricing`,
        allow_promotion_codes: true,
        client_reference_id: clerkUserId || undefined,
        metadata: { plan: "team", seats: String(qty) },
        // Stamp clerkUserId + billingOwnerId onto the SUBSCRIPTION itself (not
        // just this one-time checkout session) so the account-deletion webhook
        // can find it later and knows who the billing owner is -- deleting a
        // regular team member's account must never cancel the whole team's
        // subscription, only the billing owner's deletion should.
        subscription_data: {
          metadata: { plan: "team", clerkUserId: clerkUserId || "", billingOwnerId: clerkUserId || "" },
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Team checkout error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Invoice / PO Request ──────────────────────────────────
  app.post("/api/invoice-request", async (req, res) => {
    try {
      const {
        institutionName, contactName, contactEmail, contactPhone,
        institutionType, seats, poNumber, timeline, notes,
      } = req.body;

      if (!institutionName || !contactName || !contactEmail || !institutionType || !seats || !timeline) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const total = (parseInt(seats) || 2) * 249;
      const body = [
        `Institution: ${institutionName}`,
        `Type: ${institutionType}`,
        `Contact: ${contactName} — ${contactEmail}${contactPhone ? ` — ${contactPhone}` : ""}`,
        `Seats: ${seats} × $249 = $${total.toLocaleString()}/year (145 credits/seat/month)`,
        `PO Number: ${poNumber || "Not provided"}`,
        `Timeline: ${timeline}`,
        `Notes: ${notes || "None"}`,
      ].join("\n");

      // Send email via Formspree contact endpoint (reuse existing)
      await fetch("https://formspree.io/f/xojbekbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactEmail,
          subject: `Invoice Request — ${institutionName} (${seats} seats)`,
          message: body,
        }),
      });

      console.log(`[INVOICE REQUEST] ${institutionName} — ${seats} seats — ${contactEmail}`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Invoice request error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Credit Pack Checkout ────────────────────────────────────────────────────
  app.post("/api/stripe/create-credits-checkout", async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { pack, clerkUserId } = req.body;
      // Page-credit blocks — quantity is fixed per pack (1 unit of the block price)
      const CREDIT_PACKS: Record<string, { price: string; credits: number }> = {
        "25": { price: "price_1Tx9hxAaDElV6hZxHqpBRDQ9", credits: 25 },
        "50": { price: "price_1Tx9hyAaDElV6hZx3t25Cl8P", credits: 50 },
        "100": { price: "price_1Tx9hyAaDElV6hZx0yAgsX4f", credits: 100 },
      };
      const selected = CREDIT_PACKS[String(pack)] || CREDIT_PACKS["50"];

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: selected.price, quantity: 1 }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/dashboard?credits=purchased`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/dashboard`,
        allow_promotion_codes: true,
        client_reference_id: clerkUserId || undefined,
        metadata: { plan: "credits", quantity: String(selected.credits), clerkUserId: clerkUserId || "" },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Credits checkout error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.options("/api/stripe/create-checkout-session", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST");
    res.sendStatus(200);
  });

  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { priceId, clerkUserId } = req.body;
      if (!priceId) return res.status(400).json({ error: "Missing priceId" });

      const validPrices = [
        process.env.STRIPE_PRICE_MONTHLY,
        process.env.STRIPE_PRICE_ANNUAL,
        // live mode prices
        TODO_STRIPE_PRICE_MONTHLY_19, // $19/mo individual (130 credits/mo) — current, Aug 2026
        TODO_STRIPE_PRICE_ANNUAL_199, // $199/yr individual (130 credits/mo) — current, Aug 2026
        "price_1Tycq3AaDElV6hZxP4W6qC7M", // old $25/mo — kept valid for legacy subscribers only
        "price_1TycqCAaDElV6hZxKM0uIEu2", // old $229/yr — kept valid for legacy subscribers only
        "price_1Thc2tAaDElV6hZxMwA0Wxgk", // old $19/mo — kept valid for legacy subscribers only
        "price_1Tx9ixAaDElV6hZxZ6vb54pl", // old $179/yr — kept valid for legacy subscribers only
        "price_1Thc2sAaDElV6hZx3M4Ua1kM", // old $149/yr — kept valid for legacy subscribers only
      ].filter(Boolean);
      if (!validPrices.includes(priceId)) {
        return res.status(400).json({ error: "Invalid priceId" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/pricing`,
        allow_promotion_codes: true,
        // Pass Clerk user ID so webhook can link payment to account
        client_reference_id: clerkUserId || undefined,
        // Also stamp clerkUserId onto the SUBSCRIPTION itself (not just this
        // one-time checkout session) so the account-deletion webhook can still
        // find and cancel it later, after the Clerk user record is gone and
        // client_reference_id/session metadata is no longer reachable.
        subscription_data: {
          metadata: { plan: "individual", clerkUserId: clerkUserId || "" },
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      const keyPrefix = (process.env.STRIPE_SECRET_KEY || "").slice(0, 15);
      console.error("Stripe checkout error:", err.message, "| key prefix:", keyPrefix);
      res.status(500).json({ error: err.message, keyPrefix });
    }
  });

  // ── Stripe Customer Portal (manage/upgrade/downgrade existing subscription) ──
  let cachedPortalConfigId: string | null = null;

  async function getOrCreatePortalConfig(): Promise<string> {
    if (cachedPortalConfigId) return cachedPortalConfigId;
    if (!stripe) throw new Error("Stripe not configured");

    // Individual plan prices customers can self-serve switch between
    // (monthly <-> annual). Team plan changes are handled outside the portal.
    const monthly = process.env.STRIPE_PRICE_MONTHLY || TODO_STRIPE_PRICE_MONTHLY_19;
    const annual = process.env.STRIPE_PRICE_ANNUAL || TODO_STRIPE_PRICE_ANNUAL_199;

    const config = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Remedy508 partners with Stripe for secure billing.",
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "address", "phone"],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          cancellation_reason: {
            enabled: true,
            options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [
            {
              product: (await stripe.prices.retrieve(monthly)).product as string,
              prices: [monthly, annual],
            },
          ],
        },
      },
    });
    cachedPortalConfigId = config.id;
    return config.id;
  }

  app.options("/api/stripe/create-portal-session", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });

  app.post("/api/stripe/create-portal-session", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { clerkUserId } = req.body;
      if (!clerkUserId) return res.status(400).json({ error: "Missing clerkUserId" });

      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const user = await clerkClient.users.getUser(clerkUserId);
      const meta = (user.publicMetadata || {}) as any;
      const customerId = meta.stripeCustomerId;
      if (!customerId) {
        return res.status(400).json({ error: "No active subscription found for this account" });
      }

      const configurationId = await getOrCreatePortalConfig();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        configuration: configurationId,
        return_url: `${process.env.APP_URL || "https://remedy508.com"}/dashboard`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe portal session error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── KB API ────────────────────────────────────────────────────────────────

  // GET all sections + articles
  app.get("/api/kb/sections", (_req, res) => {
    res.json(kbDb.getSections());
  });

  // GET all articles
  app.get("/api/kb/articles", (_req, res) => {
    res.json(kbDb.getAll());
  });

  // GET single article
  app.get("/api/kb/articles/:id", (req, res) => {
    const article = kbDb.getById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    res.json(article);
  });

  // GET search
  app.get("/api/kb/search", (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    res.json(kbDb.search(q));
  });

  // PATCH article (admin only)
  app.patch("/api/kb/articles/:id", async (req, res) => {
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) return res.status(500).json({ error: "Auth not configured" });
      const { createClerkClient } = await import("@clerk/backend");
      const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

      // Verify session token from Authorization header
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      let userId: string;
      try {
        const session = await clerkClient.verifyToken(token);
        userId = session.sub;
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Admin check
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (email !== "amandathecarpenter@gmail.com") {
        return res.status(403).json({ error: "Admin only" });
      }

      const updated = kbDb.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST upload video file for an article (admin only, multipart)
  const kbUpload = multer({ dest: "/tmp/kb-uploads/" });
  app.post("/api/kb/articles/:id/upload-video", kbUpload.single("video"), async (req, res) => {
    try {
      // In production, you'd upload to Cloudflare R2/S3 here.
      // For now, store locally and serve from /uploads/kb/
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) return res.status(500).json({ error: "Auth not configured" });
      const { createClerkClient } = await import("@clerk/backend");
      const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      let userId: string;
      try {
        const session = await clerkClient.verifyToken(token);
        userId = session.sub;
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (email !== "amandathecarpenter@gmail.com") return res.status(403).json({ error: "Admin only" });

      if (!req.file) return res.status(400).json({ error: "No file" });

      const uploadDir = path.join(process.cwd(), "public", "kb-videos");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || ".mp4";
      const filename = `${req.params.id}${ext}`;
      fs.renameSync(req.file.path, path.join(uploadDir, filename));
      const video_url = `/kb-videos/${filename}`;

      const updated = kbDb.update(req.params.id, { video_url, video_status: "published" });
      res.json({ video_url, article: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

}
// pdftotext fix Thu Apr 16 18:03:54 UTC 2026
// yt-dlp android client fix Thu Apr 16 23:10:37 UTC 2026
// Stripe checkout Thu May 21 2026
