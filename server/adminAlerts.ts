// Owner alert emails: new account, free trial started, payment completed.
// Sent through Resend to ADMIN_ALERTS_TO_EMAIL (default hello@remedy508.com).
// Alerts are best-effort: a failed email is logged and never blocks sign-up,
// trial start, or Stripe webhook processing.
import type Database from "better-sqlite3";
import type { Resend } from "resend";

const ALERTS_TO = process.env.ADMIN_ALERTS_TO_EMAIL || "hello@remedy508.com";
const ALERTS_FROM = "Remedy508 Alerts <reports@remedy508.com>";
const ADMIN_EMAIL = "amandathecarpenter@gmail.com";
const POLL_MS = 5 * 60 * 1000;

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const when = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";

export function intentLabel(intent: unknown): string {
  switch (intent) {
    case "trial": return "Free trial";
    case "monthly": return "Individual, monthly ($19/mo)";
    case "annual": return "Individual, annual ($199/yr)";
    case "team": return "Team plan";
    case "invite": return "Team invitation";
    default: return "Not recorded";
  }
}

export async function sendAdminAlert(resend: Resend | null, subject: string, rows: [string, string][]) {
  if (!resend) {
    console.warn(`[ALERT] RESEND_API_KEY not configured -- skipped alert: ${subject}`);
    return false;
  }
  const html = `<h2 style="font-family:Arial,sans-serif;color:#0f766e">${esc(subject)}</h2>
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
${rows.map(([k, v]) => `<tr><th align="left" style="padding:4px 12px 4px 0;color:#3a485b">${esc(k)}</th><td style="padding:4px 0">${esc(v)}</td></tr>`).join("\n")}
</table>`;
  const textBody = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  try {
    await resend.emails.send({ from: ALERTS_FROM, to: ALERTS_TO, subject, html, text: textBody });
    console.log(`[ALERT] Sent: ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`[ALERT] Failed to send "${subject}":`, err?.message);
    return false;
  }
}

type ClerkUserLike = {
  id: string;
  createdAt: number;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: { emailAddress: string }[];
  unsafeMetadata?: Record<string, unknown>;
};
const nameOf = (u: ClerkUserLike) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "(no name given)";
const emailOf = (u: ClerkUserLike) => u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "(no email)";

export function trialStartedAlert(resend: Resend | null, user: ClerkUserLike) {
  if (emailOf(user) === ADMIN_EMAIL) return;
  void sendAdminAlert(resend, `Free trial started: ${emailOf(user)}`, [
    ["Name", nameOf(user)],
    ["Email", emailOf(user)],
    ["Trial", "14 days, 30 Credits"],
    ["Started", when(Date.now())],
  ]);
}

export function paymentAlert(resend: Resend | null, s: {
  email?: string | null; name?: string | null; amountTotal?: number | null; currency?: string | null;
  plan?: string | null; seats?: string | null; mode?: string | null; sessionId: string;
}) {
  const amount = s.amountTotal != null ? `${(s.amountTotal / 100).toFixed(2)} ${(s.currency || "usd").toUpperCase()}` : "unknown";
  const plan = s.plan === "team" ? `Team (${s.seats || "?"} seats)` : s.plan === "credits" ? "Credit pack" : "Individual";
  void sendAdminAlert(resend, `Payment received: ${amount} from ${s.email || "unknown"}`, [
    ["Name", s.name || "(not given)"],
    ["Email", s.email || "(not given)"],
    ["Plan", plan],
    ["Amount", amount],
    ["Type", s.mode === "subscription" ? "Subscription" : "One-time"],
    ["Stripe checkout", s.sessionId],
    ["Time", when(Date.now())],
  ]);
}

// New-account alerts: poll Clerk every few minutes for users created after the
// stored watermark. Needs no Clerk dashboard webhook changes. On the very first
// run the watermark starts at "now", so existing accounts never trigger alerts.
export function startNewAccountAlerts(opts: {
  db: Database.Database;
  resend: Resend | null;
  listNewestUsers: () => Promise<ClerkUserLike[]>;
}) {
  const { db, resend, listNewestUsers } = opts;
  db.exec(`CREATE TABLE IF NOT EXISTS admin_alert_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS admin_alerts_sent (user_id TEXT PRIMARY KEY, sent_at INTEGER NOT NULL);`);
  const getMark = () => Number((db.prepare("SELECT value FROM admin_alert_state WHERE key='new_account_mark'").get() as any)?.value || 0);
  const setMark = (ms: number) => db.prepare("INSERT INTO admin_alert_state(key,value) VALUES('new_account_mark',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(ms));
  if (!getMark()) setMark(Date.now());

  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      const mark = getMark();
      const users = (await listNewestUsers()).filter((u) => u.createdAt > mark).sort((a, b) => a.createdAt - b.createdAt);
      for (const u of users) {
        const claimed = db.prepare("INSERT OR IGNORE INTO admin_alerts_sent(user_id,sent_at) VALUES(?,?)").run(u.id, Date.now()).changes > 0;
        if (claimed && emailOf(u) !== ADMIN_EMAIL) {
          await sendAdminAlert(resend, `New Remedy508 account: ${emailOf(u)}`, [
            ["Name", nameOf(u)],
            ["Email", emailOf(u)],
            ["Chose", intentLabel(u.unsafeMetadata?.signupIntent)],
            ["Created", when(u.createdAt)],
            ["Paid yet?", "Not yet. You'll get a separate email for a payment or trial start."],
          ]);
        }
        setMark(Math.max(getMark(), u.createdAt));
      }
    } catch (err: any) {
      console.error("[ALERT] New-account check failed:", err?.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(check, POLL_MS);
  timer.unref?.();
  setTimeout(check, 30_000).unref?.();
  return { check, stop: () => clearInterval(timer) };
}
