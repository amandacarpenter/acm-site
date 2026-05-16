import { useState } from "react";
import logo from "@/assets/logo.png";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#3a485b] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Subtle animated background blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#0d9488]/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-[#0d9488]/8 blur-3xl animate-pulse [animation-delay:1.5s]" />
        <div className="absolute top-[40%] left-[60%] w-[20vw] h-[20vw] rounded-full bg-white/5 blur-2xl animate-pulse [animation-delay:3s]" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">

        {/* Logo */}
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Remedy508 logo"
            className="h-16 w-auto"
          />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d9488]/20 border border-[#0d9488]/30 text-[#0d9488] text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488] animate-pulse" />
          Coming Soon
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Accessible content,<br />
            <span className="text-[#0d9488]">at scale.</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Remedy508 automatically remediates inaccessible course materials
            to meet WCAG 2.1 Level AA — built for higher education.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            "PDF Remediation",
            "Alt Text Generation",
            "Video Captions",
            "Canvas Integration",
            "WCAG 2.1 AA",
          ].map((f) => (
            <span
              key={f}
              className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-medium"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Email capture */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-[#0d9488]/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#0d9488]" aria-hidden="true" />
              </div>
              <p className="text-white font-semibold">You're on the list!</p>
              <p className="text-white/50 text-sm">We'll let you know the moment we launch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="waitlist-email" className="block text-white/80 text-sm font-medium mb-3 text-left">
                Get notified at launch
              </label>
              <div className="flex gap-2">
                <input
                  id="waitlist-email"
                  type="email"
                  required
                  placeholder="your@email.edu"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent transition"
                  aria-describedby={status === "error" ? "waitlist-error" : undefined}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-5 py-3 bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shrink-0"
                  aria-label="Join waitlist"
                >
                  {status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "Notify Me"
                  )}
                </button>
              </div>
              {status === "error" && (
                <p id="waitlist-error" role="alert" className="mt-2 text-red-400 text-xs text-left">
                  {errorMsg}
                </p>
              )}
              <p className="mt-3 text-white/30 text-xs text-left">
                No spam. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>

        {/* Tagline */}
        <p className="text-white/25 text-xs">
          Not Accessible, Not Acceptable™ &nbsp;·&nbsp; Left Coast Learning LLC
        </p>

      </div>
    </div>
  );
}
