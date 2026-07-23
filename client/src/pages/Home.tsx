import { Link, useLocation } from "wouter";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import SiteFooter from "@/components/SiteFooter";
import teaserVideo from "@/assets/teaser.mp4";
import iconDocument from "@/assets/icon-document.png";
import iconComplexpdf from "@/assets/icon-complexpdf.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";
import teaserCaptions from "@/assets/teaser.vtt";
import phoneFrame from "@/assets/phone-frame.png";
import heroPerson from "@/assets/hero-person.png";
import logoUrl from "@/assets/logo.png";
import logoHero from "@/assets/logo-hero.jpg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Zap, Shield, GraduationCap, Users, Sparkles, ChevronRight, BookOpen, Menu, X
} from "lucide-react";
// Note: tool cards on homepage are display-only, not linked

const TOOLS = [
  { icon: iconDocument, title: "Document Fixer", desc: "Upload a Word doc or PDF — Remedy508 identifies accessibility issues and returns a remediated version with proper headings, alt text, and structure.", tag: ".docx & .pdf", tab: "document" },
  { icon: iconComplexpdf, title: "Complex PDF", desc: "Upload a complex PDF with images, tables, and multi-column layouts — Remedy508 remediates the full document and returns a tagged, WCAG 2.1 AA compliant PDF.", tag: "Complex .pdf", tab: "complexpdf" },
  { icon: iconVideo, title: "Video Transcription", desc: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.", tag: "MP4, MOV, MP3", tab: "video" },
  { icon: iconCanvas, title: "Canvas HTML Fixer", desc: "Paste your Canvas page HTML — Remedy508 fixes heading hierarchy, color contrast, missing alt text, and table issues.", tag: "Canvas LMS", tab: "canvas" },
  { icon: iconAlttext, title: "Alt Text Generator", desc: "Upload or link an image. Remedy508 generates concise, WCAG-compliant alt text — with long descriptions for complex charts.", tag: "Images & charts", tab: "alttext" },
];

const STATS = [
  { value: "26%", label: "of US adults have a disability", source: "CDC" },
  { value: "97%", label: "of top websites have WCAG failures", source: "WebAIM 2025" },
  { value: "1 in 4", label: "college students has a disability", source: "NCES" },
];

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/pricing", label: "Plans & Pricing" },
];

export default function Home() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" data-testid="home-page">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0d9488] focus:text-white focus:rounded-lg focus:font-semibold">Skip to main content</a>

      <main id="main-content">
      {/* ── HERO ── */}
      <section className="relative flex flex-col lg:flex-row lg:[min-height:100svh]" aria-labelledby="hero-heading">

        {/* ─ LEFT dark panel — full height, skinny, logo at top, copy vertically centered ─ */}
        <div className="hidden lg:flex flex-col bg-[#111827] lg:w-[32%] xl:w-[30%] px-8 xl:px-12" style={{ minHeight: "100svh" }}>
          {/* Logo row at very top */}
          <div className="pt-6 pb-4">
            <Link href="/" className="flex items-center no-underline" aria-label="Remedy508 home">
              <img src={logoHero} alt="Remedy508" style={{ height: 52, width: "auto" }} />
            </Link>
          </div>

          {/* Copy — centered vertically in remaining space */}
          <div className="flex flex-col justify-center flex-1 pb-16">
            <h1 id="hero-heading" className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-5">
              Not Accessible,<br />Not Acceptable™
            </h1>
            <p className="text-white/90 text-base leading-relaxed mb-8">
              Create compliant content, no expertise required. Remedy508 fixes documents, transcribes videos, cleans Canvas HTML, and generates alt text — so every student can learn.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup">
                <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0d9488] text-white font-bold text-sm hover:bg-[#0f766e] transition cursor-pointer" data-testid="hero-cta">
                  <Zap className="w-4 h-4" aria-hidden="true" />
                  Get Started →
                </span>
              </Link>
              <Link href="/pricing">
                <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/40 text-white font-semibold text-sm hover:bg-white/10 transition cursor-pointer">
                  See Pricing ›
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ─ RIGHT: full-bleed photo + nav + overlay text ─ */}
        <div className="relative lg:flex-1 flex flex-col lg:min-h-svh">

          {/* Desktop: photo fills entire column absolutely */}
          <img
            src={heroPerson}
            alt="Professional smiling while working on a laptop in a modern office"
            className="hidden lg:block absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "50% 10%" }}
          />

          {/* Nav bar — always on top */}
          <header role="banner" className="relative z-20 w-full lg:absolute lg:top-0 lg:left-0 lg:right-0">
            {/* Mobile bg — solid dark bar */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-[#111827] lg:hidden" />
            {/* Desktop bg — gradient over photo */}
            <div className="absolute inset-0 hidden lg:block" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }} />
            <div className="relative h-20 flex items-center justify-between px-6 sm:px-8">
              {/* Mobile logo — logo-hero.jpg blends into the solid dark bar above */}
              <Link href="/" className="flex lg:hidden items-center no-underline" aria-label="Remedy508 home">
                <img src={logoHero} alt="Remedy508" style={{ height: 52, width: "auto" }} />
              </Link>
              {/* Spacer on desktop so nav sits right */}
              <div className="hidden lg:block" />

              {/* Desktop nav */}
              <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <span className={`px-3 py-2 rounded-lg text-base font-semibold transition-colors cursor-pointer ${
                      location === link.href ? "text-white" : "text-white hover:text-white hover:bg-white/10"
                    }`}>{link.label}</span>
                  </Link>
                ))}
                <SignedOut>
                  <Link href="/login">
                    <span className="ml-1 px-3 py-2 rounded-lg text-base font-semibold text-white hover:bg-white/10 transition cursor-pointer">Log in</span>
                  </Link>
                  <Link href="/signup">
                    <span className="ml-2 px-4 py-2 rounded-lg text-base font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">Get Started</span>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <span className="ml-1 px-3 py-2 rounded-lg text-base font-semibold text-white hover:bg-white/10 transition cursor-pointer">Dashboard</span>
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </nav>

              {/* Mobile hamburger */}
              <button
                className="sm:hidden p-2 rounded-lg text-white/80 hover:text-white"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* Mobile dropdown */}
            {mobileOpen && (
              <div className="sm:hidden bg-[#111827]/95 border-t border-white/10">
                <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
                  {NAV_LINKS.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-base font-bold text-white hover:bg-white/10 cursor-pointer">{link.label}</span>
                    </Link>
                  ))}
                  <SignedOut>
                    <Link href="/login"><span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-base font-bold text-white hover:bg-white/10 cursor-pointer">Log in</span></Link>
                    <Link href="/signup"><span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-base font-bold bg-[#0d9488] text-white text-center cursor-pointer">Get Started</span></Link>
                  </SignedOut>
                  <SignedIn>
                    <Link href="/dashboard"><span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-base font-bold text-white hover:bg-white/10 cursor-pointer">Dashboard</span></Link>
                    <div className="px-3 py-2"><UserButton afterSignOutUrl="/" /></div>
                  </SignedIn>
                </nav>
              </div>
            )}
          </header>

          {/* Mobile: photo below nav with Accessibility Made Easy overlaid */}
          <div className="lg:hidden relative">
            <img
              src={heroPerson}
              alt=""
              aria-hidden="true"
              className="w-full object-cover"
              style={{ height: "65vw", minHeight: 240, maxHeight: 360, objectPosition: "50% 15%" }}
            />
            <div className="absolute inset-0 flex items-end px-5 pb-5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }}>
              <p className="text-white font-black leading-none" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", textShadow: "0 2px 20px rgba(0,0,0,0.7)" }}>
                Accessibility<br />Made Easy.
              </p>
            </div>
          </div>

          {/* Desktop: Accessibility Made Easy overlay */}
          <div className="hidden lg:flex relative z-10 flex-1 items-center px-6 sm:px-10 pb-0 pt-16">
            <p
              className="text-white font-black leading-none"
              style={{ fontSize: "clamp(3rem, 9vw, 6rem)", textShadow: "0 2px 40px rgba(0,0,0,0.6)" }}
              aria-hidden="true"
            >
              Accessibility<br />Made Easy.
            </p>
          </div>
        </div>

        {/* Mobile-only copy block — below the photo */}
        <div className="lg:hidden bg-[#111827] px-6 py-10">
          <h1 id="hero-heading" className="text-2xl font-extrabold text-white leading-tight mb-4">
            Not Accessible,<br />Not Acceptable™
          </h1>
          <p className="text-white/70 text-sm leading-relaxed mb-7">
            Create compliant content, no expertise required. Remedy508 fixes documents, transcribes videos, cleans Canvas HTML, and generates alt text — so every student can learn.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0d9488] text-white font-bold text-sm hover:bg-[#0f766e] transition cursor-pointer">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Get Started →
              </span>
            </Link>
            <Link href="/pricing">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition cursor-pointer">
                See Pricing ›
              </span>
            </Link>
          </div>
        </div>

      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 bg-white" aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Section header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d9488]/20 text-xs font-semibold text-[#0f5f59] mb-4 border border-[#0d9488]/30">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              How It Works
            </div>
            <h2 id="how-heading" className="text-3xl sm:text-4xl font-bold text-[#3a485b] mb-4">
              Five Tools. <span className="text-[#0d9488]">Zero Excuses.</span>
            </h2>

          </div>

          {/* Two-column: phone left, tools right */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Phone mockup */}
            <div className="flex-shrink-0 flex justify-center">
              <div style={{ position: "relative", width: 300 }}>
                <img src={phoneFrame} alt="" aria-hidden="true"
                  style={{ width: "100%", display: "block", pointerEvents: "none", userSelect: "none" }} />
                <div style={{
                  position: "absolute", top: "10.5%", left: "13.5%",
                  width: "73%", height: "74.5%",
                  overflow: "hidden", borderRadius: "6% / 4%",
                }}>
                  <video
                    autoPlay muted loop playsInline controls
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  >
                    <source src={teaserVideo} type="video/mp4" />
                    <track kind="captions" src={teaserCaptions} srcLang="en" label="English" default />
                  </video>
                </div>
              </div>
            </div>

            {/* Tool cards — single column */}
            <div className="flex-1 flex flex-col gap-4">
              {TOOLS.map((tool) => (
                <div key={tool.tab} className="bg-gray-50 rounded-2xl border border-gray-200 p-5" data-testid={`tool-card-${tool.tab}`}>
                  <div className="flex items-start gap-4">
                    <img src={tool.icon} alt="" aria-hidden="true" className="w-16 h-16 object-contain shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#3a485b] text-sm">{tool.title}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-gray-300 text-gray-700 text-xs font-medium">{tool.tag}</span>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── WCAG 2.1 AA SECTION ── */}
      <section className="py-20 sm:py-28 bg-[#3a485b]" aria-labelledby="wcag-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-white mb-4 border border-white/20">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Standards Reference
            </div>
            <h2 id="wcag-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
              WCAG 2.1 Level AA <span className="text-white">Explained</span>
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              The Web Content Accessibility Guidelines (WCAG) 2.1 Level AA is the legal standard
              required by ADA, Section 508, and most higher education accessibility policies.
              Here's what it actually means in practice.
            </p>
          </div>

          <Accordion type="multiple" className="space-y-3">

            {/* ── PERCEIVABLE ── */}
            <AccordionItem value="perceivable" className="bg-white border border-gray-200 rounded-2xl px-6 shadow-sm">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#3a485b] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <div>
                    <div className="font-bold text-[#3a485b] text-base">Perceivable</div>
                    <div className="text-xs text-gray-600 font-normal">Information must be presentable in ways users can perceive</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="space-y-3 ml-11">
                  {[
                    { code: "1.1.1", name: "Non-text Content", desc: "All images, charts, and diagrams must have alt text. Complex images like graphs also need a long description." },
                    { code: "1.2.1–1.2.5", name: "Time-based Media", desc: "Pre-recorded audio and video need captions and audio descriptions. Live video needs captions." },
                    { code: "1.3.1", name: "Info & Relationships", desc: "Structure conveyed visually (headings, lists, tables) must also be conveyed through markup — not just appearance." },
                    { code: "1.3.2", name: "Meaningful Sequence", desc: "Content must be presented in a logical reading order when style sheets are removed." },
                    { code: "1.4.1", name: "Use of Color", desc: "Color must not be the only means of conveying information (e.g., 'required fields in red')." },
                    { code: "1.4.3", name: "Contrast (Minimum)", desc: "Text must have a contrast ratio of at least 4.5:1 against the background. Large text needs 3:1." },
                    { code: "1.4.4", name: "Resize Text", desc: "Text must be resizable up to 200% without loss of content or functionality." },
                  ].map((item) => (
                    <div key={item.code}>
                      <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                      <span className="text-sm text-gray-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── OPERABLE ── */}
            <AccordionItem value="operable" className="bg-white border border-gray-200 rounded-2xl px-6 shadow-sm">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#0d9488] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <div className="font-bold text-[#3a485b] text-base">Operable</div>
                    <div className="text-xs text-gray-600 font-normal">Interface components must be operable by all users</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="space-y-3 ml-11">
                  {[
                    { code: "2.1.1", name: "Keyboard", desc: "All functionality must be accessible via keyboard alone — no mouse required." },
                    { code: "2.1.2", name: "No Keyboard Trap", desc: "Users must be able to move keyboard focus away from any component without getting stuck." },
                    { code: "2.3.1", name: "Three Flashes", desc: "Content must not flash more than three times per second — prevents seizure risk." },
                    { code: "2.4.1", name: "Bypass Blocks", desc: "A mechanism must exist to skip repeated navigation and go directly to main content (skip links)." },
                    { code: "2.4.2", name: "Page Titled", desc: "Every page must have a descriptive title that identifies its topic or purpose." },
                    { code: "2.4.3", name: "Focus Order", desc: "Keyboard focus must move in a logical sequence that preserves meaning." },
                    { code: "2.4.4", name: "Link Purpose", desc: "The purpose of every link must be clear from the link text alone or its surrounding context." },
                    { code: "2.4.7", name: "Focus Visible", desc: "Keyboard focus must be visually visible at all times — users must see where they are on the page." },
                  ].map((item) => (
                    <div key={item.code}>
                      <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                      <span className="text-sm text-gray-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── UNDERSTANDABLE ── */}
            <AccordionItem value="understandable" className="bg-white border border-gray-200 rounded-2xl px-6 shadow-sm">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#3a485b] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <div>
                    <div className="font-bold text-[#3a485b] text-base">Understandable</div>
                    <div className="text-xs text-gray-600 font-normal">Content and operation must be understandable</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="space-y-3 ml-11">
                  {[
                    { code: "3.1.1", name: "Language of Page", desc: "The primary language of each page must be declared in the HTML so screen readers use the right pronunciation." },
                    { code: "3.1.2", name: "Language of Parts", desc: "When content switches language mid-page, that passage must be marked with the correct language attribute." },
                    { code: "3.2.1", name: "On Focus", desc: "Keyboard focus must not trigger an unexpected context change (like auto-submitting a form)." },
                    { code: "3.2.2", name: "On Input", desc: "Changing a form field must not automatically submit the form or open a new window without warning." },
                    { code: "3.3.1", name: "Error Identification", desc: "Form errors must be identified in text — not just by color — and describe what went wrong." },
                    { code: "3.3.2", name: "Labels or Instructions", desc: "All form fields must have a visible label or clear instructions so users know what to enter." },
                    { code: "3.3.3", name: "Error Suggestion", desc: "If an error is detected and a correction is known, a suggestion must be provided (e.g., 'Enter a valid email address')." },
                  ].map((item) => (
                    <div key={item.code}>
                      <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                      <span className="text-sm text-gray-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── ROBUST ── */}
            <AccordionItem value="robust" className="bg-white border border-gray-200 rounded-2xl px-6 shadow-sm">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#0d9488] text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                  <div>
                    <div className="font-bold text-[#3a485b] text-base">Robust</div>
                    <div className="text-xs text-gray-600 font-normal">Content must be interpreted by assistive technologies</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="space-y-3 ml-11">
                  {[
                    { code: "4.1.1", name: "Parsing", desc: "HTML must have no major errors — unclosed tags, duplicate IDs, or invalid nesting can break screen readers." },
                    { code: "4.1.2", name: "Name, Role, Value", desc: "All UI components must expose their name, role (button, checkbox, etc.), and state to assistive technologies via ARIA or semantic HTML." },
                    { code: "4.1.3", name: "Status Messages", desc: "Dynamic status updates (like 'Form submitted' or 'File uploading') must be communicated to screen readers without requiring focus." },
                  ].map((item) => (
                    <div key={item.code}>
                      <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                      <span className="text-sm text-gray-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          <p className="text-center text-xs text-white/80 mt-6">
            Source:{" "}
            <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener noreferrer" aria-label="W3C WCAG 2.1 Specification (opens in new tab)" className="underline underline-offset-2 hover:text-[#5eead4] transition">
              W3C WCAG 2.1 Specification
            </a>
          </p>
        </div>
      </section>

      {/* ── WHY IT MATTERS ── */}
      <section className="py-20 sm:py-28 bg-white" aria-labelledby="why-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold text-[#3a485b] mb-6">
              Why This <span className="text-[#0d9488]">Matters</span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-12">
              When course materials aren't accessible, students using assistive technology can't complete their work.
              That's not a minor inconvenience — it's an educational barrier that violates federal law and excludes
              learners from the education they deserve.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              {[
                { icon: GraduationCap, title: "For Educators", desc: "Create materials that every student can use — without hours of manual remediation." },
                { icon: Users, title: "For Students", desc: "Access course content on equal footing — with screen readers, captions, and properly structured documents." },
                { icon: Shield, title: "For Institutions", desc: "Meet ADA, Section 508, and WCAG 2.1 AA requirements — reduce legal risk proactively." },
              ].map((card) => (
                <div key={card.title} className="p-6 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="w-10 h-10 rounded-lg bg-[#0d9488] flex items-center justify-center mb-3">
                    <card.icon className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-[#3a485b] mb-1 text-sm">{card.title}</h3>
                  <p className="text-sm text-gray-500">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-[#3a485b]" aria-labelledby="cta-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to make your content accessible?
          </h2>
          <p className="text-white/70 mb-8">
            Individual or team — straightforward pricing built for higher education.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition cursor-pointer shadow-sm">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Get Started
              </span>
            </Link>
            <Link href="/pricing">
              <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition cursor-pointer">
                See Pricing
              </span>
            </Link>
          </div>
        </div>
      </section>

      </main>
      {/* ── FOOTER ── */}
      <SiteFooter />
    </div>
  );
}
