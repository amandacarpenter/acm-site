import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import logoUrl from "@/assets/logo.png";
import IncidentBanner from "@/components/IncidentBanner";
import TrialNavLink from "@/components/TrialNavLink";
import { SITE_NAV_LINKS } from "@/lib/site-navigation";

function Logo() {
  return (
    <img
      src={logoUrl}
      alt="Remedy508 logo"
      style={{ height: 50, width: "auto", maxWidth: 260, flexShrink: 0 }}
    />
  );
}

export default function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <IncidentBanner />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200" role="banner">
      {/* Match the homepage header; compact gaps keep all five links readable. */}
      <div className="max-w-[1440px] mx-auto px-[clamp(20px,4vw,56px)] h-20 min-[1280px]:h-24 flex items-center justify-between gap-4 font-['General_Sans','Inter',sans-serif]">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0 no-underline" aria-label="Remedy508 home">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden min-[1440px]:flex items-center ml-auto" aria-label="Main navigation">
          <ul className="flex items-center gap-5 list-none p-0 m-0 whitespace-nowrap">
            {SITE_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={location === link.href ? "page" : undefined}
                  className={`relative inline-block py-1.5 text-[15px] font-bold tracking-normal transition-colors cursor-pointer after:content-[''] after:absolute after:left-0 after:right-full after:bottom-0 after:h-0.5 after:bg-[#0f766e] after:transition-[right] after:duration-300 hover:after:right-0 motion-reduce:after:transition-none ${
                    location === link.href ? "text-[#0f766e]" : "text-gray-900 hover:text-[#0f766e]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Account actions: same sizes and spacing as the homepage header */}
        <div className="hidden min-[1440px]:flex items-center gap-3.5 whitespace-nowrap">
          <SignedOut>
            <TrialNavLink className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg border border-[#0f766e] bg-white text-[15px] font-bold text-[#0b5c5a] hover:bg-teal-50 transition-colors" />
            <Link href="/login" className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg border border-[#0f766e]/40 text-[15px] font-bold text-[#0f766e] hover:bg-[#0f766e]/5 hover:border-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e] transition-colors">
              Log in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <span className="text-[15px] font-bold text-[#0f766e] hover:text-[#0b5c5a] cursor-pointer">
                Dashboard
              </span>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* Mobile hamburger */}
        <button
          className="min-[1440px]:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="site-mobile-menu"
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="site-mobile-menu" className="min-[1440px]:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
            {SITE_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="font-bold" aria-current={location === link.href ? "page" : undefined}>
                <span
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[15px] font-bold text-gray-900 hover:bg-gray-50 cursor-pointer"
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <SignedOut>
              <TrialNavLink onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-1.5 mt-3 px-3 min-h-11 rounded-lg border border-[#0f766e] bg-white text-[15px] font-bold text-[#0b5c5a] hover:bg-teal-50" />
              <Link href="/login">
                <span onClick={() => setMobileOpen(false)} className="block mt-3 px-3 py-2.5 rounded-lg border border-[#0f766e]/40 text-[15px] font-bold text-[#0f766e] text-center hover:bg-[#0f766e]/5 cursor-pointer">
                  Log in
                </span>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <span onClick={() => setMobileOpen(false)} className="block mt-3 px-3 py-2.5 rounded-lg text-[15px] font-bold text-[#0f766e] hover:bg-[#0f766e]/5 cursor-pointer">
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
    </>
  );
}
