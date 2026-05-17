import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { CheckCircle2, Users } from "lucide-react";

const USE_CASES = [
  {
    tag: "Instructional Designers",
    headline: "You're Inheriting Someone Else's Inaccessible Course",
    body: "You didn't create the problem — but you're the one fixing it. You're handed a course with a hundred PDFs, zero alt text, and a deadline. Remedy508 gives you a systematic way to work through backlogs: process documents, generate alt text, and fix Canvas HTML without manually editing every page. It's a significant multiplier on your time.",
    bullets: [
      "Remediate Word and PDF course materials with Document Fixer and Complex PDF",
      "Generate and review alt text for images across your content library",
      "Clean up Canvas LMS pages to meet WCAG 2.1 AA standards with Canvas HTML Fixer",
    ],
  },
  {
    tag: "Faculty & Adjunct Instructors",
    headline: "You Got a Compliance Notice and Have No Idea Where to Start",
    body: "You teach. You didn't go to grad school to learn about tagged PDFs and color contrast ratios. When a student files an accessibility complaint or your department flags your course materials, Remedy508 gets you from inaccessible to remediated without requiring you to become an expert. Upload your syllabus, your slides, your handouts — and get back to teaching.",
    bullets: [
      "Fix inaccessible Word docs and PDFs from your existing course materials",
      "Add accurate, descriptive alt text to images in seconds",
      "Generate captions and transcripts for lecture recordings",
    ],
  },
  {
    tag: "Disability Services Offices",
    headline: "Your Accommodation Requests Are Outpacing Your Capacity",
    body: "The number of students requesting accessible materials keeps growing. Your staff doesn't. Remedy508 helps disability services teams handle remediation requests faster — without outsourcing or adding headcount. Complex PDF is especially useful for research articles, scanned readings, and multi-column documents that standard tools can't handle.",
    bullets: [
      "Remediate complex, multi-column, and scanned PDFs that standard tools fail on",
      "Turn around student accommodation requests faster by reducing manual work",
      "Produce transcripts for audio and video content as part of your standard workflow",
    ],
  },
  {
    tag: "Community Colleges & Institutions",
    headline: "Compliance Is a Campus-Wide Problem, Not a One-Department Fix",
    body: "With ADA Title II updates applying directly to digital course content, \"we'll get to it\" is no longer a defensible position. Community colleges face this pressure with smaller teams and tighter margins than four-year institutions. An Institution plan gives your entire campus — faculty, instructional designers, disability services — access to the same remediation tools under one roof.",
    bullets: [
      "Deploy a consistent, standards-aligned remediation workflow across departments",
      "Reduce reliance on expensive third-party remediation vendors for routine fixes",
      "Give every team member tools producing WCAG 2.1 AA and ADA Title II-aligned output",
    ],
  },
];

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-white border-b py-16 sm:py-20" aria-labelledby="usecases-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/20 text-sm font-medium text-[#0d9488] mb-6">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            Built for Higher Ed
          </div>
          <h1 id="usecases-heading" className="text-4xl sm:text-5xl font-bold text-[#3a485b] mb-4">
            Whoever you are,{" "}
            <span className="text-[#0d9488]">we've got you.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Accessibility compliance in higher education doesn't fall to one person — it lands on everyone. Remedy508 is built around the specific workflows, pressures, and file types that higher ed teams deal with every day.
          </p>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 flex-1" aria-label="Use cases">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          {USE_CASES.map((uc, i) => (
            <div
              key={uc.tag}
              className={`rounded-2xl border border-gray-100 overflow-hidden ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
            >
              <div className="p-8 sm:p-10">
                {/* Tag */}
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#0d9488] mb-3">
                  {uc.tag}
                </span>
                {/* Headline */}
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3a485b] mb-4 leading-snug">
                  {uc.headline}
                </h2>
                {/* Body */}
                <p className="text-gray-500 leading-relaxed mb-6">
                  {uc.body}
                </p>
                {/* Bullets */}
                <ul className="space-y-2.5">
                  {uc.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#0d9488] flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-gray-600">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#3a485b] py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Not Accessible, Not Acceptable.™
          </h2>
          <p className="text-white/70 mb-8">
            Start remediating your content today — no technical expertise required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup">
              <span className="inline-block px-6 py-3 rounded-lg bg-[#0d9488] text-white font-semibold hover:bg-[#0f766e] transition cursor-pointer">
                Get Started
              </span>
            </Link>
            <Link href="/pricing">
              <span className="inline-block px-6 py-3 rounded-lg border border-white/30 text-white font-semibold hover:bg-white/10 transition cursor-pointer">
                View Pricing
              </span>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
