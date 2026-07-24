import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
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
        a: "Your subscription includes access to five tools: Document Fixer (Word and PDF), Complex PDF (multi-column, tables, tagged PDF), Video Transcription, Canvas HTML Fixer, and Alt Text Generator. Each tool targets a specific, common accessibility problem in higher ed content.",
      },
      {
        q: "Does Remedy508 make my content fully compliant?",
        a: "Remedy508 handles the most common remediation tasks automatically and significantly reduces accessibility barriers. That said, output — especially alt text and transcriptions — should be reviewed before publishing. No automated tool can guarantee full compliance on every document; human review remains part of a complete workflow.",
      },
      {
        q: "How does remediation work — is it fully automatic?",
        a: "Most tools require minimal input: upload your file, select the tool, download the output. Some tools like Alt Text Generator produce suggestions you review and confirm. The goal is to do the heavy lifting so you're editing, not building from scratch.",
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
        a: "Document Fixer handles Word (.docx) and PDF files. Complex PDF is built for advanced layouts — multi-column text, tables, forms, and scanned documents. Video Transcription accepts common video and audio formats (MP4, MOV, MP3). Canvas HTML Fixer works with HTML content directly from Canvas LMS.",
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
        a: "Individual plans are $19/month or $149/year (save 35%). Team plans are $149/seat/year (annual only, 2+ seats) — built for colleges, universities, government agencies, and healthcare organizations.",
      },
      {
        q: "What does the Individual plan include?",
        a: "The Individual plan gives you 50 documents per month across Document Fixer and Complex PDF. Alt Text Generator, Canvas HTML Fixer, and Video Transcription are unlimited. Licensed for single-user personal use only.",
      },
      {
        q: "What does the Team plan include?",
        a: "Team plans include everything in Individual, plus an admin dashboard, team member management (invite by link or email), per-user document history, and 75 documents/seat/month pooled across your team. Pay by credit card or invoice/PO.",
      },
      {
        q: "What counts as a document?",
        a: "Each file you upload and process counts as one document, regardless of page count. The monthly limit applies to Document Fixer and Complex PDF. Alt Text Generator, Canvas HTML Fixer, and Video Transcription are unlimited on all paid plans.",
      },
      {
        q: "Can I cancel my plan?",
        a: "Monthly Individual plans can be cancelled at any time — you won't be billed again. Annual plans (Individual and Team) are billed upfront and are non-refundable, but you can cancel before your renewal date to stop future charges. Your access continues until the end of the paid period.",
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
        <span className="text-base font-bold text-[#3a485b] group-hover:text-[#0d9488] transition-colors leading-snug">
          {item.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? "rotate-180 text-[#0d9488]" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="pb-5 text-base text-gray-900 leading-relaxed pr-8">
          {item.a}
        </p>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-[#3a485b] py-16 sm:py-20" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Got questions?
          </div>
          <h1 id="faq-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Frequently Asked <span className="text-white">Questions</span>
          </h1>
          <p className="text-lg text-white">
            Everything you need to know about Remedy508. Can't find what you're looking for?{" "}
            <a href="/contact" className="text-[#0d9488] hover:underline font-medium">
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
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0d9488] mb-4">
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
      <section className="bg-[#3a485b] py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Still have questions?
          </h2>
          <p className="text-white mb-8 text-lg">
            We're happy to walk you through anything — especially for institution inquiries.
          </p>
          <a
            href="/contact"
            className="inline-block px-6 py-3 rounded-lg bg-[#0d9488] text-white font-semibold hover:bg-[#0f766e] transition"
          >
            Get in Touch
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
