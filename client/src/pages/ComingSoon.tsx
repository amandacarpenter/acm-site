import { useState, useRef } from "react"; // useRef kept for potential future use
import logoUrl from "@/assets/logo.png";
import teaserVideo from "@/assets/teaser.mp4";
import teaserCaptions from "@/assets/teaser.vtt";

export default function ComingSoon() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="min-h-screen bg-white flex flex-col px-6 py-10 sm:py-14">

      {/* Logo — centered at top, larger */}
      <div className="flex justify-center mb-10 sm:mb-14">
        <img src={logoUrl} alt="Remedy508" style={{ height: 72, width: "auto" }} />
      </div>

      {/* Two-column layout on desktop, stacked on mobile (text first on mobile) */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 lg:gap-16 max-w-5xl mx-auto w-full flex-1">

        {/* Right — Text + CTA (renders first on mobile via order) */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center text-center lg:text-left order-1 lg:order-2">

          {/* Badge */}
          <div className="mb-5 inline-flex lg:self-start items-center justify-center bg-[#0d9488]/10 border border-[#0d9488]/25 rounded-full px-5 py-2">
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0d9488", letterSpacing: "0.05em", textTransform: "uppercase" }}>Launching July 2026</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-[#111827] mb-4 tracking-tight leading-tight">
            Something big is coming.
          </h1>

          <p className="text-gray-500 text-lg mb-8">
            Remedy508 is almost ready. Request Early Access to be one of the first users.
          </p>

          {/* CTA / Form */}
          {submitted ? (
            <div className="bg-[#0d9488]/10 border border-[#0d9488]/30 rounded-xl px-6 py-4 text-[#0d9488] font-medium">
              You're on the list — we'll be in touch soon!
            </div>
          ) : !showForm ? (
            <div>
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3.5 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition"
              >
                Get Early Access
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
              <input
                type="text"
                name="name"
                required
                placeholder="Full Name"
                className="px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
              />
              <input
                type="email"
                name="email"
                required
                placeholder="Email Address"
                className="px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                className="px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
              />
              <input
                type="text"
                name="organization"
                required
                placeholder="Organization"
                className="px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Request Early Access"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-400 hover:text-gray-600 transition text-center"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Left — Video (order-2 on mobile so text shows first) */}
        <div className="w-full lg:w-5/12 flex-shrink-0 order-2 lg:order-1" style={{ maxWidth: 420 }}>
          <video
            ref={videoRef}
            playsInline
            controls
            className="w-full rounded-2xl shadow-lg"
            style={{ display: "block", width: "100%", height: "auto" }}
          >
            <source src={teaserVideo} type="video/mp4" />
            <track
              kind="captions"
              src={teaserCaptions}
              srcLang="en"
              label="English"
              default
            />
          </video>
        </div>

      </div>

      {/* Bottom — Social icons + footer */}
      <div className="flex flex-col items-center gap-4 mt-14">
        <div className="flex items-center gap-5">
          <a href="https://www.linkedin.com/company/remedy508" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-[#0d9488] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://www.instagram.com/remedy508app/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-[#0d9488] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          </a>
          <a href="https://www.youtube.com/@Remedy508" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-gray-400 hover:text-[#0d9488] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a href="mailto:hello@remedy508.com" aria-label="Email us" className="text-gray-400 hover:text-[#0d9488] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </a>
        </div>
        <p className="text-gray-400 text-xs">
          © {new Date().getFullYear()} Remedy508 — Left Coast Learning LLC
        </p>
      </div>

    </div>
  );
}
