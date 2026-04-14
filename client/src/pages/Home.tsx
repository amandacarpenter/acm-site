import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import {
  FileText, Video, Code2, ImageIcon, ArrowRight, CheckCircle2,
  Zap, Shield, GraduationCap, Users, BookOpen, Sparkles
} from "lucide-react";

// ── ACCESS Framework Data ────────────────────────────────────────────────────
const ACCESS = [
  { letter: "A", word: "Alt Tags", desc: "Provide alt text for images, charts, and non-text elements so screen readers can describe them." },
  { letter: "C", word: "Color", desc: "Don't rely on color alone to convey meaning. Ensure sufficient contrast ratios (4.5:1 minimum)." },
  { letter: "C", word: "Captions", desc: "Add captions and transcripts to video and audio content for deaf and hard-of-hearing learners." },
  { letter: "E", word: "Equivalents", desc: "Provide text equivalents for non-text content — tables, graphs, multimedia, and interactive elements." },
  { letter: "S", word: "Styles", desc: "Use heading styles and semantic structure — not manual formatting — so content is navigable." },
  { letter: "S", word: "Sequential", desc: "Ensure reading order and tab order are logical and sequential for assistive technology users." },
];

// ── Tools Data ───────────────────────────────────────────────────────────────
const TOOLS = [
  {
    icon: FileText, title: "Document Fixer",
    desc: "Upload a Word doc or PDF — AI identifies accessibility issues and returns a remediated version with proper headings, alt text, and structure.",
    tag: ".docx & .pdf", tab: "document",
  },
  {
    icon: Video, title: "Video Transcription",
    desc: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.",
    tag: "MP4, MOV, MP3", tab: "video",
  },
  {
    icon: Code2, title: "Canvas HTML Fixer",
    desc: "Paste your Canvas page HTML — AI fixes heading hierarchy, color contrast, missing alt text, and table issues. Copy the clean version back.",
    tag: "Canvas LMS", tab: "canvas",
  },
  {
    icon: ImageIcon, title: "Alt Text Generator",
    desc: "Upload or link an image. AI generates concise, WCAG-compliant alt text — with long descriptions for complex charts and diagrams.",
    tag: "Images & charts", tab: "alttext",
  },
];

const STATS = [
  { value: "26%", label: "of US adults have a disability", source: "CDC" },
  { value: "97%", label: "of top websites have WCAG failures", source: "WebAIM 2025" },
  { value: "1 in 4", label: "college students has a disability", source: "NCES" },
];

export default function Home() {
  return (
    <div className="min-h-screen" data-testid="home-page">
      <SiteHeader />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hero-dark text-white" aria-labelledby="hero-heading">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          {/* Tagline pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-8">
            <Shield className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            Not Accessible, Not Acceptable™
          </div>

          <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold max-w-3xl mb-6" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Make Every Course Material{" "}
            <span className="text-[#5eead4]">Accessible</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mb-10 leading-relaxed">
            AI-powered tools that fix documents, transcribe videos, clean Canvas HTML, and generate alt text — so every student can learn.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/tools">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4338ca] text-white font-semibold text-sm hover:brightness-110 transition cursor-pointer" data-testid="hero-cta">
                <Zap className="w-4 h-4" aria-hidden="true" />
                Use the Tools
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
            <a
              href="#access-framework"
              onClick={(e) => { e.preventDefault(); document.getElementById('access-framework')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white/80 font-medium text-sm hover:bg-white/10 transition cursor-pointer"
            >
              Learn the ACCESS Framework
            </a>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-10 border-t border-white/10">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="stat-number mb-1">{stat.value}</div>
                <div className="text-sm text-white/90">{stat.label}</div>
                <div className="text-xs text-white/70 mt-0.5">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOOLS OVERVIEW ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28" aria-labelledby="tools-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-xs font-semibold text-accent-foreground mb-4 border border-accent/20">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              AI-Powered
            </div>
            <h2 id="tools-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              Four Tools. <span className="text-[#4338ca]">Zero Excuses.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Each tool is designed for educators who need to fix accessibility issues quickly — no training required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {TOOLS.map((tool) => (
              <Link key={tool.tab} href={`/tools/${tool.tab}`}>
                <div className="tool-card group cursor-pointer h-full" data-testid={`tool-card-${tool.tab}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#4338ca]/10 flex items-center justify-center shrink-0 group-hover:bg-[#4338ca]/20 transition">
                      <tool.icon className="w-5 h-5 text-[#4338ca]" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{tool.title}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">{tool.tag}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#4338ca] transition shrink-0 mt-1" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCESS FRAMEWORK ────────────────────────────────────────────── */}
      <section id="access-framework" className="py-20 sm:py-28 grid-pattern" aria-labelledby="access-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-xs font-semibold text-accent-foreground mb-4 border border-accent/20">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Quick-Check Framework
            </div>
            <h2 id="access-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              The <span className="text-[#4338ca]">ACCESS</span> Framework
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Six checkpoints to quickly evaluate any course material. Memorize the acronym, check every document.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACCESS.map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-card border" data-testid={`access-item-${i}`}>
                <div className="access-letter" aria-hidden="true">{item.letter}</div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{item.word}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ACCESSIBILITY MATTERS ───────────────────────────────────── */}
      <section className="py-20 sm:py-28" aria-labelledby="why-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold mb-6">
              Why This <span className="text-[#4338ca]">Matters</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-12">
              When course materials aren't accessible, students using assistive technology can't complete their work.
              That's not a minor inconvenience — it's an educational barrier that violates federal law and excludes
              learners from the education they deserve.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              <div className="p-5 rounded-xl bg-card border">
                <GraduationCap className="w-8 h-8 text-[#4338ca] mb-3" aria-hidden="true" />
                <h3 className="font-bold mb-1 text-sm">For Educators</h3>
                <p className="text-sm text-muted-foreground">Create materials that every student can use — without hours of manual remediation.</p>
              </div>
              <div className="p-5 rounded-xl bg-card border">
                <Users className="w-8 h-8 text-[#4338ca] mb-3" aria-hidden="true" />
                <h3 className="font-bold mb-1 text-sm">For Students</h3>
                <p className="text-sm text-muted-foreground">Access course content on equal footing — with screen readers, captions, and properly structured documents.</p>
              </div>
              <div className="p-5 rounded-xl bg-card border">
                <Shield className="w-8 h-8 text-[#4338ca] mb-3" aria-hidden="true" />
                <h3 className="font-bold mb-1 text-sm">For Institutions</h3>
                <p className="text-sm text-muted-foreground">Meet ADA, Section 508, and WCAG 2.1 AA requirements — reduce legal risk proactively.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ─────────────────────────────────────────────────── */}
      <section className="hero-dark text-white py-20" aria-labelledby="cta-heading">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Ready to Make Your Content <span className="text-[#5eead4]">Accessible?</span>
          </h2>
          <p className="text-white/90 mb-8">
            Upload a document, paste some HTML, or drop in a video — the AI handles the rest. Free to use.
          </p>
          <Link href="/tools">
            <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#4338ca] text-white font-semibold text-sm hover:brightness-110 transition cursor-pointer">
              <Zap className="w-4 h-4" aria-hidden="true" />
              Use the Tools
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-card border-t py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
              <span className="text-sm text-foreground">
                © 2026 AccessibleCourseMaterials.com — Built by Amanda Carpenter
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              <span className="text-xs text-foreground">WCAG 2.1 AA Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
