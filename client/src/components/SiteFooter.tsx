import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

const footerLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-gray-900 py-10" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Copyright */}
        <div className="text-center sm:text-left text-sm text-gray-400 mb-4">
          © 2026 Remedy508 — <a href="https://leftcoastlearningllc.com" target="_blank" rel="noopener" style={{color:"inherit",textDecoration:"underline",textUnderlineOffset:"3px"}}>Left Coast Learning LLC</a>
        </div>

        {/* Links row — wraps cleanly on mobile */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2">
          {footerLinks.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span className="text-xs text-gray-400 hover:text-white transition cursor-pointer whitespace-nowrap">
                {label}
              </span>
            </Link>
          ))}
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
            <span className="text-xs text-gray-400 whitespace-nowrap">WCAG 2.1 AA</span>
          </div>
          {/* Hidden tools shortcut */}
          <Link href="/tools">
            <span className="text-xs text-gray-600 hover:text-gray-400 transition cursor-pointer">©</span>
          </Link>

          {/* Social links */}
          <div className="flex items-center gap-4 sm:ml-auto">
            <a href="https://www.linkedin.com/company/remedy508" target="_blank" rel="noopener" aria-label="Remedy508 on LinkedIn" className="text-gray-400 hover:text-white transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
            <a href="https://www.instagram.com/remedy508app/" target="_blank" rel="noopener" aria-label="Remedy508 on Instagram" className="text-gray-400 hover:text-white transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
