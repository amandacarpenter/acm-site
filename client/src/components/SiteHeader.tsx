import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import logoUrl from "@/assets/logo.png";

function Logo() {
  return (
    <img
      src={logoUrl}
      alt="Remedy508 logo"
      style={{ height: 52, width: "auto", maxWidth: 260, flexShrink: 0 }}
    />
  );
}

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/pricing", label: "Plans & Pricing" },
];

export default function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 no-underline" aria-label="Remedy508 home">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
          <ul className="flex items-center gap-1 list-none p-0 m-0">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>
                  <span
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                      location === link.href
                        ? "text-[#0d9488] bg-[#0d9488]/10"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              </li>
            ))}
            <SignedOut>
              <li>
                <Link href="/login">
                  <span className="ml-1 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer">
                    Log in
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/signup">
                  <span className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
                    Get Started →
                  </span>
                </Link>
              </li>
            </SignedOut>
            <SignedIn>
              <li>
                <Link href="/dashboard">
                  <span className="ml-1 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer">
                    Dashboard
                  </span>
                </Link>
              </li>
              <li><UserButton afterSignOutUrl="/" /></li>
            </SignedIn>
          </ul>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <SignedOut>
              <Link href="/login">
                <span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Log in
                </span>
              </Link>
              <Link href="/signup">
                <span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-semibold bg-[#0d9488] text-white text-center cursor-pointer">
                  Get Started →
                </span>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <span onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Dashboard
                </span>
              </Link>
              <div className="px-3 py-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </nav>
        </div>
      )}
    </header>
  );
}
