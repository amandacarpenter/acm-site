import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import HeroWatermark from "@/components/HeroWatermark";
import "./PricingPlans.css";
import type { ReactNode } from "react";

type PricingPlansProps = {
  annual: boolean;
  setAnnual: (annual: boolean) => void;
  loading: boolean;
  onGetStarted: () => void;
  trialCard?: ReactNode;
};

export default function PricingPlans({ annual, setAnnual, loading, onGetStarted, trialCard }: PricingPlansProps) {
  return (
    <div className="pricing-design">
      <section className="pricing-hero" aria-labelledby="pricing-heading">
        <HeroWatermark corner="right" className="pricing-watermark" />
        <div className="pricing-hero-copy">
          <span className="pricing-hero-pill">Plans &amp; Pricing</span>
          <h1 id="pricing-heading">Choose your plan</h1>
          <p>Accessible content, whether you work on your own or with a team.</p>
        </div>
      </section>
      <section className="pricing-plans-section" aria-label="Compare Free Trial, Individual and Team plans">
        <div className={`pricing-plans${trialCard ? " has-trial" : ""}`}>
          {trialCard}
          <article className="pricing-plan" aria-labelledby="individual-title">
            <div className="pricing-plan-intro">
              <h2 id="individual-title">Individual</h2>
              <p>For one person’s own work.</p>
            </div>
            <div className="pricing-billing" role="group" aria-label="Individual billing frequency">
              <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)} disabled={loading}>Monthly</button>
              <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)} disabled={loading}>Annual <span>Save $29</span></button>
            </div>
            <div className="pricing-price-area" aria-live="polite" aria-atomic="true">
              <p className="pricing-price"><span>{annual ? "$199" : "$19"}</span><span className="pricing-unit">{annual ? "/year" : "/month"}</span></p>
              <p className="pricing-price-caption">
                {annual ? "Save $29 compared with 12 monthly payments." : <>Or <strong>$199/year</strong> with annual billing.</>}
              </p>
            </div>
            <div className="pricing-allowance">
              <strong>130 Credits</strong>
              <span>Credits can be used across all tools and are renewed on a monthly basis.</span>
            </div>
            <ul className="pricing-benefits">
              <li>One account for personal, individual use</li>
              <li>All four available Remedy tools</li>
              <li>Email support</li>
            </ul>
            <button type="button" className="pricing-choose" onClick={onGetStarted} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Redirecting…</> : <>Choose Individual <span aria-hidden="true">→</span></>}
            </button>
            <p className="pricing-terms">{annual ? "Paid annually in full upfront. Annual payments are nonrefundable." : "Monthly billing. Cancel anytime to stop future charges."}</p>
          </article>
          <article className="pricing-plan" aria-labelledby="team-title">
            <div className="pricing-plan-intro">
              <h2 id="team-title">Team</h2>
              <p>For institutions and teams of two or more.</p>
            </div>
            <div className="pricing-team-billing">Annual billing <span aria-hidden="true">·</span> Minimum 2 people</div>
            <div className="pricing-price-area">
              <p className="pricing-price"><span>$249</span><span className="pricing-unit">/person/year</span></p>
              <p className="pricing-price-caption">Starts at <strong>$498/year</strong> for 2 people.</p>
            </div>
            <div className="pricing-allowance">
              <strong>145 Credits <small>per person</small></strong>
              <span>Credits can be used across all tools and are renewed on a monthly basis.</span>
            </div>
            <ul className="pricing-benefits">
              <li>Team admin dashboard; Credits are not shared</li>
              <li>Member invitations and per-user history</li>
              <li>Priority email support; credit card or invoice/PO</li>
            </ul>
            <Link href="/team" className="pricing-choose">Choose Team <span aria-hidden="true">→</span></Link>
            <p className="pricing-terms">Paid annually in full upfront. Annual payments are nonrefundable.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
