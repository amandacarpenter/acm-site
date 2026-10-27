import { useState } from "react";
import { Link } from "wouter";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFreeTrial } from "@/hooks/use-free-trial";
import { FREE_TRIAL_CREDITS, FREE_TRIAL_DAYS, type FreeTrialStatus } from "@shared/trial";

export default function TrialPlanCard() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { openUserProfile } = useClerk();
  const trial = useFreeTrial();
  const cache = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const data = trial.data;
  const ended = data?.state === "expired" || data?.state === "exhausted";

  async function start() {
    setError(""); setStarting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/free-trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ acceptTerms: accepted }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn't start your trial. Please try again.");
      cache.setQueryData<FreeTrialStatus>(["free-trial", userId], result);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setStarting(false); }
  }

  return <article id="free-trial" className="pricing-plan pricing-trial-plan" aria-labelledby="trial-title">
    <div className="pricing-plan-intro">
      <h2 id="trial-title">Free Trial</h2>
      <p>Try the tools before choosing a paid plan.</p>
    </div>
    <div className="pricing-team-billing">One-time trial <span aria-hidden="true">·</span> {FREE_TRIAL_DAYS} days</div>
    <div className="pricing-price-area">
      <p className="pricing-price"><span>$0</span><span className="pricing-unit">for 14 days</span></p>
      <p className="pricing-price-caption">No credit card. No automatic charge.</p>
    </div>
    <div className="pricing-allowance">
      <strong>{FREE_TRIAL_CREDITS} Credits</strong>
      <span>Use across all four tools. One-time allowance, with no monthly refill.</span>
    </div>
    <ul className="pricing-benefits">
      <li>All four available Remedy tools</li>
      <li>Ends after 14 days or when Credits run out</li>
      <li>Choose a paid plan whenever you're ready</li>
    </ul>
    <div className="pricing-trial-actions">
      {!isLoaded || (isSignedIn && trial.isLoading) ? <p role="status">Checking your account…</p> : !isSignedIn ? <>
        <Link href="/signup?trial=1" className="pricing-choose" data-testid="pricing-free-trial">Start Free Trial <span aria-hidden="true">→</span></Link>
        <p className="pricing-trial-secondary">Already have an account? <Link href="/login?trial=1">Log in</Link>.</p>
      </> : trial.isError ? <>
        <p role="alert">{trial.error.message}</p>
        <button className="pricing-choose" onClick={() => trial.refetch()}>Try again</button>
      </> : data?.state === "eligible" ? <>
        <label className="pricing-trial-consent">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>I agree to the <Link href="/terms">Terms of Service</Link> and the one-time 14-day trial with 30 Credits. Unused Credits expire. No automatic charge.</span>
        </label>
        <button className="pricing-choose" disabled={!accepted || starting} onClick={start}>
          {starting ? "Starting your trial…" : "Start Free Trial"} <span aria-hidden="true">→</span>
        </button>
      </> : data?.state === "verification_required" ? <>
        <p role="status" className="pricing-trial-status">{data.message}</p>
        <button className="pricing-choose" onClick={() => openUserProfile()}>Verify your email</button>
        <button className="pricing-trial-recheck" onClick={() => trial.refetch()}>I've verified my email. Check again.</button>
      </> : data?.state === "active" ? <>
        <p className="pricing-trial-status" role="status">
          <strong>{data.remaining} Credits remaining.</strong> Ends {new Date(data.expiresAt!).toLocaleString(undefined, {dateStyle:"medium",timeStyle:"short"})}.
        </p>
        <Link href="/dashboard" className="pricing-choose">Open your dashboard <span aria-hidden="true">→</span></Link>
      </> : <>
        <p className="pricing-trial-status" role="status">{data?.message}</p>
        <Link href={ended ? "/tools/document" : "/dashboard"} className="pricing-choose">{ended ? "Retrieve an available result" : "Go to your dashboard"}</Link>
      </>}
      {error && <p role="alert" className="pricing-trial-status text-red-800">{error}</p>}
    </div>
    <p className="pricing-terms">One trial per eligible account and verified email. Starts only when you activate it. No Credit rollover.</p>
  </article>;
}
