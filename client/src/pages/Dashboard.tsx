import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { FileText, Video, Image, Code, FileSearch, CheckCircle2, Zap, CreditCard, Clock, ArrowRight, ShoppingCart, AlertTriangle, XCircle, LifeBuoy, Users } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import BuyCreditsModal from "@/components/BuyCreditsModal";

const TOOLS = [
  { label: "Remedy Docs", desc: "Word & PDF", icon: FileText, tab: "document", color: "bg-teal-50 text-[#0d9488]" },
  { label: "Remedy Video", desc: "MP4, MOV, MP3", icon: Video, tab: "video", color: "bg-purple-50 text-purple-600" },
  { label: "Remedy HTML", desc: "Canvas LMS", icon: Code, tab: "canvas", color: "bg-orange-50 text-orange-600" },
  { label: "Remedy Image", desc: "Images & charts", icon: Image, tab: "alttext", color: "bg-pink-50 text-pink-600" },
];

interface JobRow {
  id: number;
  type: string;
  status: string;
  inputName: string | null;
  pageCount: number | null;
  creditsUsed: number | null;
  createdAt: number;
}

interface UsageStatus {
  monthlyUsed: number;
  monthlyLimit: number;
  purchasedCredits: number;
  creditsRemaining: number;
  resetDate: string;
  plan: string;
  teamSeats: number;
  // Real team-purchased seat count (org-level), null for individual plans.
  // Distinct from teamSeats, which is always 1 (a per-member allotment
  // multiplier, not the team's actual size) -- use this for display.
  orgSeats?: number | null;
  billingRestricted?: boolean;
}

// Both "document" and "complexpdf" are internal job-type values written by the
// two remediation pipelines (still distinct server-side for routing/billing),
// but both now surface under the single public-facing "Remedy Docs" tool name.
const TOOL_LABELS: Record<string, string> = {
  document: "Remedy Docs",
  complexpdf: "Remedy Docs",
};

export default function Dashboard() {
  const { user } = useUser();
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    fetch(`/api/usage/status?clerkUserId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => setUsage(null))
      .finally(() => setLoadingUsage(false));

    fetch(`/api/jobs/recent?clerkUserId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [user?.id, buyCreditsOpen]);

  const meta = (user?.publicMetadata || {}) as any;
  const plan: string = usage?.plan || meta.plan || "individual";
  // `teamSeats` is always 1 for an individual member (their own credit-
  // allotment multiplier) -- it is NOT the team's real seat count, so it must
  // never be shown to the user labeled as "seats". Use `orgSeats` (the team's
  // actual purchased seat count) for anything user-facing.
  const teamSeats: number = usage?.teamSeats || meta.teamSeats || 1;
  const orgSeats: number | null = usage?.orgSeats ?? null;

  const monthlyLimit = usage?.monthlyLimit ?? (plan === "team" ? teamSeats * 175 : 150);
  const monthlyUsed = usage?.monthlyUsed ?? 0;
  const purchasedCredits = usage?.purchasedCredits ?? 0;
  const creditsRemaining = usage?.creditsRemaining ?? Math.max(0, monthlyLimit - monthlyUsed) + purchasedCredits;
  const usagePct = Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100));
  const isLow = usagePct >= 80;

  const resetDateStr = usage?.resetDate
    ? new Date(usage.resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : (() => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return next.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      })();

  const planLabel =
    plan === "team"
      ? orgSeats
        ? `Team (${orgSeats} seat${orgSeats !== 1 ? "s" : ""} total)`
        : "Team plan"
      : "Individual";
  const billingCycle = meta.subscribedAt
    ? new Date(meta.subscribedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#3a485b]">Dashboard</h1>
          <p className="text-gray-900 text-base mt-1">Here's what's happening with your account.</p>
        </div>

        {/* Fix #3/#6: team-wide payment-failure notice -- mirrors the banner on
            /team/setup so it's visible from the main Dashboard too, not just
            for admins who go looking at the team page. */}
        {usage?.billingRestricted && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 mb-8" role="alert">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-700">Payment issue — processing paused</p>
              <p className="text-sm text-red-600 mt-0.5">
                Your team's last payment couldn't be processed, so new document processing is paused for all members until your billing admin updates the payment method.
              </p>
            </div>
          </div>
        )}

        {/* Top row — Usage + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Usage card */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-[#3a485b] text-sm">Credit Usage</span>
              </div>
              <span className="text-sm text-gray-700">Resets {resetDateStr}</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#3a485b]">{loadingUsage ? "—" : monthlyUsed}</span>
              <span className="text-gray-900 text-base mb-1">/ {monthlyLimit} Credits this month</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
              <div
                className={`h-2.5 rounded-full transition-all ${isLow ? "bg-amber-500" : "bg-[#0d9488]"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>

            {/* Low usage warning + buy button */}
            {isLow && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    {monthlyLimit - monthlyUsed <= 0 && purchasedCredits <= 0
                      ? "Monthly Credits used up. Purchase more Credits to continue."
                      : `Only ${Math.max(0, monthlyLimit - monthlyUsed) + purchasedCredits} Credit${(Math.max(0, monthlyLimit - monthlyUsed) + purchasedCredits) === 1 ? "" : "s"} remaining this month.`}
                  </p>
                </div>
                <button
                  onClick={() => setBuyCreditsOpen(true)}
                  className="ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition"
                >
                  <ShoppingCart className="w-3 h-3" />
                  Buy More Credits
                </button>
              </div>
            )}

            <div className="pt-4 mt-1 border-t border-gray-100">
              <p className="text-sm font-semibold text-[#3a485b] mb-0.5">How are credits used?</p>
              <p className="text-xs text-gray-500 mb-3">Shared across all four tools.</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Docs</p>
                    <p className="text-xs text-gray-500 leading-tight">1 credit / page</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                    <Image className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Image</p>
                    <p className="text-xs text-gray-500 leading-tight">1 credit / image</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Video</p>
                    <p className="text-xs text-gray-500 leading-tight">1 credit / transcript</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <Code className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy HTML</p>
                    <p className="text-xs text-gray-500 leading-tight">3 credits / fix</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchased credits balance */}
            {purchasedCredits > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-100 rounded-xl">
                <ShoppingCart className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                <p className="text-sm text-[#0d9488] font-medium">
                  {purchasedCredits} purchased Credit{purchasedCredits !== 1 ? "s" : ""} available — used after your monthly pool runs out.
                </p>
              </div>
            )}
          </div>

          {/* Plan card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-[#0d9488]" />
              <span className="font-semibold text-[#3a485b] text-sm">Your Plan</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0d9488] text-white">
                {plan === "team" ? "Team" : "Individual"}
              </span>
              {meta.stripeCustomerId && (
                <span className="text-sm text-gray-700">Active</span>
              )}
            </div>
            {billingCycle && (
              <p className="text-sm text-gray-700 mb-2">Member since {billingCycle}</p>
            )}
            <p className="text-sm text-gray-700 mb-4">{planLabel} · {monthlyLimit} Credits/mo</p>

            <div className="mt-auto flex flex-col gap-2">
              {plan === "team" && (
                <Link href="/team/setup">
                  <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#3a485b] text-white hover:bg-[#2d3847] transition cursor-pointer">
                    <Users className="w-3 h-3" />
                    Team Dashboard
                  </span>
                </Link>
              )}
              <button
                onClick={() => setBuyCreditsOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#0d9488] text-[#0d9488] hover:bg-teal-50 transition"
              >
                <ShoppingCart className="w-3 h-3" />
                Buy More Credits
              </button>
              {meta.stripeCustomerId ? (
                <button
                  disabled={portalLoading}
                  onClick={async () => {
                    if (!user?.id) return;
                    setPortalLoading(true);
                    try {
                      const resp = await fetch("/api/stripe/create-portal-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clerkUserId: user.id }),
                      });
                      const data = await resp.json();
                      if (data.url) {
                        window.location.href = data.url;
                      } else {
                        setPortalLoading(false);
                      }
                    } catch {
                      setPortalLoading(false);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition disabled:opacity-60"
                >
                  {portalLoading ? "Loading…" : "Manage Plan"} <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <Link href="/pricing">
                  <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
                    Upgrade Plan <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              )}
              {plan === "individual" && meta.stripeCustomerId && (
                <Link href="/pricing">
                  <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#3a485b] text-[#3a485b] hover:bg-gray-50 transition cursor-pointer">
                    <Users className="w-3 h-3" />
                    Upgrade to Team
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tools CTA */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Link href="/tools">
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:brightness-110 transition shadow-sm">
              <Zap className="w-4 h-4" />
              Access the Tools
            </button>
          </Link>
          <Link href="/contact">
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d63b1f] text-white font-semibold text-sm hover:brightness-110 transition shadow-sm">
              <LifeBuoy className="w-4 h-4" />
              Support &amp; Help
            </button>
          </Link>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#3a485b]">Recent Activity</h2>
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Files are not saved — download your results immediately after processing
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingJobs ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <p className="text-sm text-gray-600">Loading activity...</p>
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <FileText className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-700">No activity yet</p>
                <p className="text-sm text-gray-600 mt-1">Your processed files will appear here</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#3a485b] truncate">
                          {job.inputName || "Untitled document"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {TOOL_LABELS[job.type] || job.type}
                          {job.pageCount ? ` · ${job.pageCount} page${job.pageCount === 1 ? "" : "s"}` : ""}
                          {job.creditsUsed ? ` · ${job.creditsUsed} credit${job.creditsUsed === 1 ? "" : "s"} used` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0 ml-3">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <BuyCreditsModal open={buyCreditsOpen} onClose={() => setBuyCreditsOpen(false)} userId={user?.id} />

      <SiteFooter />
    </div>
  );
}
