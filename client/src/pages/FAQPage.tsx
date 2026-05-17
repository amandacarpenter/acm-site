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
        a: "Individual plans start at $9/month (Starter), $19/month (Pro), or $29/month (Unlimited). All plans are available at a discount billed annually. Institution plans start at $299/month with custom pricing based on your institution's size and needs.",
      },
      {
        q: "What's the difference between the Individual plans?",
        a: "Starter ($9/mo) gives you 15 documents per month — ideal for faculty with occasional needs. Pro ($19/mo) gives you 50 documents per month and adds the Complex PDF tool. Unlimited ($29/mo) removes all document limits and is best for instructional designers or disability services staff handling large backlogs.",
      },
      {
        q: "What counts as a document?",
        a: "Each file you upload counts as one document, regardless of page count. Video and audio transcriptions also count as one document each.",
      },
      {
        q: "Can I upgrade plans?",
        a: "Yes — upgrade at any time. If you move from an Individual plan to Institution, we'll apply any remaining subscription credit to your new plan.",
      },
      {
        q: "Do you offer discounts for community colleges?",
        a: "We understand community colleges often face the steepest compliance pressure with the tightest budgets. Reach out to discuss institution pricing — we're committed to making Remedy508 accessible to the institutions that need it most.",
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full text-left py-5 flex items-start justify-between gap-4 group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[#3a485b] group-hover:text-[#0d9488] transition-colors leading-snug">
          {item.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? "rotate-180 text-[#0d9488]" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="pb-5 text-sm text-gray-500 leading-relaxed pr-8">
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
      <section className="bg-white border-b py-16 sm:py-20" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/20 text-sm font-medium text-[#0d9488] mb-6">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Got questions?
          </div>
          <h1 id="faq-heading" className="text-4xl sm:text-5xl font-bold text-[#3a485b] mb-4">
            Frequently Asked <span className="text-[#0d9488]">Questions</span>
          </h1>
          <p className="text-lg text-gray-500">
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
              <div className="bg-white border border-gray-100 rounded-2xl px-6 divide-y-0">
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
          <p className="text-white/70 mb-8">
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
