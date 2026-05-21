import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Mail, Clock, MessageSquare, Building2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "General Question", message: "" });
  const [loading, setLoading] = useState(false);

  const subjects = [
    "General Question",
    "Technical Support",
    "Accessibility Issue",
    "Institution / Pricing Inquiry",
    "Partnership",
    "Other",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("email", form.email);
      data.append("subject", form.subject);
      data.append("message", form.message);
      await fetch("https://formspree.io/f/xojbekbr", {
        method: "POST",
        body: data,
        headers: { "Accept": "application/json" },
      });
    } catch (_) {}
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="bg-[#3a485b] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Support
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">Get in Touch</h1>
          <p className="text-white max-w-xl mx-auto">Have a question, need help with a document, or want to talk about an institution plan? We're here.</p>
        </div>
      </section>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Info cards */}
          <div className="space-y-4">
            <InfoCard
              icon={<Mail className="w-5 h-5 text-[#0d9488]" />}
              title="Email Us"
              body={<a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline text-sm">hello@remedy508.com</a>}
            />
            <InfoCard
              icon={<Clock className="w-5 h-5 text-[#0d9488]" />}
              title="Response Time"
              body={<p className="text-sm text-gray-600">We respond within one business day. Accessibility issues are prioritized.</p>}
            />
            <InfoCard
              icon={<Building2 className="w-5 h-5 text-[#0d9488]" />}
              title="Institution Inquiries"
              body={<p className="text-sm text-gray-600">Looking for a campus-wide plan? Use the form and select "Institution / Pricing Inquiry."</p>}
            />
            <InfoCard
              icon={<MessageSquare className="w-5 h-5 text-[#0d9488]" />}
              title="Accessibility Issues"
              body={<p className="text-sm text-gray-600">Found an accessibility barrier on our site? We take these seriously. Use subject "Accessibility Issue."</p>}
            />
          </div>

          {/* Contact form */}
          <div className="md:col-span-2">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <CheckCircle2 className="w-14 h-14 text-[#0d9488] mb-4" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-[#3a485b] mb-2">Message received</h2>
                <p className="text-gray-500">We'll get back to you within one business day.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "General Question", message: "" }); }}
                  className="mt-6 text-sm text-[#0d9488] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 bg-gray-50 rounded-2xl p-8 border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[#3a485b] mb-1">Name</label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#3a485b] mb-1">Email</label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                      placeholder="you@institution.edu"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-[#3a485b] mb-1">Subject</label>
                  <select
                    id="subject"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent bg-white"
                  >
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-[#3a485b] mb-1">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent resize-none"
                    placeholder="How can we help?"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0d9488] hover:bg-[#0b7a6e] text-white font-semibold py-3 rounded-lg transition disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-[#3a485b] text-sm mb-1">{title}</p>
        {body}
      </div>
    </div>
  );
}

