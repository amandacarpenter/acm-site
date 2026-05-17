import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CheckCircle2, Mail } from "lucide-react";

export default function Accessibility() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <span className="inline-block bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">Accessibility</span>
          <h1 className="text-4xl font-bold text-[#3a485b] mb-3">Accessibility Statement</h1>
          <p className="text-gray-500 text-sm">Left Coast Learning LLC, doing business as Remedy508 &nbsp;·&nbsp; Last reviewed: May 17, 2026</p>
        </div>

        {/* Commitment callout */}
        <div className="bg-teal-50 border-l-4 border-[#0d9488] p-5 rounded-r-lg mb-10">
          <p className="text-[#0d9488] font-semibold mb-1">Our Commitment</p>
          <p className="text-gray-700">Remedy508 exists to make higher education more accessible. It would be contradictory — and unacceptable — for an accessibility tool to have an inaccessible website. We follow the same standards we help our users meet.</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <Section title="Standards We Follow">
            <ul className="space-y-3">
              {[
                ["WCAG 2.1 Level AA", "Web Content Accessibility Guidelines published by the W3C WAI — the basis of most legal accessibility requirements in higher education"],
                ["Section 508", "Rehabilitation Act of 1973, as amended — governs digital accessibility for institutions receiving federal funding"],
                ["WAI-ARIA 1.2", "Applied where applicable to support dynamic content and custom UI components with proper semantics for assistive technologies"],
              ].map(([std, desc]) => (
                <li key={std} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0d9488] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>{std}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Conformance Status">
            <p>We believe remedy508.com and the Remedy508 application conform to <strong>WCAG 2.1 Level AA</strong>. We actively test and monitor our site for accessibility barriers and address issues as they are identified.</p>
          </Section>

          <Section title="What We Have Done">
            <h3 className="font-semibold text-[#3a485b] mb-2">Design and Structure</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm mb-4">
              <li>Logical, consistent page structure with proper HTML heading hierarchy</li>
              <li>Sufficient color contrast ratios — minimum 4.5:1 for normal text, 3:1 for large text</li>
              <li>Text resizable up to 200% without loss of content or functionality</li>
              <li>Visible focus indicators for all interactive elements</li>
              <li>Responsive design that adapts to different screen sizes and zoom levels</li>
            </ul>
            <h3 className="font-semibold text-[#3a485b] mb-2">Keyboard and Assistive Technology Support</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>All functionality accessible via keyboard without requiring a mouse</li>
              <li>Skip navigation links to bypass repetitive navigation blocks</li>
              <li>Form fields properly labeled and associated with descriptions</li>
              <li>Dynamic content changes announced to screen readers via ARIA live regions</li>
              <li>Modal dialogs trap focus appropriately and return focus on dismissal</li>
            </ul>
          </Section>

          <Section title="Assistive Technology Compatibility">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#3a485b] text-white">
                  <th className="text-left p-3">Assistive Technology</th>
                  <th className="text-left p-3">Browser</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["NVDA (Windows)", "Chrome, Firefox", "Tested"],
                  ["VoiceOver (macOS)", "Safari", "Tested"],
                  ["VoiceOver (iOS)", "Safari Mobile", "Tested"],
                  ["Keyboard-only navigation", "All major browsers", "Tested"],
                  ["High contrast mode", "Windows / macOS", "Supported"],
                  ["Browser zoom (up to 200%)", "All major browsers", "Supported"],
                ].map(([at, browser, status], i) => (
                  <tr key={at} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 font-medium">{at}</td>
                    <td className="p-3">{browser}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Known Limitations">
            <p>We are actively working to identify and address any remaining accessibility barriers. Accessibility work is ongoing, and we recognize that no product is perfect. If you encounter a specific barrier, please tell us — we take every report seriously.</p>
          </Section>

          <Section title="Report an Accessibility Issue">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#0d9488] flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#3a485b] mb-1">Contact Us</p>
                  <p className="text-sm mb-3">Email <a href="mailto:hello@remedy508.com?subject=Accessibility Issue" className="text-[#0d9488] hover:underline">hello@remedy508.com</a> with subject line "Accessibility Issue." Please include:</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>A description of the barrier you encountered</li>
                    <li>The page or feature where you encountered it</li>
                    <li>The assistive technology and browser you were using</li>
                    <li>What you were trying to accomplish</li>
                  </ul>
                  <p className="text-sm mt-3 text-gray-500">We will acknowledge your message within 2 business days.</p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Formal Complaints">
            <p>If you are not satisfied with our response, you may contact:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2 text-sm">
              <li><strong>U.S. Department of Education, Office for Civil Rights (OCR):</strong> <a href="mailto:ocr@ed.gov" className="text-[#0d9488] hover:underline">ocr@ed.gov</a> or 1-800-421-3481</li>
              <li>EU users may contact their national supervisory authority.</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500">We encourage you to contact us first — we are a small, purpose-driven company and we genuinely want to fix issues.</p>
          </Section>

          <Section title="Our Ongoing Commitment">
            <ul className="space-y-2">
              {[
                "Conducting regular accessibility audits as the product evolves",
                "Including accessibility testing as part of our development process for new features",
                "Responding to user-reported accessibility issues in a timely manner",
                "Updating this statement to reflect our current conformance status and known issues",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#0d9488] flex-shrink-0 mt-1" aria-hidden="true" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-500">This statement was last reviewed on May 17, 2026.</p>
          </Section>

          <Section title="Contact">
            <p><strong>Left Coast Learning LLC, doing business as Remedy508</strong><br />
            Email: <a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline">hello@remedy508.com</a><br />
            Website: <a href="https://remedy508.com" className="text-[#0d9488] hover:underline">remedy508.com</a></p>
          </Section>

        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[#3a485b] mb-3 mt-8 pb-2 border-b border-gray-200">{title}</h2>
      <div className="text-gray-700 space-y-3">{children}</div>
    </section>
  );
}

