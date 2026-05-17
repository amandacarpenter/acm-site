import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <span className="inline-block bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">Legal</span>
          <h1 className="text-4xl font-bold text-[#3a485b] mb-3">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Left Coast Learning LLC, doing business as Remedy508 &nbsp;·&nbsp; Effective: May 17, 2025 &nbsp;·&nbsp; Last reviewed: May 17, 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <p>These Terms of Service ("Terms") govern your access to and use of Remedy508, operated by Left Coast Learning LLC, a California limited liability company ("Left Coast Learning," "we," "us," or "our"). By creating an account or accessing any part of the Service, you agree to be bound by these Terms.</p>

          <Section title="1. Acceptance of Terms">
            <p>By using Remedy508, you represent that you are at least 18 years old, accessing the Service in a professional capacity, and have authority to bind your organization if accepting on behalf of one. If you do not agree to these Terms, do not use the Service.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Remedy508 is a web-based accessibility remediation tool that uses AI-assisted processing to remediate PDF documents, generate alt text for images, create video captions and transcripts, and process Canvas course content for WCAG compliance. The Service is intended to assist human professionals — it does not replace professional judgment, institutional accessibility policies, or legal counsel regarding compliance obligations.</p>
          </Section>

          <Section title="3. Account Registration and Responsibilities">
            <p>You must provide a valid email address and complete authentication through Clerk. You are responsible for maintaining the confidentiality of your login credentials and all activity under your account. Individual accounts may not be shared. Notify us immediately at <a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline">hello@remedy508.com</a> if you suspect unauthorized access.</p>
          </Section>

          <Section title="4. Subscription Plans and Billing">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4 space-y-3">
              <div>
                <p className="font-semibold text-[#3a485b]">Individual Plan</p>
                <p className="text-sm">$19/month or $149/year. For individual professionals.</p>
              </div>
              <div>
                <p className="font-semibold text-[#3a485b]">Institution Plan</p>
                <p className="text-sm">Custom pricing for institutional access. Contact <a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline">hello@remedy508.com</a> for details.</p>
              </div>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>Billing:</strong> Handled by Stripe. Subscriptions renew automatically at the end of each billing period.</li>
              <li><strong>Cancellation:</strong> Cancel anytime through account settings or by emailing us. Cancellation takes effect at the end of the current billing period. <strong>We do not provide refunds for the current billing period.</strong></li>
              <li><strong>Price Changes:</strong> We may change pricing with at least 30 days' notice, applying to your next renewal.</li>
              <li><strong>Taxes:</strong> You are responsible for applicable taxes where we are not required to collect them.</li>
            </ul>
          </Section>

          <Section title="5. Acceptable Use">
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Upload illegal, defamatory, or infringing content, or content you do not have rights to submit</li>
              <li>Attempt to reverse engineer, decompile, or derive source code from the Service</li>
              <li>Probe, scan, or test vulnerabilities of the Service's systems</li>
              <li>Introduce malware, viruses, or other harmful code</li>
              <li>Use automated bots or scripts in unauthorized ways</li>
              <li>Resell, sublicense, or use the Service to build a competing product without written permission</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p className="mb-3">Remedy508, including its software, design, interface, documentation, trademarks, and logos, is owned by Left Coast Learning LLC. You receive a limited, non-exclusive, non-transferable, revocable license to access the Service during your active subscription.</p>
            <p><strong>Your content:</strong> You retain full ownership of all content you upload. You grant us a limited license to process your content solely to provide the Service. This license terminates when your files are deleted. We do not claim any ownership interest in your content.</p>
          </Section>

          <Section title="7. AI Processing Disclosure">
            <div className="bg-teal-50 border-l-4 border-[#0d9488] p-4 rounded-r-lg text-sm">
              <p className="font-semibold text-[#0d9488] mb-1">Important</p>
              <p>Remedy508 uses Anthropic's Claude models to process uploaded content. <strong>We do not use your uploaded content to train AI models</strong>, and our agreement with Anthropic does not permit them to use API inputs for model training. AI-generated output may contain errors — you are responsible for reviewing output before use.</p>
            </div>
          </Section>

          <Section title="8. Accessibility Compliance Disclaimer">
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg text-sm">
              <p className="font-semibold text-amber-700 mb-1">Important</p>
              <p>Use of Remedy508 does not guarantee legal compliance. Accessibility compliance under the ADA, Section 508, WCAG, or any other law is a complex, context-dependent determination. <strong>You remain responsible for your institution's accessibility obligations.</strong> We make no warranty that the Service will render any content fully accessible or satisfy any legal requirement.</p>
            </div>
          </Section>

          <Section title="9. Third-Party Services">
            <p>The Service integrates with Stripe, Clerk, Railway, Resend, and Anthropic. Your use of those services is subject to their respective terms and privacy policies. We are not responsible for third-party practices.</p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p className="text-sm uppercase font-medium text-gray-600">The Service is provided "as is" and "as available" without warranties of any kind, express or implied. To the fullest extent permitted by law, Left Coast Learning LLC disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Service will be uninterrupted or error-free.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p className="text-sm uppercase font-medium text-gray-600">To the fullest extent permitted by law, Left Coast Learning LLC shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages. Our total liability shall not exceed the greater of (a) fees you paid in the prior 12 months, or (b) $100.</p>
          </Section>

          <Section title="12. Indemnification">
            <p>You agree to indemnify and hold harmless Left Coast Learning LLC and its officers, directors, employees, and agents from claims arising out of your use of the Service in violation of these Terms, your User Content, or your violation of applicable law.</p>
          </Section>

          <Section title="13. Termination">
            <p>You may terminate your account at any time by contacting hello@remedy508.com. We may suspend or terminate your access if you violate these Terms, we are required to by law, or we discontinue the Service. Upon termination, your access ends and files are deleted per our retention policy.</p>
          </Section>

          <Section title="14. Governing Law and Dispute Resolution">
            <p>These Terms are governed by the laws of the State of California. We encourage informal resolution first (hello@remedy508.com). Unresolved disputes shall be submitted to binding arbitration under JAMS Streamlined Rules in California. Class action waiver applies to the fullest extent permitted by law.</p>
          </Section>

          <Section title="15. Changes to These Terms">
            <p>We may update these Terms with at least 14 days' notice for material changes, via email or in-app notice. Continued use after the effective date constitutes acceptance.</p>
          </Section>

          <Section title="16. Contact Us">
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

function LegalFooter() {
  return (
    <footer className="bg-gray-900 py-10" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-400">© 2026 Remedy508 — Left Coast Learning LLC</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Privacy Policy</span></Link>
            <Link href="/terms"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Terms of Service</span></Link>
            <Link href="/accessibility"><span className="text-xs text-gray-400 hover:text-white transition cursor-pointer">Accessibility</span></Link>
            <span className="text-xs text-gray-500">Not Accessible, Not Acceptable™</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
