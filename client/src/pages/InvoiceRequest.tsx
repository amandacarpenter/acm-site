import { useState } from "react";
import { useLocation } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function InvoiceRequest() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const defaultSeats = parseInt(params.get("seats") || "2");

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    institutionName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    institutionType: "",
    seats: defaultSeats,
    poNumber: "",
    timeline: "",
    notes: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "seats" ? Math.max(2, parseInt(value) || 2) : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/invoice-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        alert("Something went wrong. Please email us at hello@remedy508.com.");
      }
    } catch {
      alert("Something went wrong. Please email us at hello@remedy508.com.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0d9488] bg-white";
  const labelClass = "block text-sm font-semibold text-[#3a485b] mb-1.5";

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#0d9488]/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-[#0d9488]" />
          </div>
          <h1 className="text-3xl font-bold text-[#3a485b] mb-4">Thanks. We're on it.</h1>
          <p className="text-gray-500 max-w-md mb-2">
            We'll email you an invoice within one business day. Once paid, your team dashboard will be ready to set up.
          </p>
          <p className="text-sm text-gray-400">Questions? Email us at <a href="mailto:hello@remedy508.com" className="text-[#0d9488] underline">hello@remedy508.com</a></p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-[#3a485b] py-16 sm:py-20" aria-labelledby="invoice-heading">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h1 id="invoice-heading" className="text-4xl font-bold text-white mb-3">
            Request an Invoice
          </h1>
          <p className="text-white/70">We'll send your invoice within one business day.</p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 space-y-5">

            <div>
              <label htmlFor="institutionName" className={labelClass}>Institution / Organization name *</label>
              <input id="institutionName" name="institutionName" required value={form.institutionName} onChange={handleChange} className={inputClass} placeholder="e.g. Santa Ana College" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactName" className={labelClass}>Billing contact name *</label>
                <input id="contactName" name="contactName" required value={form.contactName} onChange={handleChange} className={inputClass} placeholder="Jane Smith" />
              </div>
              <div>
                <label htmlFor="contactEmail" className={labelClass}>Billing contact email *</label>
                <input id="contactEmail" name="contactEmail" type="email" required value={form.contactEmail} onChange={handleChange} className={inputClass} placeholder="jane@college.edu" />
              </div>
            </div>

            <div>
              <label htmlFor="contactPhone" className={labelClass}>Billing contact phone <span className="font-normal text-gray-400">(optional)</span></label>
              <input id="contactPhone" name="contactPhone" type="tel" value={form.contactPhone} onChange={handleChange} className={inputClass} placeholder="(555) 555-5555" />
            </div>

            <div>
              <label htmlFor="institutionType" className={labelClass}>Institution type *</label>
              <select id="institutionType" name="institutionType" required value={form.institutionType} onChange={handleChange} className={inputClass}>
                <option value="">Select…</option>
                <option>Higher Ed</option>
                <option>K-12</option>
                <option>Government</option>
                <option>Healthcare</option>
                <option>Nonprofit</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="seats" className={labelClass}>Number of seats needed *</label>
              <input id="seats" name="seats" type="number" min={2} required value={form.seats} onChange={handleChange} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">
                {form.seats} seat{form.seats !== 1 ? "s" : ""} × $149 = ${(form.seats * 149).toLocaleString()}/year
              </p>
            </div>

            <div>
              <label htmlFor="poNumber" className={labelClass}>PO number <span className="font-normal text-gray-400">(if available — optional)</span></label>
              <input id="poNumber" name="poNumber" value={form.poNumber} onChange={handleChange} className={inputClass} placeholder="PO-12345" />
            </div>

            <div>
              <label htmlFor="timeline" className={labelClass}>Timeline *</label>
              <select id="timeline" name="timeline" required value={form.timeline} onChange={handleChange} className={inputClass}>
                <option value="">Select…</option>
                <option>This month</option>
                <option>This quarter</option>
                <option>Just researching</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className={labelClass}>Notes <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} className={inputClass} rows={3} placeholder="Any additional context, special requirements, or questions…" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-base transition bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Submit Invoice Request"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By submitting, you confirm this request is for institutional use. Misuse may result in account suspension per our Terms of Service.
            </p>
          </form>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
