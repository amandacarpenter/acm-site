import SiteHeader from "@/components/SiteHeader";
import { Link } from "wouter";
import { CheckCircle2, Zap, Shield, Users } from "lucide-react";

const INDIVIDUAL_FEATURES = [
  "Unlimited document fixes",
  "Unlimited video transcriptions",
  "Canvas HTML fixer",
  "Alt text generator",
  "Priority processing",
  "Email support",
];

const INSTITUTION_FEATURES = [
  "Everything in Individual",
  "Unlimited users / seats",
  "Institution-wide admin dashboard",
  "Usage reporting & analytics",
  "Dedicated onboarding support",
  "Invoice & PO billing available",

];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Header */}
      <section className="bg-white border-b py-20 sm:py-24" aria-labelledby="pricing-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3a485b]/10 border border-[#3a485b]/20 text-sm font-medium text-[#3a485b] mb-8">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            Simple, transparent pricing
          </div>
          <h1 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-[#3a485b] mb-4">
            Simple, straightforward pricing.
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            For individual educators or entire institutions — pick the plan that fits.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 sm:py-24 bg-[#3a485b]" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">Pricing plans</h2>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

            {/* Individual — featured */}
            <div className="bg-[#0d9488] rounded-2xl p-8 shadow-2xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
              </div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">Individual</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$19</span>
                  <span className="text-white/70 mb-1">/month</span>
                </div>
                <p className="text-sm text-white/60">or $149/year — save 35%</p>
              </div>
              <Link href="/login">
                <span className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#0d9488] font-semibold text-sm hover:bg-gray-50 transition cursor-pointer mb-8 shadow-sm">
                  <Zap className="w-4 h-4" aria-hidden="true" />
                  Get Started
                </span>
              </Link>
              <ul className="space-y-3">
                {INDIVIDUAL_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white">
                    <CheckCircle2 className="w-4 h-4 text-white/80 shrink-0 mt-0.5" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Institution */}
            <div className="bg-white rounded-2xl border border-white/20 p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-[#3a485b] uppercase tracking-wide mb-2">Institution</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-[#3a485b]">Custom</span>
                </div>
                <p className="text-sm text-gray-400">Custom pricing — contact us</p>
              </div>
              <a href="mailto:hello@remedy508.ai">
                <span className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3a485b] text-white font-semibold text-sm hover:bg-[#2e3a4a] transition cursor-pointer mb-8">
                  <Users className="w-4 h-4" aria-hidden="true" />
                  Contact Us
                </span>
              </a>
              <ul className="space-y-3">
                {INSTITUTION_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ / Trust */}
      <section className="py-16 sm:py-20 bg-white" aria-labelledby="faq-heading">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 id="faq-heading" className="text-2xl font-bold text-[#3a485b] mb-8">Common questions</h2>
          <div className="space-y-6 text-left">
            {[
              { q: "Is there a free trial?", a: "We don't offer a free tier, but Individual plans can be cancelled anytime. Institution plans include a dedicated onboarding session so your team gets value from day one." },
              { q: "How is Institution pricing determined?", a: "Institution pricing is custom — contact us and we'll put together a quote based on your institution's size and needs." },
              { q: "Can I upgrade from Individual to Institution later?", a: "Yes. Contact us at any time and we'll transition your account and apply any remaining Individual subscription credit." },
              { q: "Is student data protected under FERPA?", a: "Yes. Remedy508 processes documents server-side and does not retain student data after processing. No PII is stored." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-100 pb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-gray-400">© 2026 Remedy508 — Left Coast Learning LLC</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
                <span className="text-xs text-gray-400">WCAG 2.1 AA Compliant</span>
              </div>
              <span className="text-xs text-gray-500">Not Accessible, Not Acceptable™</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
