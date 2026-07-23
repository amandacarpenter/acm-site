import { Link } from "wouter";

const footerLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/faq", label: "FAQ" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/contact", label: "Contact" },
];

const FLAG_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 11" width="22" height="12" role="img" aria-label="American flag" className="shrink-0 rounded-sm">
    <rect width="20" height="11" fill="#B22234"/>
    <rect y="0.846" width="20" height="0.846" fill="white"/>
    <rect y="1.692" width="20" height="0.846" fill="#B22234"/>
    <rect y="2.538" width="20" height="0.846" fill="white"/>
    <rect y="3.384" width="20" height="0.846" fill="#B22234"/>
    <rect y="4.23" width="20" height="0.846" fill="white"/>
    <rect y="5.077" width="20" height="0.846" fill="#B22234"/>
    <rect y="5.923" width="20" height="0.846" fill="white"/>
    <rect y="6.769" width="20" height="0.846" fill="#B22234"/>
    <rect y="7.615" width="20" height="0.846" fill="white"/>
    <rect y="8.461" width="20" height="0.846" fill="#B22234"/>
    <rect y="9.307" width="20" height="0.846" fill="white"/>
    <rect y="10.154" width="20" height="0.846" fill="#B22234"/>
    <rect width="8" height="5.923" fill="#3C3B6E"/>
    <g fill="white">
      <circle cx="1" cy="0.8" r="0.3"/><circle cx="2.3" cy="0.8" r="0.3"/><circle cx="3.6" cy="0.8" r="0.3"/><circle cx="4.9" cy="0.8" r="0.3"/><circle cx="6.2" cy="0.8" r="0.3"/><circle cx="7.5" cy="0.8" r="0.3"/>
      <circle cx="1.65" cy="1.6" r="0.3"/><circle cx="2.95" cy="1.6" r="0.3"/><circle cx="4.25" cy="1.6" r="0.3"/><circle cx="5.55" cy="1.6" r="0.3"/><circle cx="6.85" cy="1.6" r="0.3"/>
      <circle cx="1" cy="2.4" r="0.3"/><circle cx="2.3" cy="2.4" r="0.3"/><circle cx="3.6" cy="2.4" r="0.3"/><circle cx="4.9" cy="2.4" r="0.3"/><circle cx="6.2" cy="2.4" r="0.3"/><circle cx="7.5" cy="2.4" r="0.3"/>
      <circle cx="1.65" cy="3.2" r="0.3"/><circle cx="2.95" cy="3.2" r="0.3"/><circle cx="4.25" cy="3.2" r="0.3"/><circle cx="5.55" cy="3.2" r="0.3"/><circle cx="6.85" cy="3.2" r="0.3"/>
      <circle cx="1" cy="4" r="0.3"/><circle cx="2.3" cy="4" r="0.3"/><circle cx="3.6" cy="4" r="0.3"/><circle cx="4.9" cy="4" r="0.3"/><circle cx="6.2" cy="4" r="0.3"/><circle cx="7.5" cy="4" r="0.3"/>
      <circle cx="1.65" cy="4.8" r="0.3"/><circle cx="2.95" cy="4.8" r="0.3"/><circle cx="4.25" cy="4.8" r="0.3"/><circle cx="5.55" cy="4.8" r="0.3"/><circle cx="6.85" cy="4.8" r="0.3"/>
    </g>
  </svg>
);

export default function SiteFooter() {
  return (
    <footer className="bg-gray-900 py-10" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-6">

        {/* Row 1 — Social icons (centered mobile, right-aligned desktop) */}
        <div className="flex items-center justify-center sm:justify-end gap-4">
          <a href="https://www.linkedin.com/company/remedy508" target="_blank" rel="noopener noreferrer" aria-label="Remedy508 on LinkedIn (opens in new tab)" className="text-gray-400 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="https://www.instagram.com/remedy508app/" target="_blank" rel="noopener noreferrer" aria-label="Remedy508 on Instagram (opens in new tab)" className="text-gray-400 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
          <a href="https://www.youtube.com/@Remedy508" target="_blank" rel="noopener noreferrer" aria-label="Remedy508 on YouTube (opens in new tab)" className="text-gray-400 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
        </div>

        {/* Row 2 — Nav links (centered mobile, left-aligned desktop) */}
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 list-none p-0 m-0">
            {footerLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href}>
                  <span className="text-sm text-gray-400 hover:text-white transition cursor-pointer whitespace-nowrap">
                    {label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Row 3 — Copyright + flag/attribution (centered mobile, space-between desktop) */}
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 sm:gap-0">
          <span className="text-sm text-gray-300">© 2026 Remedy508</span>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5">
            {FLAG_SVG}
            <span className="text-sm text-gray-400 text-center sm:text-left">Remedy508 is a product of Left Coast Learning LLC, California, USA</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
