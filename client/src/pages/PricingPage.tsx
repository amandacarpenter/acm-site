import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { CheckCircle2, Zap, Users, Loader2 } from "lucide-react";
import { useState } from "react";

const PRICE_MONTHLY = "price_1TZdtqA48KphfHO56kqO3qQP";
const PRICE_ANNUAL  = "price_1TZduPA48KphfHO54HGBEFMC";

async function startCheckout(priceId: string, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const res = await fetch("https://acm-site-production.up.railway.app/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
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

const INDIVIDUAL_FEATURES = [
  "Document Fixer (Word & PDF)",
  "Complex PDF tool",
  "Alt Text Generator",
  "Canvas HTML Fixer",
  "Video Transcription",
  "Email support",
  "Cancel anytime",
];

const INSTITUTION_FEATURES = [
  "Everything in Individual",
  "Unlimited users and seats",
  "Campus-wide access for all staff and faculty",
  "Dedicated onboarding support",
  "Invoice and PO billing available",
  "Usage & activity reporting",
  "Priority support",
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);

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
            <span className="text-[#0d9488]">break the budget.</span>
          </h1>
          <p className="text-lg text-white max-w-xl mx-auto mb-10">
            One simple plan for individuals. Custom pricing for institutions.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-white/10 rounded-full px-2 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                !annual ? "bg-white text-[#3a485b] shadow-sm" : "text-white/60"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                annual ? "bg-white text-[#3a485b] shadow-sm" : "text-white/60"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs font-bold text-white">Save 35%</span>
            </button>
          </div>
          {annual && (
            <p className="text-sm text-white/70 mt-3">Annual plans are billed upfront and non-refundable. Cancel before renewal to stop future charges.</p>
          )}
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
                  <p className="text-2xl font-bold text-[#3a485b] mb-4">
                    Individual
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-[#3a485b]">
                      {annual ? "$12" : "$19"}
                    </span>
                    <span className="mb-2 text-sm text-gray-400">/mo</span>
                  </div>
                  {annual ? (
                    <p className="text-sm text-gray-400">$149/year — save 35%</p>
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
                    onClick={() => startCheckout(annual ? PRICE_ANNUAL : PRICE_MONTHLY, setLoading)}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</> : "Get Started"}
                  </button>
                </div>
              </div>
            </div>

            {/* Institution card */}
            <div className="rounded-2xl bg-[#3a485b] border-2 border-[#3a485b] shadow-lg relative flex flex-col overflow-hidden">
              {/* Navy top bar */}
              <div className="h-1.5 w-full bg-[#0d9488]" />

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="text-2xl font-bold text-white mb-4">
                    Institution
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-white">Custom</span>
                  </div>
                  <p className="text-sm text-white/50">Starting at $299/mo</p>
                </div>

                <p className="text-sm leading-relaxed mb-6 text-white/70">
                  Campus-wide coverage with a custom contract, dedicated onboarding, and invoicing built for procurement.
                </p>

                <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-4 py-1.5 mb-6 w-fit bg-white/10 text-white">
                  <Users className="w-4 h-4" aria-hidden="true" />
                  Unlimited users &amp; documents
                </div>

                <ul className="space-y-3 mb-8">
                  {INSTITUTION_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0d9488]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link href="/contact">
                    <span className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition cursor-pointer bg-white text-[#3a485b] hover:bg-gray-100">
                      Get a Quote
                    </span>
                  </Link>
                  <p className="text-xs text-white/40 text-center mt-3">We'll respond within one business day.</p>
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
              { q: "Why can't institutions use the Individual plan?", a: "The Individual plan is licensed for single-user personal use only. Institutional use — meaning multiple staff, departments, or campus-wide access — requires an Institution plan. Accounts found in violation may be suspended." },
              { q: "How is Institution pricing determined?", a: "Institution pricing starts at $299/mo and scales based on your institution's size, number of users, and volume. Contact us at hello@remedy508.com for a custom quote. We support invoice and PO billing." },
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
