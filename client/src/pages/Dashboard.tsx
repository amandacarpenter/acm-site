import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { CheckCircle2, Zap, CreditCard, Clock, ArrowRight, ShoppingCart, AlertTriangle } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import iconDocument from "@/assets/icon-document.png";
import iconComplexpdf from "@/assets/icon-complexpdf.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";
import BuyCreditsModal from "@/components/BuyCreditsModal";

const TOOLS = [
  { label: "Document Fixer", desc: "Word & PDF", icon: iconDocument, tab: "document" },
  { label: "Complex PDF", desc: "Scanned & complex PDFs", icon: iconComplexpdf, tab: "complexpdf" },
  { label: "Video Transcription", desc: "MP4, MOV, MP3", icon: iconVideo, tab: "video" },
  { label: "Canvas HTML Fixer", desc: "Canvas LMS", icon: iconCanvas, tab: "canvas" },
  { label: "Alt Text Generator", desc: "Images & charts", icon: iconAlttext, tab: "alttext" },
];

export default function Dashboard() {
  const { user } = useUser();
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const meta = (user?.publicMetadata || {}) as any;
  const plan: string = meta.plan || "individual";
  const teamSeats: number = meta.teamSeats || 1;
  const docsLimit: number = plan === "team" ? teamSeats * 75 : 50;
  const docsUsed: number = meta.monthlyDocsUsed || 0;
  const purchasedCredits: number = meta.purchasedCredits || 0;
  const usagePct = Math.min(100, Math.round((docsUsed / docsLimit) * 100));
  const isLow = usagePct >= 80;

  // Format reset date
  const resetDateStr = meta.usageResetDate
    ? new Date(meta.usageResetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : (() => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return next.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      })();

  const planLabel = plan === "team" ? `Team (${teamSeats} seat${teamSeats !== 1 ? "s" : ""})` : "Individual";
  const billingCycle = meta.subscribedAt
    ? new Date(meta.subscribedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src={logoUrl} alt="Remedy508" style={{ height: 40, width: "auto" }} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer">Tools</span>
            </Link>
            <Link href="/pricing">
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer">Plans</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#3a485b]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your account.</p>
        </div>

        {/* Top row — Usage + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Usage card */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-[#3a485b] text-sm">Document Usage</span>
              </div>
              <span className="text-xs text-gray-400">Resets {resetDateStr}</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#3a485b]">{docsUsed}</span>
              <span className="text-gray-400 text-sm mb-1">/ {docsLimit} docs this month</span>
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
                  <p className="text-xs text-amber-700 font-medium">
                    {docsLimit - docsUsed <= 0
                      ? "Monthly limit reached. Purchase credits to continue."
                      : `Only ${docsLimit - docsUsed} doc${docsLimit - docsUsed === 1 ? "" : "s"} remaining this month.`}
                  </p>
                </div>
                <button
                  onClick={() => setBuyCreditsOpen(true)}
                  className="ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition"
                >
                  <ShoppingCart className="w-3 h-3" />
                  Buy More Docs
                </button>
              </div>
            )}

            <p className="text-xs text-gray-400">{docsLimit - docsUsed > 0 ? docsLimit - docsUsed : 0} documents remaining — Document Fixer &amp; Complex PDF count toward this limit.</p>

            {/* Purchased credits balance */}
            {purchasedCredits > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-100 rounded-xl">
                <ShoppingCart className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                <p className="text-xs text-[#0d9488] font-medium">
                  {purchasedCredits} purchased credit{purchasedCredits !== 1 ? "s" : ""} available — used after your monthly pool runs out.
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
                <span className="text-xs text-gray-400">Active</span>
              )}
            </div>
            {billingCycle && (
              <p className="text-xs text-gray-400 mb-2">Member since {billingCycle}</p>
            )}
            <p className="text-xs text-gray-400 mb-4">{planLabel} · {docsLimit} docs/mo</p>

            <div className="mt-auto flex flex-col gap-2">
              <button
                onClick={() => setBuyCreditsOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#0d9488] text-[#0d9488] hover:bg-teal-50 transition"
              >
                <ShoppingCart className="w-3 h-3" />
                Buy More Docs
              </button>
              <Link href="/pricing">
                <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
                  Upgrade Plan <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick access tools */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#3a485b] mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TOOLS.map((tool) => (
              <Link key={tool.tab} href={`/tools/${tool.tab}`}>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-[#0d9488]/30 transition cursor-pointer group">
                  <div className="mb-3">
                    <img src={tool.icon} alt="" aria-hidden="true" className="w-10 h-10 object-contain" />
                  </div>
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight group-hover:text-[#0d9488] transition">{tool.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#3a485b]">Recent Activity</h2>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Files are not saved — download your results immediately after processing
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300 mt-1">Your processed files will appear here</p>
            </div>
          </div>
        </div>
      </main>

      <BuyCreditsModal open={buyCreditsOpen} onClose={() => setBuyCreditsOpen(false)} userId={user?.id} />

      <SiteFooter />
    </div>
  );
}
