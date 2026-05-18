import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

const footerLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-gray-900 py-10" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Copyright */}
        <div className="text-center sm:text-left text-sm text-gray-400 mb-4">
          © 2026 Remedy508 — Left Coast Learning LLC
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
        </div>
      </div>
    </footer>
  );
}
