import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Zap, Users, Loader2, Building2, FileText, Image, Video, Code, Presentation } from "lucide-react";
import HeroWatermark from "@/components/HeroWatermark";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useDocumentTitle } from "@/hooks/use-document-title";

const PRICE_MONTHLY = "price_1U0nJxAaDElV6hZxPUcTnm6i"; // $19/mo
const PRICE_ANNUAL  = "price_1U0nK2AaDElV6hZxv9vmPBz4"; // $199/yr

const INDIVIDUAL_FEATURES = [
  "Free Accessibility Checker (no Credits required)",
  "Remedy Docs (Word & PDF)",
  "Remedy Image",
  "Remedy HTML",
  "Remedy Video",
  "Remedy Layout (Coming Soon)",
  "Email support",
  "Cancel anytime",
];

const TEAM_FEATURES = [
  "Free Accessibility Checker (no Credits required)",
  "Everything in Individual",
  "Admin dashboard for your team",
  "Invite by link or email",
  "Per-user document history",
  "Priority email support",
  "Pay by credit card or invoice/PO",
  "Annual plan (paid in full upfront, not refundable)",
];

export default function PricingPage() {
  useDocumentTitle("PDF & Document Remediation Pricing | Remedy508");
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
      <main>

      {/* Header */}
      <section className="relative overflow-hidden bg-[#3a485b] py-20 sm:py-24" aria-labelledby="pricing-heading">
        <HeroWatermark corner="right" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-8">
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            No hidden fees. No surprises.
          </div>
          <h1 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Accessibility shouldn't{" "}
            <span className="text-white">break the budget.</span>
          </h1>
          <p className="text-lg text-white max-w-xl mx-auto mb-10">
            Simple pricing for PDF and document accessibility remediation software, with plans for individuals and teams.
          </p>
        </div>
      </section>

      {/* Two-card grid */}
      <section className="py-16 sm:py-24 bg-gray-50" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">Pricing plans</h2>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

            {/* Individual card */}
            <div className="rounded-2xl bg-white border-2 border-[#0f766e] shadow-lg relative flex flex-col overflow-hidden">
              {/* Teal top bar */}
              <div className="h-1.5 w-full bg-[#0f766e]" />

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-2xl font-bold text-[#3a485b]">Individual</p>
                    {/* Monthly / Annual toggle — Individual only */}
                    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-1.5 py-1">
                      <button
                        onClick={() => setAnnual(false)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                          !annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-600"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setAnnual(true)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                          annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-600"
                        }`}
                      >
                        Annual <span className="text-[#0f766e]">−13%</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-[#3a485b]">
                      {annual ? "$17" : "$19"}
                    </span>
                    <span className="mb-2 text-base text-gray-900">/mo</span>
                  </div>
                  {annual ? (
                    <p className="text-base text-gray-900">$199/year — paid in full upfront, not refundable</p>
                  ) : (
                    <p className="text-base text-gray-900">or $199/yr — save 13%</p>
                  )}
                </div>

                <p className="text-base leading-relaxed mb-6 text-gray-900">
                  One seat. Every available tool uses one shared Credit pool, and Remedy Layout will join it when it launches. Built for anyone who needs to make course materials accessible on their own.
                </p>

                <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-1.5 mb-1 w-fit bg-[#0f766e]/10 text-[#0f766e]">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  130 Credits / month
                </div>
                <p className="text-sm mb-6 pl-1 text-gray-900">Individual use only — one seat per account</p>

                <ul className="space-y-3 mb-8">
                  {INDIVIDUAL_FEATURES.filter((f) => !(annual && f === "Cancel anytime")).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-base text-gray-900">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0f766e]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <button
                    onClick={handleGetStarted}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-[#0f766e] text-white hover:bg-[#115e59] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</> : "Get Started →"}
                  </button>
                </div>
              </div>
            </div>

            {/* Team card */}
            <div className="rounded-2xl bg-[#3a485b] border-2 border-[#3a485b] shadow-lg relative flex flex-col overflow-hidden">
              <div className="h-1.5 w-full bg-[#0f766e]" />

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-4">Team</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-white">$249</span>
                    <span className="mb-2 text-base text-white">/seat/yr</span>
                  </div>
                  <p className="text-base text-white">Annual only · 2+ seats · paid in full upfront, not refundable</p>
                </div>

                <p className="text-base leading-relaxed mb-6 text-white">
                  Built for accessibility teams, colleges, universities, government agencies, and healthcare organizations.
                </p>

                <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-1.5 mb-1 w-fit bg-white/10 text-white">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  145 Credits / month per seat
                </div>
                <p className="text-sm mb-6 pl-1 text-white">2+ seats — annual plan · each teammate gets their own 145/month, not shared</p>

                <ul className="space-y-3 mb-8">
                  {TEAM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-base text-white">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0f766e]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link href="/team">
                    <span className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-white text-[#3a485b] hover:bg-gray-100">
                      Choose Seat Count →
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
              { q: "What is the Free Accessibility Checker?", a: "It is a browser-based document check for common accessibility barriers. It is free, requires no account, and uses no Credits. Document contents are not uploaded or saved; the filename and basic check metadata are retained for internal usage reporting for up to 90 days." },
              {
                q: "What is a Credit?",
                a: (
                  <>
                    <p className="mb-3">
                      Credits are the usage currency across every available tool, weighted by how much processing each one takes. Remedy Layout will join the same pool when it launches. Credits reset monthly on the anniversary of your signup date. Need more Credits? You can top up with a Credit pack anytime.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Docs</p>
                          <p className="text-xs text-gray-500 leading-tight">1 credit / page</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Image className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Image</p>
                          <p className="text-xs text-gray-500 leading-tight">1 credit / image</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Video className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Video</p>
                          <p className="text-xs text-gray-500 leading-tight">1 credit / transcript</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Code className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy HTML</p>
                          <p className="text-xs text-gray-500 leading-tight">3 credits / fix</p>
                        </div>
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Presentation className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Layout</p>
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">Coming Soon</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-tight">Presentations & Flyers · Planned: 1 credit / page</p>
                        </div>
                      </div>
                    </div>
                  </>
                ),
              },
              { q: "Can I cancel my plan?", a: "Monthly plans can be cancelled anytime — you won't be billed again. Annual plans are paid in full upfront and are not refundable, but you can cancel before your renewal date to stop future charges. Your access continues until the end of the paid period." },
              { q: "Why can't institutions use the Individual plan?", a: "The Individual plan is licensed for single-user personal use only. Institutional use — meaning multiple staff, departments, or campus-wide access — costs about the same per Credit either way, so a Team plan is the better fit: it adds an admin dashboard and its own Credit allotment for each teammate." },
              { q: "How does the Team plan work?", a: "Team plans are $249/seat/year, billed annually. Each teammate gets their own 145 Credits/month — it's not a shared pool. You get an admin dashboard to manage members, invite by link or email, and can pay by credit card or invoice/PO. Minimum 2 seats." },
              { q: "Is my data secure?", a: "Yes. Documents are processed in memory and not retained after your result is returned. We do not store copies of your uploaded files." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-200 pb-6">
                <h3 className="font-bold text-gray-900 mb-2 text-base">{q}</h3>
                <div className="text-base text-gray-900 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
