import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText, Video, Code2, ImageIcon, ArrowRight, CheckCircle2,
  Zap, Shield, GraduationCap, Users, Sparkles, ChevronRight, BookOpen
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
                Get Started
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

      {/* ── WCAG 2.1 AA SECTION ── */}
      <section className="py-20 sm:py-28 bg-[#3a485b]" aria-labelledby="wcag-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-white mb-4 border border-white/20">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Standards Reference
            </div>
            <h2 id="wcag-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
              WCAG 2.1 Level AA <span className="text-[#0d9488]">Explained</span>
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
                    <div className="text-xs text-gray-400 font-normal">Information must be presentable in ways users can perceive</div>
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
                    <div key={item.code} className="flex gap-3">
                      <span className="text-[10px] font-mono font-bold text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded h-fit mt-0.5 shrink-0">{item.code}</span>
                      <div>
                        <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
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
                    <div className="text-xs text-gray-400 font-normal">Interface components must be operable by all users</div>
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
                    <div key={item.code} className="flex gap-3">
                      <span className="text-[10px] font-mono font-bold text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded h-fit mt-0.5 shrink-0">{item.code}</span>
                      <div>
                        <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
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
                    <div className="text-xs text-gray-400 font-normal">Content and operation must be understandable</div>
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
                    <div key={item.code} className="flex gap-3">
                      <span className="text-[10px] font-mono font-bold text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded h-fit mt-0.5 shrink-0">{item.code}</span>
                      <div>
                        <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
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
                    <div className="text-xs text-gray-400 font-normal">Content must be interpreted by assistive technologies</div>
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
                    <div key={item.code} className="flex gap-3">
                      <span className="text-[10px] font-mono font-bold text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded h-fit mt-0.5 shrink-0">{item.code}</span>
                      <div>
                        <span className="text-sm font-semibold text-[#3a485b]">{item.name} — </span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          <p className="text-center text-xs text-white/40 mt-6">
            Source:{" "}
            <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0d9488] transition">
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
            Individual or institution — straightforward pricing built for higher education.
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

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                © 2026 Remedy508 — Left Coast Learning LLC
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
              <Link href="/privacy"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Privacy Policy</span></Link>
              <Link href="/terms"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Terms of Service</span></Link>
              <Link href="/accessibility"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Accessibility</span></Link>
              <Link href="/contact"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Contact</span></Link>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
                <span className="text-xs text-gray-400">WCAG 2.1 AA</span>
              </div>
              <Link href="/tools">
                <span className="text-xs text-gray-600 hover:text-gray-400 transition cursor-pointer">©</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
