import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLocation, useSearch } from "wouter";
import { FileText, Image, Video, Code, Presentation } from "lucide-react";
import PricingPlans from "@/components/PricingPlans";
import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import TrialPlanCard from "@/components/TrialPlanCard";

const PRICE_MONTHLY = "price_1U0nJxAaDElV6hZxPUcTnm6i"; // $19/mo
const PRICE_ANNUAL  = "price_1U0nK2AaDElV6hZxv9vmPBz4"; // $199/yr

export default function PricingPage() {
  useDocumentTitle("PDF & Document Remediation Pricing | Remedy508");
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const search = useSearch();
  const autoCheckoutStarted = useRef(false);
  const [autoRedirecting, setAutoRedirecting] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(search).get("trial") === "1") {
      document.getElementById("free-trial")?.scrollIntoView({block: "start"});
    }
  }, [search]);
  const [, navigate] = useLocation();

  async function startCheckout(billing: "monthly" | "annual") {
    const priceId = billing === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;
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

  async function handleGetStarted() {
    if (!isSignedIn) {
      // Create the account first, then continue straight to payment for this plan.
      navigate(`/signup?plan=${annual ? "annual" : "monthly"}`);
      return;
    }
    await startCheckout(annual ? "annual" : "monthly");
  }

  // Arriving from sign-up / log-in with a chosen plan (?checkout=monthly|annual):
  // go straight to Stripe instead of asking them to pick the plan again.
  useEffect(() => {
    const checkout = new URLSearchParams(search).get("checkout");
    if (checkout !== "monthly" && checkout !== "annual") return;
    if (!isSignedIn || !userLoaded || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    if ((user?.publicMetadata as any)?.subscribed === true) {
      navigate("/dashboard");
      return;
    }
    setAnnual(checkout === "annual");
    setAutoRedirecting(true);
    startCheckout(checkout).finally(() => setAutoRedirecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isSignedIn, userLoaded]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main>
        {autoRedirecting && (
          <div role="status" className="bg-[#0f766e] text-white text-center text-sm font-medium px-4 py-3">
            Your account is ready. Taking you to secure checkout…
          </div>
        )}

      <PricingPlans annual={annual} setAnnual={setAnnual} loading={loading} onGetStarted={handleGetStarted} trialCard={<TrialPlanCard />} />

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
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
                          <Presentation className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Layout</p>
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">Coming Soon</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-tight">Presentations & Flyers · 1 credit / page</p>
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
