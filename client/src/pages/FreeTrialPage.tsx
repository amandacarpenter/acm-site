import { useState } from "react";
import { Link } from "wouter";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, FileText, Image, Code, Video } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useFreeTrial } from "@/hooks/use-free-trial";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { FREE_TRIAL_CREDITS, FREE_TRIAL_DAYS } from "@shared/trial";
import type { FreeTrialStatus } from "@shared/trial";

const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f766e] px-6 py-3 font-semibold text-white hover:bg-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e] disabled:opacity-60";
export default function FreeTrialPage() {
  useDocumentTitle("14-Day Free Trial | 30 Credits, No Credit Card | Remedy508");
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { openUserProfile } = useClerk();
  const trial = useFreeTrial();
  const cache = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const data = trial.data;
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
  const ended = data?.state === "expired" || data?.state === "exhausted";
  return <div className="min-h-screen bg-white text-[#3a485b]">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-white focus:p-4">Skip to main content</a>
    <SiteHeader />
    <main id="main-content">
      <section className="bg-[#edf7f5] border-b border-[#0f766e]/15">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 sm:py-20 grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#0f766e] mb-5">A little less on your plate.</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">Your materials.<br /><span className="text-[#0f766e]">Your free trial.</span></h1>
            <p className="text-lg leading-relaxed max-w-lg mb-7">Put Remedy508 to work on the documents and course materials you actually use. Try the four remediation tools with {FREE_TRIAL_CREDITS} shared Credits over {FREE_TRIAL_DAYS} days.</p>
            {isLoaded && !isSignedIn && <Link href="/signup?trial=1" className={`${button} mb-7 lg:hidden`}>Start your free trial <ArrowRight size={18} aria-hidden="true" /></Link>}
            <ul className="space-y-3 text-base">
              {["No credit card. No automatic charge.", "Start when you're ready, after verifying your email.", "Review your results before sharing them."].map(text =>
                <li className="flex gap-3 items-start" key={text}><Check aria-hidden="true" className="w-5 h-5 text-[#0f766e] shrink-0 mt-0.5" />{text}</li>)}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-[#0f766e]/20 p-6 sm:p-8 shadow-sm" aria-labelledby="trial-offer-heading">
            <h2 id="trial-offer-heading" className="text-2xl font-bold mb-1">{data?.expiresAt ? ended ? "Your trial has ended" : "You're ready to get started" : "Make room for a test drive."}</h2>
            <p className="text-[#566373] mb-6">{FREE_TRIAL_DAYS} days. {FREE_TRIAL_CREDITS} Credits. No commitment.</p>
            <div className="grid grid-cols-2 border-y border-gray-200 py-5 mb-6">
              <div><span className="block text-4xl font-bold text-[#0f766e]">{data?.expiresAt ? data.remaining : FREE_TRIAL_CREDITS}</span><span className="text-sm">{data?.expiresAt ? "Credits available" : "Credits included"}</span></div>
              <div className="border-l border-gray-200 pl-6"><span className="block text-4xl font-bold">{FREE_TRIAL_DAYS}</span><span className="text-sm">day trial</span></div>
            </div>
            {!isLoaded || (isSignedIn && trial.isLoading) ? <p role="status">Checking your account…</p> : !isSignedIn ? <>
              <Link href="/signup?trial=1" className={`${button} w-full`}>Create your free account <ArrowRight size={18} aria-hidden="true" /></Link>
              <p className="text-sm mt-4 text-center">Already have an account? <Link href="/login?trial=1" className="underline font-semibold text-[#0f766e]">Log in</Link>.</p>
            </> : trial.isError ? <>
              <p role="alert" className="text-red-800 mb-4">{trial.error.message}</p>
              <button className={button} onClick={() => trial.refetch()}>Try again</button>
            </> : data?.state === "eligible" ? <>
              <label className="flex items-start gap-3 text-sm leading-relaxed mb-5">
                <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#0f766e]" />
                <span>I agree to the <Link href="/terms" className="underline">Terms of Service</Link> and understand this is a one-time 14-day trial with 30 shared Credits. Unused trial Credits expire, and I won't be charged automatically.</span>
              </label>
              <button className={`${button} w-full`} disabled={!accepted || starting} onClick={start}>{starting ? "Starting your trial…" : "Start my free trial"}<ArrowRight size={18} aria-hidden="true" /></button>
            </> : data?.state === "verification_required" ? <>
              <p className="mb-4">{data.message}</p>
              <button className={button} onClick={()=>openUserProfile()}>Verify your email</button>
              <button className="block mt-4 underline text-[#0f766e]" onClick={()=>trial.refetch()}>I've verified my email. Check again.</button>
            </> : data?.state === "active" ? <>
              <p className="mb-5" role="status">Your trial ends <strong>{new Date(data.expiresAt!).toLocaleString(undefined,{ dateStyle:"medium", timeStyle:"short" })}</strong>. Your Credits are shared across all four tools.</p>
              <Link href="/tools/document" className={`${button} w-full`}>Try Remedy Docs <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link href="/dashboard" className="block text-center mt-4 text-sm underline text-[#0f766e]">View your dashboard</Link>
            </> : <>
              <p className="mb-5" role="status">{data?.message}</p>
              <Link href={ended ? "/pricing" : "/dashboard"} className={button}>{ended ? "Explore paid plans" : "Go to your dashboard"}</Link>
              {ended && <Link href="/tools/document" className="block mt-4 text-sm underline text-[#0f766e]">Retrieve an available document result</Link>}
            </>}
            {error && <p role="alert" className="text-red-800 text-sm mt-4">{error}</p>}
            <p className="text-xs leading-relaxed text-[#566373] mt-6">One trial per eligible account and verified email. Existing paid, complimentary, team, and previous-trial accounts are excluded. No monthly refill or Credit rollover. No purchase required.</p>
          </div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16" aria-labelledby="trial-tools-heading">
        <h2 id="trial-tools-heading" className="text-2xl sm:text-3xl font-bold mb-3">One Credit pool. Four ways to put it to work.</h2>
        <p className="text-[#566373] mb-8">Choose the mix that fits your materials. For example, 20 document pages, 4 images, and 2 HTML fixes use 30 Credits.</p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title:"Remedy Docs", icon:FileText, description:"Improve PDF and Word document accessibility.", cost:"1 Credit per page" },
            { title:"Remedy Image", icon:Image, description:"Generate alt text for images and charts.", cost:"1 Credit per image" },
            { title:"Remedy HTML", icon:Code, description:"Repair accessibility issues in Canvas page HTML.", cost:"3 Credits per fix" },
            { title:"Remedy Video", icon:Video, description:"Generate a transcript from video or audio.", cost:"1 Credit per transcript" },
          ].map(tool=><li key={tool.title} className="border-t-2 border-[#0f766e] pt-5">
            <tool.icon className="w-7 h-7 text-[#0f766e] mb-4" aria-hidden="true" />
            <h3 className="font-bold text-lg mb-2">{tool.title}</h3><p className="text-sm leading-relaxed mb-3">{tool.description}</p><p className="text-sm font-semibold text-[#0f766e]">{tool.cost}</p>
          </li>)}
        </ul>
        <p className="text-sm leading-relaxed text-[#566373] mt-8">Automated remediation supports your workflow, but does not guarantee compliance. Review and verify outputs before use. Normal file-size and format limits apply; jobs must fit within your remaining Credits. Remedy Layout is not included while it is coming soon.</p>
        <div className="mt-10 pt-7 border-t border-gray-200">
          <h3 className="font-bold mb-2">Just looking around?</h3>
          <p className="text-sm leading-relaxed">The <Link href="/accessibility-checker" className="underline text-[#0f766e]">Free Document Checker</Link> and <Link href="/screen-reader-simulation" className="underline text-[#0f766e]">Screen Reader Simulator</Link> are always free, with no account or Credits needed. Your trial only starts when you choose to activate it.</p>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
