import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronDown, HelpCircle, FileText, Image, Video, Code } from "lucide-react";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface FAQItem {
  q: string;
  a: ReactNode;
}

// Shared per-tool credit breakdown, reused wherever this FAQ needs it so the
// wording/format stays in sync with the Dashboard's "How are my credits
// used?" card.
function CreditBreakdown() {
  return (
    <>
      <p className="mb-3">Credits are shared across all four tools.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Docs</p>
            <p className="text-xs text-gray-500 leading-tight">1 credit / page</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
            <Image className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Image</p>
            <p className="text-xs text-gray-500 leading-tight">1 credit / image</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
            <Video className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy Video</p>
            <p className="text-xs text-gray-500 leading-tight">1 credit / transcript</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white">
            <Code className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a485b] leading-tight">Remedy HTML</p>
            <p className="text-xs text-gray-500 leading-tight">3 credits / fix</p>
          </div>
        </div>
      </div>
    </>
  );
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Free Accessibility Checker",
    items: [
      {
        q: "What is the Free Accessibility Checker?",
        a: "It is a free, browser-based check that reviews documents for common machine-detectable accessibility barriers. You do not need an account, and the check uses no Remedy508 Credits.",
      },
      {
        q: "How do I check a PDF for accessibility?",
        a: (
          <p>
            Open the{" "}
            <Link href="/accessibility-checker">
              <span className="font-semibold text-[#0f766e] underline underline-offset-2 cursor-pointer">
                free PDF accessibility checker
              </span>
            </Link>
            , choose your PDF, and review the results for tags, headings, tables, alternative text, language, links,
            forms, and text layers. The automated report helps you decide what needs manual review or remediation.
          </p>
        ),
      },
      {
        q: "Does Remedy508 upload or save my document?",
        a: "No. The document contents stay in your browser and are not uploaded or saved. Remedy508 records the filename, file type, check outcome, and time for internal usage reporting, and retains that metadata for up to 90 days.",
      },
      {
        q: "Does a high score mean my document is fully accessible?",
        a: "No. The score summarizes Remedy508's automated findings only; it is not a compliance certification and is not the same as an Adobe Acrobat score. Manual review is still needed for reading order, meaningful alternative text, visual logic, and other context-dependent requirements.",
      },
      {
        q: "What is the difference between the checker and Remedy Docs?",
        a: "The Free Accessibility Checker identifies and explains common barriers. Remedy Docs is the paid remediation service that provides automated remediation assistance and produces an updated document.",
      },
    ],
  },
  {
    title: "About Remedy508",
    items: [
      {
        q: "What is Remedy508?",
        a: "Remedy508 is an accessibility remediation platform built for higher education. It helps faculty, instructional designers, and disability services staff fix inaccessible documents, videos, and course content to meet WCAG 2.1 AA, Section 508, and ADA Title II standards — without needing to be a technical expert.",
      },
      {
        q: "Who is Remedy508 for?",
        a: "Remedy508 is designed for faculty, educators, instructional designers, and disability services staff in higher education. If you're responsible for making course materials accessible — whether that's a single syllabus or an entire course catalog — this tool was built for you.",
      },
      {
        q: "What tools does Remedy508 include?",
        a: "Your subscription includes access to four tools: Remedy Docs (Word and PDF, including multi-column layouts, tables, and scanned pages), Remedy Video (transcription), Remedy HTML (Canvas LMS pages), and Remedy Image (alt text). Each tool targets a specific, common accessibility problem in higher ed content.",
      },
      {
        q: "Does Remedy508 make my content fully compliant?",
        a: "Remedy508 handles the most common remediation tasks automatically and significantly reduces accessibility barriers. That said, output — especially alt text and transcriptions — should be reviewed before publishing. No automated tool can guarantee full compliance on every document; human review remains part of a complete workflow.",
      },
      {
        q: "How does remediation work — is it fully automatic?",
        a: "Most tools require minimal input: upload your file, select the tool, download the output. Some tools like Remedy Image produce suggestions you review and confirm. The goal is to do the heavy lifting so you're editing, not building from scratch.",
      },
      {
        q: "What accessibility standards does Remedy508 support?",
        a: "Remedy508 targets WCAG 2.1 AA, which forms the technical backbone of Section 508 (federal) and ADA Title II (recently updated for higher ed). If your institution needs to demonstrate compliance with any of these, Remedy508's output is aligned to those benchmarks.",
      },
    ],
  },
  {
    title: "Files & Privacy",
    items: [
      {
        q: "What file types are supported?",
        a: "Remedy Docs handles Word (.docx) and PDF files, including advanced layouts — multi-column text, tables, forms, and scanned documents. It automatically detects which kind of document you've uploaded and applies the right remediation approach. Remedy Video accepts common video and audio formats (MP4, MOV, MP3). Remedy HTML works with HTML content directly from Canvas LMS.",
      },
      {
        q: "What happens to my files after I upload them?",
        a: "Files are processed in memory and not retained after your result is returned. We do not store copies of your uploaded documents, and we do not use your content to train AI models or share it with third parties.",
      },
      {
        q: "Is Remedy508 secure enough for institutional use?",
        a: "Remedy508 is designed with institutional use in mind. For questions about data residency, FERPA considerations, or security documentation required by your IT or procurement team, contact us directly — we're happy to provide what you need.",
      },
      {
        q: "Can I upload files that contain student information?",
        a: "We recommend avoiding files with personally identifiable student information (PII) unless your institution's data policies allow it. For most use cases — syllabi, course readings, instructional content — this isn't a concern.",
      },
    ],
  },
  {
    title: "Plans & Billing",
    items: [
      {
        q: "How much does Remedy508 cost?",
        a: "Individual plans are $19/month or $199/year (save 13%). Team plans are $249/seat/year (annual only, 2+ seats) — built for colleges, universities, government agencies, and healthcare organizations.",
      },
      {
        q: "What does the Individual plan include?",
        a: "The Individual plan gives you 130 Credits per month, shared across all four tools. Licensed for single-user personal use only. See \"What is a Credit?\" below for the full breakdown.",
      },
      {
        q: "What does the Team plan include?",
        a: "Team plans include everything in Individual, plus an admin dashboard, team member management (invite by link or email), per-user document history, and 145 Credits/seat/month — each teammate gets their own 145, not a shared pool. Pay by credit card or invoice/PO.",
      },
      {
        q: "What is a Credit?",
        a: (
          <>
            <CreditBreakdown />
            <p className="mt-2">
              Individual documents are capped at 50 pages, and Credits reset monthly on the anniversary of your signup date. Need more? You can top up anytime with a Credit pack.
            </p>
          </>
        ),
      },
      {
        q: "Can I cancel my plan?",
        a: "Monthly Individual plans can be cancelled at any time — you won't be billed again. Annual plans (Individual and Team) are paid in full upfront and are not refundable, but you can cancel before your renewal date to stop future charges. Your access continues until the end of the paid period.",
      },
      {
        q: "Do you offer invoice or PO billing?",
        a: "Yes — the Team plan supports invoice and PO billing, making it easy for institutions to route payment through procurement. Select 'Pay by invoice / PO' when choosing your seats and we'll send an invoice within one business day.",
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="w-full text-left py-5 flex items-start justify-between gap-4 group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-base font-bold text-[#3a485b] group-hover:text-[#0f766e] transition-colors leading-snug">
          {item.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? "rotate-180 text-[#0f766e]" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="pb-5 text-base text-gray-900 leading-relaxed pr-8">
          {item.a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  useDocumentTitle("Document Accessibility & PDF Remediation FAQ | Remedy508");
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#3a485b] py-16 sm:py-20" aria-labelledby="faq-heading">
        <HeroWatermark corner="right" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Got questions?
          </div>
          <h1 id="faq-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            Frequently Asked<br />Questions
          </h1>
          <p className="text-lg text-white">
            Answers about the free document accessibility checker, PDF and Word remediation, privacy, WCAG, Section 508, plans, and Credits. Can't find what you're looking for?{" "}
              <a href="/contact" className="text-white underline underline-offset-2 font-semibold">
              Contact us
            </a>.
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="py-16 flex-1" aria-label="FAQ content">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-12">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0f766e] mb-4">
                {section.title}
              </h2>
              <div className="bg-white border border-gray-100 rounded-2xl px-6 divide-y divide-gray-100">
                {section.items.map((item) => (
                  <FAQAccordion key={item.q} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#3a485b] py-16">
        <HeroWatermark corner="left" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Still have questions?
          </h2>
          <p className="text-white mb-8 text-lg">
            We're happy to walk you through anything — especially for institution inquiries.
          </p>
          <a
            href="/contact"
            className="inline-block px-6 py-3 rounded-lg bg-[#0f766e] text-white font-semibold hover:bg-[#115e59] transition"
          >
            Get in Touch
          </a>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
