import { useState } from "react";
import logoUrl from "@/assets/logo.png";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4 text-center">
      {/* Logo — white background so original PNG shows correctly */}
      <div
        className="mb-10"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "12px 24px",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <img
          src={logoUrl}
          alt="Remedy508"
          style={{ height: 48, width: "auto" }}
        />
      </div>

      {/* Heading */}
      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
        Something big is coming.
      </h1>
      <p className="text-gray-400 text-lg max-w-md mb-10">
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
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0d9488] text-sm"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition"
          >
            Notify me
          </button>
        </form>
      )}

      {/* Footer */}
      <p className="text-gray-600 text-xs mt-12">
        © {new Date().getFullYear()} Remedy508 — Left Coast Learning LLC
      </p>
    </div>
  );
}
