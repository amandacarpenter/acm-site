import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { CheckCircle2, Zap, Users, ArrowRight } from "lucide-react";
import { useState } from "react";

const INDIVIDUAL_PLANS = [
  {
    name: "Starter",
    monthly: 9,
    annual: 79,
    annualSavings: "save 27%",
    description: "For faculty who occasionally need to remediate course materials.",
    limit: "15 documents / month",
    features: [
      "Document Fixer (Word & PDF)",
      "Alt Text Generator",
      "Canvas HTML Fixer",
      "Video Transcription",
      "Email support",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: 19,
    annual: 149,
    annualSavings: "save 35%",
    description: "For instructional designers and regular accessibility work.",
    limit: "50 documents / month",
    features: [
      "Everything in Starter",
      "Complex PDF tool",
      "Priority processing",
      "Email support",
    ],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Unlimited",
    monthly: 29,
    annual: 229,
    annualSavings: "save 34%",
    description: "For power users running large backlogs or full course libraries.",
    limit: "Unlimited documents",
    features: [
      "Everything in Pro",
      "Unlimited processing",
      "Priority support",
    ],
    cta: "Get Started",
    highlight: false,
  },
];

const INSTITUTION_FEATURES = [
  "Unlimited users and seats",
  "Unlimited document processing",
  "All five tools included",
  "Institution-wide admin dashboard",
  "Usage reporting and analytics",
  "Dedicated onboarding support",
  "Invoice and PO billing available",
  "FERPA documentation on request",
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Header */}
      <section className="bg-white border-b py-20 sm:py-24" aria-labelledby="pricing-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/20 text-sm font-medium text-[#0d9488] mb-8">
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            No hidden fees. No surprises.
          </div>
          <h1 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-[#3a485b] mb-4">
            Accessibility shouldn't{" "}
            <span className="text-[#0d9488]">break the budget.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
            For individual educators or entire institutions — pick the plan that fits.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full px-2 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                !annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-400"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                annual ? "bg-white text-[#3a485b] shadow-sm" : "text-gray-400"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs font-bold text-[#0d9488]">Save up to 35%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Individual plans */}
      <section className="py-16 sm:py-20 bg-gray-50 border-b" aria-labelledby="individual-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 id="individual-heading" className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-10">
            Individual Plans
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            {INDIVIDUAL_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 relative flex flex-col ${
                  plan.highlight
                    ? "bg-[#0d9488] shadow-xl scale-[1.03]"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[#3a485b] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.highlight ? "text-white/70" : "text-gray-400"}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-4xl font-bold ${plan.highlight ? "text-white" : "text-[#3a485b]"}`}>
                      ${annual ? Math.round(plan.annual / 12) : plan.monthly}
                    </span>
                    <span className={`mb-1 text-sm ${plan.highlight ? "text-white/70" : "text-gray-400"}`}>/mo</span>
                  </div>
                  {annual ? (
                    <p className={`text-xs ${plan.highlight ? "text-white/60" : "text-gray-400"}`}>
                      ${plan.annual}/year — {plan.annualSavings}
                    </p>
                  ) : (
                    <p className={`text-xs ${plan.highlight ? "text-white/60" : "text-gray-400"}`}>
                      or ${plan.annual}/yr — {plan.annualSavings}
                    </p>
                  )}
                </div>

                <p className={`text-xs leading-relaxed mb-4 ${plan.highlight ? "text-white/80" : "text-gray-500"}`}>
                  {plan.description}
                </p>

                {/* Doc limit badge */}
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 mb-2 w-fit ${
                  plan.highlight ? "bg-white/20 text-white" : "bg-[#0d9488]/10 text-[#0d9488]"
                }`}>
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  {plan.limit}
                </div>
                <p className={`text-xs mb-5 pl-1 ${plan.highlight ? "text-white/50" : "text-gray-400"}`}>
                  Document Fixer &amp; Complex PDF only — all other tools unlimited
                </p>

                <Link href="/signup">
                  <span className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer mb-6 ${
                    plan.highlight
                      ? "bg-white text-[#0d9488] hover:bg-gray-50 shadow-sm"
                      : "bg-[#0d9488] text-white hover:bg-[#0f766e]"
                  }`}>
                    {plan.cta}
                  </span>
                </Link>

                <ul className="space-y-2.5 mt-auto">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-xs ${plan.highlight ? "text-white" : "text-gray-600"}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.highlight ? "text-white/80" : "text-[#0d9488]"}`} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institution */}
      <section className="py-16 sm:py-20 bg-white" aria-labelledby="institution-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border-2 border-[#3a485b] overflow-hidden">
            <div className="bg-[#3a485b] px-8 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Institution</p>
                <h2 id="institution-heading" className="text-3xl font-bold text-white mb-1">
                  Starting at $299<span className="text-lg font-normal text-white/60">/mo</span>
                </h2>
                <p className="text-white/60 text-sm">Custom pricing based on your institution's size and needs.</p>
              </div>
              <a href="mailto:hello@remedy508.com" className="shrink-0">
                <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition cursor-pointer whitespace-nowrap">
                  <Users className="w-4 h-4" aria-hidden="true" />
                  Contact Us
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </a>
            </div>
            <div className="bg-white px-8 py-8">
              <p className="text-sm font-semibold text-[#3a485b] mb-5">Everything in Unlimited, plus:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {INSTITUTION_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" aria-hidden="true" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-gray-50 border-t" aria-labelledby="faq-heading">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 id="faq-heading" className="text-2xl font-bold text-[#3a485b] mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "What counts toward my monthly document limit?", a: "Only Document Fixer and Complex PDF uploads count toward your monthly limit. Video Transcription, Canvas HTML Fixer, and Alt Text Generator are unlimited on all plans. Each file upload counts as one document regardless of page count." },
              { q: "Is there a free trial?", a: "Individual plans can be cancelled anytime — no long-term commitment. Institution plans include a dedicated onboarding session so your team gets value from day one." },
              { q: "Can I upgrade plans?", a: "Yes, upgrade at any time. If you move from an Individual plan to Institution, we'll apply any remaining subscription credit to your new plan." },
              { q: "How is Institution pricing determined?", a: "Institution pricing starts at $299/mo and scales based on your institution's size and needs. Contact us for a custom quote." },
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
