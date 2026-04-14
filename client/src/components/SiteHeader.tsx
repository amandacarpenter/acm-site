import { Link, useLocation } from "wouter";
import { Menu, X, Accessibility } from "lucide-react";
import { useState } from "react";

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-label="Accessible Course Materials logo" role="img">
      <rect width="40" height="40" rx="10" fill="hsl(45 96% 53%)" />
      <circle cx="20" cy="11" r="3.5" fill="hsl(222 47% 11%)" />
      <path d="M11 20c0-5 4-9 9-9s9 4 9 9" stroke="hsl(222 47% 11%)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M15.5 20v9M24.5 20v9" stroke="hsl(222 47% 11%)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M15.5 25h9" stroke="hsl(222 47% 11%)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
];

export default function SiteHeader() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHero = location === "/";

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        isHero
          ? "bg-[hsl(222,47%,11%)]/90 backdrop-blur-md border-b border-white/10"
          : "bg-card/90 backdrop-blur-md border-b"
      }`}
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Logo />
          <div className="hidden sm:block">
            <div className={`font-bold text-sm leading-none ${isHero ? "text-white" : "text-foreground"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Accessible Course Materials
            </div>
            <div className={`text-[10px] mt-0.5 ${isHero ? "text-white/60" : "text-muted-foreground"}`}>
              Not Accessible, Not Acceptable™
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <span
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  location === link.href
                    ? isHero ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
                    : isHero ? "text-white/70 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </span>
            </Link>
          ))}
          <Link href="/tools">
            <span className="ml-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[hsl(45,96%,53%)] text-[hsl(222,47%,11%)] hover:brightness-110 transition cursor-pointer">
              Get Started
            </span>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className={`sm:hidden p-2 rounded-lg ${isHero ? "text-white hover:bg-white/10" : "text-foreground hover:bg-muted"}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`sm:hidden border-t ${isHero ? "bg-[hsl(222,47%,11%)] border-white/10" : "bg-card"}`}>
          <nav className="px-4 py-3 space-y-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                    isHero ? "text-white/80 hover:bg-white/10" : "text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <Link href="/tools">
              <span
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-semibold bg-[hsl(45,96%,53%)] text-[hsl(222,47%,11%)] text-center cursor-pointer"
              >
                Get Started
              </span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
