import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import { ShieldCheck } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import { CheckCircle2 } from "lucide-react";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function Privacy() {
  useDocumentTitle("Privacy Policy | Remedy508");
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main>
      <section className="relative overflow-hidden bg-[#3a485b] py-16 sm:py-20">
        <HeroWatermark corner="left" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Legal
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-white text-sm">Left Coast Learning LLC &nbsp;·&nbsp; Effective: May 17, 2025 &nbsp;·&nbsp; Last reviewed: August 8, 2026</p>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <p>Remedy508 is operated by Left Coast Learning LLC, a California limited liability company ("Left Coast Learning," "we," "us," or "our"). This Privacy Policy explains how we collect, use, and protect information when you use Remedy508 (available at remedy508.com) — a SaaS accessibility tool designed to help higher education professionals remediate inaccessible course materials.</p>
          <p>We take privacy seriously and keep our practices straightforward.</p>

          <Section title="1. Information We Collect">
            <Sub title="Account Information">When you create a Remedy508 account, we collect your email address and the credential information you use to authenticate (managed through Clerk, our authentication provider). We may also collect your name if you provide it.</Sub>
            <Sub title="Uploaded Files and Content">To provide the remediation service, you may upload files such as PDFs, images, video files, and Canvas course content. These files are processed in memory to generate accessible output. <strong>Uploaded files are not retained after your result is returned.</strong> We do not store copies of your uploaded documents.</Sub>
            <Sub title="Free Accessibility Checker">When you use the free checker, document contents are processed locally in your browser and are not uploaded or saved. We retain the filename, file type, check status, score and summary counts when available, and timestamp for internal usage reporting. This metadata is retained for up to 90 days. Avoid including personal or sensitive information in filenames.</Sub>
            <Sub title="Payment Information">Billing is handled by Stripe. We do not collect or store your credit card number, CVV, or banking credentials. We receive only a payment token and summary billing information from Stripe.</Sub>
            <Sub title="Usage and Analytics Data">We collect information about how you use the Service, including pages visited, session duration, browser type, device type, IP address (country-level only), and error logs. This helps us improve the product.</Sub>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide and operate the Service — authenticate accounts, process uploaded files, deliver results</li>
              <li>Process payments and manage subscriptions through Stripe</li>
              <li>Send transactional emails — account confirmations, password resets, processing notifications, receipts</li>
              <li>Improve the product — analyze usage patterns in aggregate or de-identified form</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
            </ul>
          </Section>

          <Section title="3. What We Do Not Do">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>We do not sell your personal information</strong> to third parties for any purpose.</li>
              <li><strong>We do not use your uploaded documents to train AI models.</strong> Content you upload is used solely to generate accessible output for you.</li>
              <li>We do not share your data with third parties for advertising.</li>
              <li>We do not share your information beyond the sub-processors listed below.</li>
            </ul>
          </Section>

          <Section title="4. Sub-Processors">
            <p className="mb-3">We work with a limited set of trusted third-party service providers to operate Remedy508.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#3a485b]">
                  <th className="text-left p-3 text-white font-semibold">Sub-Processor</th>
                  <th className="text-left p-3 text-white font-semibold">Role</th>
                  <th className="text-left p-3 text-white font-semibold">Data Involved</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Railway", "Cloud hosting", "All application data, including uploaded files"],
                  ["Stripe", "Payment processing", "Billing and subscription data"],
                  ["Clerk", "User authentication", "Email address and login credentials"],
                  ["Resend", "Transactional email", "Email address and notification content"],
                  ["Anthropic (Claude)", "AI remediation", "Uploaded file content during processing only"],
                ].map(([sp, role, data], i) => (
                  <tr key={sp} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 font-medium">{sp}</td>
                    <td className="p-3">{role}</td>
                    <td className="p-3">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="5. Cookies and Similar Technologies">
            <p className="mb-3">Remedy508 uses a limited set of cookies required to operate the Service. We do not use advertising or third-party tracking cookies, and we do not sell or share data collected through cookies.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#3a485b]">
                  <th className="text-left p-3 text-white font-semibold">Cookie</th>
                  <th className="text-left p-3 text-white font-semibold">Set By</th>
                  <th className="text-left p-3 text-white font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Authentication / session", "Clerk", "Keeps you signed in and secures your account session. Strictly necessary — the Service cannot function without it."],
                  ["Fraud prevention", "Stripe", "Detects fraudulent payment activity during checkout. Strictly necessary for processing payments securely."],
                  ["Interface preference", "Remedy508", "Remembers minor UI state, such as whether a sidebar is expanded. Functional, not tracking-related."],
                ].map(([cookie, setBy, purpose], i) => (
                  <tr key={cookie} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 font-medium">{cookie}</td>
                    <td className="p-3">{setBy}</td>
                    <td className="p-3">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3">Because these cookies are strictly necessary for account authentication and payment security, no cookie consent banner is used. You can block or delete cookies through your browser settings, but doing so may prevent you from logging in or completing payment. We do not currently use analytics or advertising cookies; if that changes, we will update this section and this policy's effective date.</p>
          </Section>

          <Section title="6. FERPA Compliance">
            <p>Higher education institutions using Remedy508 may upload course materials that contain student educational records covered by FERPA. Left Coast Learning LLC acts as a service provider on behalf of the institution under 34 C.F.R. § 99.31(a)(1). We process student-related data only to perform accessibility remediation, do not use it for any other purpose, do not re-disclose it, and do not retain it after processing is complete.</p>
          </Section>

          <Section title="7. California Residents — CCPA Rights">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Right to Know:</strong> Request disclosure of personal information we've collected, its sources, purposes, and third parties involved.</li>
              <li><strong>Right to Delete:</strong> Request deletion of personal information, subject to legal exceptions.</li>
              <li><strong>Right to Correct:</strong> Request correction of inaccurate information.</li>
              <li><strong>Right to Opt Out:</strong> We do not sell or share personal information. No opt-out is required.</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate for exercising your rights.</li>
            </ul>
            <p className="mt-3">To exercise your rights, email hello@remedy508.com with subject "CCPA Request." We respond within 45 days.</p>
          </Section>

          <Section title="8. European Users — GDPR">
            <p>If you are located in the EEA, UK, or Switzerland, you have rights under the GDPR. We process your data under legal bases including contract performance, legitimate interests, legal obligation, and consent. You have the right to access, rectify, erase, restrict, object, and portability. Contact hello@remedy508.com. Data may be transferred to the U.S. with appropriate safeguards (Standard Contractual Clauses where applicable).</p>
          </Section>

          <Section title="9. Data Retention">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#3a485b]">
                  <th className="text-left p-3 text-white font-semibold">Data Type</th>
                  <th className="text-left p-3 text-white font-semibold">Retention Period</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Uploaded files", "Not retained — deleted immediately after processing"],
                  ["Free checker usage metadata", "Up to 90 days"],
                  ["Processed output", "Available until you delete or subscription ends"],
                  ["Account information", "Retained while subscription is active"],
                  ["Billing records", "As required by law (typically 7 years)"],
                  ["Usage/analytics data", "Aggregate or de-identified form"],
                  ["Support correspondence", "Up to 2 years after last interaction"],
                ].map(([type, period], i) => (
                  <tr key={type} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 font-medium">{type}</td>
                    <td className="p-3">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="10. Data Security">
            <p>We implement industry-standard security including TLS/HTTPS encryption in transit and at rest, access controls, secure infrastructure via Railway, and multi-factor authentication support via Clerk. In the event of a data breach, we will notify you and relevant authorities as required by law.</p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>Remedy508 is designed for higher education professionals. We do not knowingly collect information from children under 13. Contact us if you believe we have done so.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>We may update this policy from time to time. For material changes, we will notify you by updating the effective date and by email or in-app notice. Continued use constitutes acceptance.</p>
          </Section>

          <Section title="13. Contact Us">
            <p><strong>Left Coast Learning LLC, doing business as Remedy508</strong><br />
            Email: <a href="mailto:hello@remedy508.com" className="text-[#0f766e] underline underline-offset-2">hello@remedy508.com</a><br />
            Website: <a href="https://remedy508.com" className="text-[#0f766e] underline underline-offset-2">remedy508.com</a></p>
          </Section>

        </div>
      </div>
      </main>
      <SiteFooter />
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

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-[#3a485b] mb-1">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
