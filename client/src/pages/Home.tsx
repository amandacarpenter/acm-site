import { Link } from "wouter";
import { lazy, Suspense } from "react";
import SiteFooter from "@/components/SiteFooter";
import HomeHero, { HomeHeader } from "@/components/home/HomeHero";
import iconDocument from "@/assets/icon-document.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";
import IncidentBanner from "@/components/IncidentBanner";
import {
  SearchCheck, AudioLines, Presentation,
  Zap, Shield, GraduationCap, Users, Sparkles, ChevronRight
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { SITE_NAV_LINKS } from "@/lib/site-navigation";
// Note: tool cards on homepage are display-only, not linked

const TOOLS = [
  { icon: iconDocument, Icon: null, title: "Remedy Docs", desc: "Upload any Word doc or PDF. Remedy508 automatically detects images, tables, and multi-column layouts and remediates the whole document — no need to pick a tool.", tag: ".docx & .pdf", tab: "document", comingSoon: false },
  { icon: iconVideo, Icon: null, title: "Remedy Video", desc: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.", tag: "MP4, MOV, MP3", tab: "video", comingSoon: false },
  { icon: iconCanvas, Icon: null, title: "Remedy HTML", desc: "Paste your Canvas page HTML — Remedy508 fixes heading hierarchy, color contrast, missing alt text, and table issues.", tag: "Canvas LMS", tab: "canvas", comingSoon: false },
  { icon: iconAlttext, Icon: null, title: "Remedy Image", desc: "Upload or link an image. Remedy508 generates concise, WCAG-compliant alt text — with long descriptions for complex charts.", tag: "Images & charts", tab: "alttext", comingSoon: false },
  { icon: null, Icon: Presentation, title: "Remedy Layout", desc: "Remediate presentations, flyers, and other visually designed documents while preserving their original layout and appearance.", tag: "Presentations & Flyers", tab: "layout", comingSoon: true },
];

const STATS = [
  { value: "26%", label: "of US adults have a disability", source: "CDC" },
  { value: "97%", label: "of top websites have WCAG failures", source: "WebAIM 2025" },
  { value: "1 in 4", label: "college students has a disability", source: "NCES" },
];

const SimulationExperience = lazy(() =>
  import("@/features/screen-reader-simulation/components/SimulationExperience").then((module) => ({
    default: module.SimulationExperience,
  })),
);

const CheckerExperience = lazy(() =>
  import("@/features/document-checker/components/CheckerExperience").then((module) => ({
    default: module.CheckerExperience,
  })),
);

export default function Home() {
  useDocumentTitle("Document Accessibility Remediation Software | Remedy508");

  return (
    <div className="min-h-screen bg-white" data-testid="home-page">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0f766e] focus:text-white focus:rounded-lg focus:font-semibold">Skip to main content</a>
      <IncidentBanner />

      <HomeHeader links={SITE_NAV_LINKS} />

      <main id="main-content">
      {/* ── HERO ── */}
      <HomeHero />

      {/* ── FREE ACCESSIBILITY CHECKER ── */}
      <section className="bg-white border-b border-gray-200" aria-labelledby="free-checker-heading">
        {/* Slate band with the heading, so this section stands apart from the white hero */}
        <div className="bg-[#3a485b] py-14 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-5">
              <SearchCheck className="w-4 h-4" aria-hidden="true" />
              Free Document Accessibility Checker
            </div>
            <h2 id="free-checker-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              Not sure if your documents are accessible?
            </h2>
            <p className="text-lg text-white/85 leading-relaxed max-w-2xl mx-auto">
              Check PDF and Word document accessibility online for tags, headings, tables, alt text, language, and other machine-detectable barriers. It is free, requires no account, uses no Remedy508 Credits, and keeps document contents in your browser.
            </p>
          </div>
        </div>
        <div className="pt-10 sm:pt-12 pb-16 sm:pb-20">
          <Suspense fallback={<p className="py-10 text-center text-gray-600" aria-live="polite">Loading the free checker…</p>}>
            <CheckerExperience compact mainId="homepage-document-checker" />
          </Suspense>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center mt-2">
            <Link href="/accessibility-checker">
              <span className="text-sm font-semibold text-[#0f766e] hover:underline cursor-pointer">
                Learn more about the Free Document Accessibility Checker
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FREE SCREEN READER SIMULATION ── */}
      <section className="bg-white border-b border-gray-200" aria-labelledby="free-simulation-heading">
        {/* Slate band with the heading, matching the checker section above */}
        <div className="bg-[#3a485b] py-14 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-5">
              <AudioLines className="w-4 h-4" aria-hidden="true" />
              Free Screen Reader Simulation
            </div>
            <h2 id="free-simulation-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              Want to hear how a screen reader reads your document?
            </h2>
            <p className="text-lg text-white/85 leading-relaxed max-w-2xl mx-auto">
              Open a PDF or Word document to hear its headings, lists, tables, links, and image descriptions in reading order, with missing alt text and skipped headings flagged as you go. It is free, requires no account, uses no Remedy508 Credits, and keeps document contents in your browser.
            </p>
          </div>
        </div>
        <div className="pt-10 sm:pt-12 pb-16 sm:pb-20">
          <Suspense fallback={<p className="py-10 text-center text-gray-600" aria-live="polite">Loading the screen reader simulation…</p>}>
            <SimulationExperience compact mainId="homepage-screen-reader-simulation" />
          </Suspense>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center mt-2">
            <Link href="/screen-reader-simulation">
              <span className="text-sm font-semibold text-[#0f766e] hover:underline cursor-pointer">
                Learn more about the Free Screen Reader Simulation
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 bg-gray-50" aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Section header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0f766e]/20 text-sm font-semibold text-[#0f5f59] mb-4 border border-[#0f766e]/30">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              What’s included with Remedy508
            </div>
            <h2 id="how-heading" className="text-3xl sm:text-4xl font-bold text-[#3a485b] mb-4">
              Four Tools Available, One Coming Soon
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every paid Remedy508 plan includes four accessibility remediation tools for PDFs and Word documents, videos, Canvas HTML, and images. Remedy Layout for presentations and flyers is coming soon.
            </p>
          </div>

          <div className="flex flex-col gap-4 max-w-5xl mx-auto">
              {TOOLS.map((tool) => (
                <div key={tool.tab} className="w-full bg-white rounded-2xl border border-gray-200 p-5 shadow-sm" data-testid={`tool-card-${tool.tab}`}>
                  <div className="flex items-start gap-4">
                    {tool.icon ? (
                      <img src={tool.icon} alt="" aria-hidden="true" className="w-20 h-20 object-contain shrink-0" />
                    ) : tool.Icon ? (
                      <div className="w-20 h-20 flex items-center justify-center shrink-0" aria-hidden="true">
                        <span className="w-12 h-12 rounded-full bg-[#0f766e] flex items-center justify-center">
                          <tool.Icon className="w-6 h-6 text-white" strokeWidth={1.8} />
                        </span>
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-[#3a485b] text-base">{tool.title}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-gray-300 text-gray-700 text-xs font-medium">{tool.tag}</span>
                        {tool.comingSoon && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">Coming Soon</span>
                        )}
                      </div>
                      <p className="text-base text-gray-600 leading-relaxed">{tool.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ── WHY IT MATTERS ── */}
      <section className="py-20 sm:py-28 bg-[#3a485b] border-b border-white/20" aria-labelledby="why-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Why This Matters
            </h2>
            <p className="text-white/90 leading-relaxed mb-12">
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
                  <div className="w-10 h-10 rounded-lg bg-[#0f766e] flex items-center justify-center mb-3">
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
      <section className="py-20 bg-[#3a485b]" aria-label="Get started">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#0f766e] text-white font-semibold text-sm hover:bg-[#115e59] transition cursor-pointer shadow-sm">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Get Started →
              </span>
            </Link>
            <Link href="/pricing" aria-label="See Pricing — choose a plan">
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
