import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Zap, Users, Loader2, Building2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const PRICE_MONTHLY = "price_1Thc2tAaDElV6hZxMwA0Wxgk";
const PRICE_ANNUAL  = "price_1Thc2sAaDElV6hZx3M4Ua1kM";

const INDIVIDUAL_FEATURES = [
  "Document Fixer (Word & PDF)",
  "Complex PDF tool",
  "Alt Text Generator",
  "Canvas HTML Fixer",
  "Video Transcription",
  "Email support",
  "Cancel anytime",
];

const TEAM_FEATURES = [
  "Everything in Individual",
  "Admin dashboard for your team",
  "Invite by link or email",
  "Per-user document history",
  "Priority email support",
  "Pay by credit card or invoice/PO",
  "Annual plan (non-refundable)",
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isSignedIn, userId } = useAuth();
  const [, navigate] = useLocation();

  async function handleGetStarted() {
    if (!isSignedIn) {
      navigate("/signup");
      return;
    }
    const priceId = annual ? PRICE_ANNUAL : PRICE_MONTHLY;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, clerkUserId: userId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Header */}
      <section className="bg-[#3a485b] py-20 sm:py-24" aria-labelledby="pricing-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-8">
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            No hidden fees. No surprises.
          </div>
          <h1 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Accessibility shouldn't{" "}
            <span className="text-white">break the budget.</span>
          </h1>
          <p className="text-lg text-white max-w-xl mx-auto mb-10">
            Simple pricing for individuals and teams.
          </p>
        </div>
      </section>

      {/* Two-card grid */}
      <section className="py-16 sm:py-24 bg-gray-50" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">Pricing plans</h2>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

            {/* Individual card */}
            <div className="rounded-2xl bg-white border-2 border-[#0d9488] shadow-lg relative flex flex-col overflow-hidden">
              {/* Teal top bar */}
              <div className="h-1.5 w-full bg-[#0d9488]" />

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-2xl font-bold text-[#3a485b]">Individual</p>
                    {/* Monthly / Annual toggle — Individual only */}
                    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-1.5 py-1">
                      <button
                        onClick={() => setAnnual(false)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          !annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-400"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setAnnual(true)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-400"
                        }`}
                      >
                        Annual <span className="text-[#0d9488]">−35%</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-[#3a485b]">
                      {annual ? "$12" : "$19"}
                    </span>
                    <span className="mb-2 text-sm text-gray-400">/mo</span>
                  </div>
                  {annual ? (
                    <p className="text-sm text-gray-400">$149/year — billed annually, non-refundable</p>
                  ) : (
                    <p className="text-sm text-gray-400">or $149/yr — save 35%</p>
                  )}
                </div>

                <p className="text-sm leading-relaxed mb-6 text-gray-500">
                  One seat. All five tools. Built for anyone who needs to make course materials accessible on their own.
                </p>

                <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-1.5 mb-1 w-fit bg-[#0d9488]/10 text-[#0d9488]">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  50 documents / month
                </div>
                <p className="text-xs mb-6 pl-1 text-gray-400">Individual use only — one seat per account</p>

                <ul className="space-y-3 mb-8">
                  {INDIVIDUAL_FEATURES.filter((f) => !(annual && f === "Cancel anytime")).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0d9488]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <button
                    onClick={handleGetStarted}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</> : "Get Started"}
                  </button>
                </div>
              </div>
            </div>

            {/* Team card */}
            <div className="rounded-2xl bg-[#3a485b] border-2 border-[#3a485b] shadow-lg relative flex flex-col overflow-hidden">
              <div className="h-1.5 w-full bg-[#0d9488]" />

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-4">Team</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-white">$149</span>
                    <span className="mb-2 text-sm text-white/50">/seat/yr</span>
                  </div>
                  <p className="text-sm text-white/50">Annual only · 2+ seats · non-refundable</p>
                </div>

                <p className="text-sm leading-relaxed mb-6 text-white/70">
                  Built for accessibility teams, colleges, universities, government agencies, and healthcare organizations.
                </p>

                <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-1.5 mb-1 w-fit bg-white/10 text-white">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  75 documents / month per seat, pooled
                </div>
                <p className="text-xs mb-6 pl-1 text-white/40">2+ seats — annual plan</p>

                <ul className="space-y-3 mb-8">
                  {TEAM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0d9488]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link href="/team">
                    <span className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-white text-[#3a485b] hover:bg-gray-100">
                      Choose seats →
                    </span>
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-white border-t" aria-labelledby="faq-heading">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 id="faq-heading" className="text-2xl font-bold text-[#3a485b] mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "What counts toward my 50-document limit?", a: "Each file you upload and process counts as one document, regardless of page count. The 50-document limit applies to Document Fixer and Complex PDF combined. Alt Text Generator, Canvas HTML Fixer, and Video Transcription are unlimited on the Individual plan." },
              { q: "Can I cancel my plan?", a: "Monthly plans can be cancelled anytime — you won't be billed again. Annual plans are billed upfront and are non-refundable, but you can cancel before your renewal date to stop future charges. Your access continues until the end of the paid period." },
              { q: "Why can't institutions use the Individual plan?", a: "The Individual plan is licensed for single-user personal use only. Institutional use — meaning multiple staff, departments, or campus-wide access — requires a Team plan. Accounts found in violation may be suspended." },
              { q: "How does the Team plan work?", a: "Team plans are $149/seat/year, billed annually. Documents are pooled across your team at 75/seat/month. You get an admin dashboard to manage members, invite by link or email, and can pay by credit card or invoice/PO. Minimum 2 seats." },
              { q: "Is my data secure?", a: "Yes. Documents are processed in memory and not retained after your result is returned. We do not store copies of your uploaded files." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
