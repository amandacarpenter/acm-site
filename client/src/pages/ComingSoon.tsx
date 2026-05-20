import { useState } from "react";
import logoUrl from "@/assets/logo.png";

const ZOHO_FORM_URL =
  "https://forms.zohopublic.com/helloreme1/form/Email/formperma/RQoS1mMAxeCWXFpdJLynieXn4CVBTqnCCjZPQ6ymHaY";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    try {
      // Submit to Zoho Forms via fetch (no-cors — Zoho receives it)
      await fetch(ZOHO_FORM_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Email: email, zf_referrer_name: "", zf_redirect_url: "", zc_gad: "" }),
      });
    } catch (_) {
      // no-cors always throws — that's expected, submission still goes through
    }

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      {/* Logo */}
      <img
        src={logoUrl}
        alt="Remedy508"
        className="mb-10"
        style={{ height: 56, width: "auto" }}
      />

      {/* Heading */}
      <h1 className="text-4xl sm:text-5xl font-bold text-[#111827] mb-4 tracking-tight">
        Something big is coming.
      </h1>
      <p className="text-gray-500 text-lg max-w-md mb-10">
        Remedy508 is almost ready. Enter your email and we'll let you know the moment we launch.
      </p>

      {/* Email form */}
      {submitted ? (
        <div className="bg-[#0d9488]/10 border border-[#0d9488]/30 rounded-xl px-6 py-4 text-[#0d9488] font-medium">
          You're on the list — we'll be in touch!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition disabled:opacity-60"
          >
            {loading ? "Sending..." : "Notify me"}
          </button>
        </form>
      )}

      {/* Footer */}
      <p className="text-gray-400 text-xs mt-12">
        © {new Date().getFullYear()} Remedy508 — Left Coast Learning LLC
      </p>
    </div>
  );
}
