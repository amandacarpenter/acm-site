import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import {
  FileText, Video, Code2, ImageIcon, ArrowRight, CheckCircle2,
  Zap, Shield, GraduationCap, Users, Sparkles, ChevronRight
} from "lucide-react";
// Note: tool cards on homepage are display-only, not linked

const TOOLS = [
  { icon: FileText, title: "Document Fixer", desc: "Upload a Word doc or PDF — AI identifies accessibility issues and returns a remediated version with proper headings, alt text, and structure.", tag: ".docx & .pdf", tab: "document" },
  { icon: Video, title: "Video Transcription", desc: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.", tag: "MP4, MOV, MP3", tab: "video" },
  { icon: Code2, title: "Canvas HTML Fixer", desc: "Paste your Canvas page HTML — AI fixes heading hierarchy, color contrast, missing alt text, and table issues.", tag: "Canvas LMS", tab: "canvas" },
  { icon: ImageIcon, title: "Alt Text Generator", desc: "Upload or link an image. AI generates concise, WCAG-compliant alt text — with long descriptions for complex charts.", tag: "Images & charts", tab: "alttext" },
];

const STATS = [
  { value: "26%", label: "of US adults have a disability", source: "CDC" },
  { value: "97%", label: "of top websites have WCAG failures", source: "WebAIM 2025" },
  { value: "1 in 4", label: "college students has a disability", source: "NCES" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white" data-testid="home-page">
      <SiteHeader />

      {/* ── HERO ── */}
      <section className="bg-[#3a485b]" aria-labelledby="hero-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-8">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            Not Accessible, Not Acceptable™
          </div>

          <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white max-w-3xl mb-4 leading-tight">
            Accessibility{" "}
            <span className="text-[#0d9488]">Made Easy</span>
          </h1>

          <p className="text-xl text-white/80 max-w-xl mb-3 leading-relaxed font-medium">
            Create compliant content, no expertise required.
          </p>
          <p className="text-base text-white/60 max-w-2xl mb-10 leading-relaxed">
            AI-powered tools that fix documents, transcribe videos, clean Canvas HTML, and generate alt text — so every student can learn.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition cursor-pointer shadow-sm" data-testid="hero-cta">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Try for Free
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
            <Link href="/pricing">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/30 text-white font-medium text-sm hover:bg-white/10 transition cursor-pointer">
                See Pricing
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 border-t border-white/20">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-[#0d9488] mb-1">{stat.value}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
                <div className="text-xs text-white/50 mt-0.5">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOOLS ── */}
      <section className="py-20 sm:py-28 bg-white" aria-labelledby="tools-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d9488]/10 text-xs font-semibold text-[#0d9488] mb-4 border border-[#0d9488]/20">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              AI-Powered
            </div>
            <h2 id="tools-heading" className="text-3xl sm:text-4xl font-bold text-[#3a485b] mb-4">
              Four Tools. <span className="text-[#0d9488]">Zero Excuses.</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Each tool is designed for educators who need to fix accessibility issues quickly — no training required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {TOOLS.map((tool) => (
              <div key={tool.tab} className="bg-gray-50 rounded-2xl border border-gray-200 p-6 h-full" data-testid={`tool-card-${tool.tab}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#3a485b] flex items-center justify-center shrink-0">
                    <tool.icon className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#3a485b]">{tool.title}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-medium">{tool.tag}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY IT MATTERS ── */}
      <section className="py-20 sm:py-28 bg-[#3a485b]" aria-labelledby="why-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Why This <span className="text-[#0d9488]">Matters</span>
            </h2>
            <p className="text-white/70 leading-relaxed mb-12">
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
                <div key={card.title} className="p-6 rounded-xl bg-white/10 border border-white/20">
                  <div className="w-10 h-10 rounded-lg bg-[#0d9488] flex items-center justify-center mb-3">
                    <card.icon className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-white mb-1 text-sm">{card.title}</h3>
                  <p className="text-sm text-white/70">{card.desc}</p>
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
            Start free — 3 documents and 1 video included. Credit card required, charged only after your trial is used.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition cursor-pointer shadow-sm">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Create Free Account
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

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                © 2026 Remedy508 — Left Coast Learning LLC
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
                <span className="text-xs text-gray-400">WCAG 2.1 AA Compliant</span>
              </div>
              <span className="text-xs text-gray-500">Not Accessible, Not Acceptable™</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
