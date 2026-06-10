import { useState } from "react";
import logoUrl from "@/assets/logo.png";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await fetch("https://formspree.io/f/xredprko", {
      method: "POST",
      body: new FormData(e.target as HTMLFormElement),
      headers: { Accept: "application/json" },
    });
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

      <p className="text-gray-500 text-lg max-w-md mb-8">
        Remedy508 is almost ready. Be the first to know when we launch.
      </p>

      {/* Email capture */}
      {submitted ? (
        <div className="bg-[#0d9488]/10 border border-[#0d9488]/30 rounded-xl px-6 py-4 text-[#0d9488] font-medium">
          You're on the list — we'll be in touch!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <input
            type="email"
            name="email"
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

      {/* Social + Contact */}
      <div className="flex items-center gap-5 mt-10">
        {/* LinkedIn */}
        <a href="https://www.linkedin.com/company/remedy508" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-[#0d9488] transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </a>
        {/* Instagram */}
        <a href="https://www.instagram.com/remedy508app/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-[#0d9488] transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
          </svg>
        </a>
        {/* Contact */}
        <a href="mailto:hello@remedy508.com" aria-label="Email us" className="text-gray-400 hover:text-[#0d9488] transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </a>
      </div>

      {/* Footer */}
      <p className="text-gray-400 text-xs" style={{ position: "absolute", bottom: "2rem" }}>
        © {new Date().getFullYear()} Remedy508 — Left Coast Learning LLC
      </p>
    </div>
  );
}
