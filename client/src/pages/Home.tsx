import { Link } from "wouter";
import { lazy, Suspense } from "react";
import SiteFooter from "@/components/SiteFooter";
import HomeHero, { HomeHeader } from "@/components/home/HomeHero";
import IncidentBanner from "@/components/IncidentBanner";
import {
  SearchCheck, AudioLines,
  Shield, GraduationCap, Users, ChevronRight
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { SITE_NAV_LINKS } from "@/lib/site-navigation";
const TOOLS = [
  { title: "Remedy Docs", comingSoon: false },
  { title: "Remedy Video", comingSoon: false },
  { title: "Remedy HTML", comingSoon: false },
  { title: "Remedy Image", comingSoon: false },
  { title: "Remedy Layout", comingSoon: true },
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

      {/* ── REMEDY TOOLS ── */}
      <section className="py-20 sm:py-28 bg-gray-50" aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 id="how-heading" className="text-3xl sm:text-4xl font-bold text-[#3a485b] mb-10">Remedy Tools</h2>
          <ul className="flex flex-wrap items-start justify-center gap-x-10 gap-y-6 list-none p-0 m-0">
            {TOOLS.map((tool) => (
              <li key={tool.title} className="flex flex-col items-center gap-2">
                <span className="text-lg font-semibold text-[#3a485b]">{tool.title}</span>
                {tool.comingSoon && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">Coming Soon</span>}
              </li>
            ))}
          </ul>
          <Link href="/remedy-tools" className="inline-flex items-center justify-center mt-10 min-h-12 px-7 py-3 rounded-lg bg-[#0f766e] text-white font-semibold hover:bg-[#115e59] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e]">
            Learn more
          </Link>
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

      </main>
      {/* ── FOOTER ── */}
      <SiteFooter />
    </div>
  );
}
