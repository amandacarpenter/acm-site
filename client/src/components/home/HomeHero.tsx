import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { ArrowRight, Volume2 } from "lucide-react";
import logoWhite from "@/assets/logo-white-header.png";
import heroListener from "@/assets/hero-listener.webp";
import "./home-hero.css";

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

function useStep(ms: number) {
  const [i, setI] = useState(START);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setInterval(() => setI((n) => (n + 1) % ROWS.length), ms);
    return () => clearInterval(t);
  }, [ms]);
  return i;
}

function NowReading() {
  const i = useStep(2200);
  const r = ROWS[i];
  return (
    <div className="hh-now" aria-hidden="true">
      <div className="hh-now-top">
        <span className="hh-chip">{r.chip}</span>
        <span className="hh-wave"><b /><b /><b /><b /><b /><b /><b /></span>
      </div>
      <div key={i} className="hh-now-text hh-fade">{r.say}</div>
      <div className="hh-now-sub"><Volume2 size={13} /> Screen reader simulation</div>
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
            <Link href="/signup" className="hh-pill">Get Started <ArrowRight size={16} aria-hidden="true" /></Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="hh-login">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        <button
          type="button"
          className="hh-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="hh-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          <i /><i /><i />
        </button>
      </div>

      {open && (
        <nav id="hh-mobile-menu" className="hh-menu" aria-label="Mobile navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={close} aria-current={location === l.href ? "page" : undefined}>{l.label}</Link>
          ))}
          <SignedOut>
            <Link href="/login" onClick={close}>Log in</Link>
            <Link href="/signup" onClick={close} className="hh-menu-cta">Get Started <ArrowRight size={16} aria-hidden="true" /></Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" onClick={close}>Dashboard</Link>
            <div className="hh-menu-user"><UserButton afterSignOutUrl="/" /></div>
          </SignedIn>
        </nav>
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
            <p className="hh-copy">
              Remedy508 combines a free document accessibility checker with PDF and Word remediation software, Canvas HTML cleanup, image alt text, and video transcription, with presentation and flyer remediation coming soon. Built for higher education, government, healthcare, and accessibility teams.
            </p>
            <div className="hh-ctas">
              <Link href="/signup" className="hh-cta" data-testid="hero-cta">Get Started <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/pricing" className="hh-ghost" aria-label="See Pricing - view plans and features">See Pricing</Link>
            </div>
            <p className="hh-note">
              Hear your documents the way a screen reader does, then use <b>RemedyTools</b> to fix them.
            </p>
          </div>

          <div className="hh-art">
            <div className="hh-circle" aria-hidden="true" />
            <div className="hh-clip">
              <img src={heroListener} alt="Smiling woman wearing white headphones" width={900} height={895} fetchPriority="high" />
            </div>
            <div className="hh-card"><NowReading /></div>
          </div>
        </div>
      </section>
  );
}
