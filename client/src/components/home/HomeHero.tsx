import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { ArrowRight, Menu, Volume2, X } from "lucide-react";
import logoWhite from "@/assets/logo-white-header.png";
import heroListener from "@/assets/hero-listener-headphones.webp";
import "./home-hero.css";
import TrialNavLink from "@/components/TrialNavLink";

export type HomeNavLink = { href: string; label: string };

/* What the "now reading" card cycles through. Decorative only (aria-hidden). */
const ROWS = [
  { chip: "Document", say: "Biology 101 Syllabus, document" },
  { chip: "Heading 1", say: "Heading level 1, Biology 101 Syllabus" },
  { chip: "Text", say: "Welcome to Biology 101. This course introduces cells, genetics, and ecosystems." },
  { chip: "Heading 2", say: "Heading level 2, Course Materials" },
  { chip: "List", say: "List with 3 items" },
  { chip: "List item", say: "• Textbook: Concepts of Biology, free online" },
  { chip: "Heading 2", say: "Heading level 2, Weekly Schedule" },
  { chip: "Table", say: "Table with 4 rows and 3 columns" },
  { chip: "Graphic", say: "Graphic, Bar chart of average quiz scores by week" },
];
const START = 3;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useStep(ms: number, paused: boolean) {
  const [i, setI] = useState(START);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % ROWS.length), ms);
    return () => clearInterval(t);
  }, [ms, paused]);
  return i;
}

function NowReading() {
  const [paused, setPaused] = useState(prefersReducedMotion);
  const i = useStep(2200, paused);
  const r = ROWS[i];
  return (
    <div className={`hh-now${paused ? " is-paused" : ""}`}>
      <div aria-hidden="true">
        <div className="hh-now-top">
          <span className="hh-chip">{r.chip}</span>
          <span className="hh-wave"><b /><b /><b /><b /><b /><b /><b /></span>
        </div>
        <div key={i} className="hh-now-text hh-fade">{r.say}</div>
        <div className="hh-now-sub"><Volume2 size={13} /> Screen reader simulator</div>
      </div>
      <button
        type="button"
        className="hh-pause"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "Play animation" : "Pause animation"}
      </button>
    </div>
  );
}

export function HomeHeader({ links }: { links: HomeNavLink[] }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="hh-band">
      <div className="hh-wrap hh-bar">
        <Link href="/" className="hh-logo" aria-label="Remedy508 home">
          <img src={logoWhite} alt="Remedy508" width={182} height={46} />
        </Link>

        <nav className="hh-links" aria-label="Main navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={location === l.href ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>

        <div className="hh-right">
          <SignedOut>
            <Link href="/login" className="hh-login">Log in</Link>
          </SignedOut>
          <TrialNavLink className="hh-pill" />
          <SignedIn>
            <Link href="/dashboard" className="hh-login">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* Mobile toggle: same as SiteHeader, but white because it sits on the navy band */}
        <button
          type="button"
          className="hh-toggle p-2 rounded-lg"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="hh-mobile-menu"
          data-testid="mobile-menu-toggle"
        >
          {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu: same markup and styles as SiteHeader */}
      {open && (
        <div id="hh-mobile-menu" className="hh-mobile-menu border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={close}
                  aria-current={location === link.href ? "page" : undefined}
                  className="block px-3 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <SignedOut>
              <Link href="/login">
                <span onClick={close} className="block mt-3 px-3 py-2.5 rounded-lg border border-[#0f766e] text-sm font-bold text-[#0f766e] text-center hover:bg-[#0f766e]/10 cursor-pointer">
                  Log in
                </span>
              </Link>
            </SignedOut>
            <TrialNavLink onClick={close} className="flex items-center justify-center gap-2 mt-2 px-3 py-3 rounded-lg text-sm font-bold bg-[#0f766e] text-white text-center" />
            <SignedIn>
              <Link href="/dashboard">
                <span onClick={close} className="block mt-3 px-3 py-2.5 rounded-lg border border-[#0f766e] text-sm font-bold text-[#0f766e] text-center hover:bg-[#0f766e]/10 cursor-pointer">
                  Dashboard
                </span>
              </Link>
              <div className="px-3 py-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </nav>
        </div>
      )}
    </header>
  );
}

export default function HomeHero() {
  return (
      <section className="hh" aria-labelledby="hero-heading">
        <div className="hh-wrap hh-grid">
          <div>
            <h1 id="hero-heading" className="hh-display hh-h1">
              Accessibility<br /><span className="hh-made">Made Easy.</span>
            </h1>
            <p className="hh-display hh-sub">Not Accessible, Not Acceptable™</p>
            <div className="hh-copy">
              <p>
                Start with a free accessibility check or hear how your document may sound with a screen reader. Then use RemedyTools to improve PDF and Word documents, clean up Canvas HTML, add image alt text, and transcribe video.
              </p>
              <p className="mt-4">
                Built for higher education, government, healthcare, and accessibility teams. Presentation and flyer remediation is coming soon.
              </p>
            </div>
            <div className="hh-ctas">
              <Link href="/free-trial" className="hh-cta" data-testid="hero-cta">Start a Free Trial <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/pricing" className="hh-ghost" aria-label="See Pricing - view plans and features">See Pricing</Link>
            </div>
            <p className="hh-note">14 days. 30 Credits. No credit card required.</p>
          </div>

          <div className="hh-art">
            <div className="hh-circle" aria-hidden="true" />
            <div className="hh-clip">
              <img src={heroListener} alt="Young woman listening on orange headphones" width={1000} height={897} fetchPriority="high" />
            </div>
            <div className="hh-card"><NowReading /></div>
          </div>
        </div>
      </section>
  );
}
