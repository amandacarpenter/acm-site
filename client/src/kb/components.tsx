import { Link, useNavigate } from "react-router-dom";
import { createContext, useContext, type ReactNode } from "react";
import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/clerk-react";
import { Search, Menu, X, PlayCircle, Clock, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CONTACT, type Article } from "./data";

// ---------------------------------------------------------------------------
// Auth context — backed by Clerk
// ---------------------------------------------------------------------------
interface AuthCtx {
  authed: boolean;
  login: () => void;
  logout: () => void;
}
const AuthContext = createContext<AuthCtx>({ authed: false, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const login = () => navigate("/login");
  const logout = () => signOut().then(() => navigate("/"));

  // Don't render until Clerk has resolved — prevents flash of wrong state
  if (!isLoaded) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-teal border-t-transparent animate-spin" aria-label="Loading" />
    </div>
  );

  return (
    <AuthContext.Provider value={{ authed: !!isSignedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/logo/remedy508_logo_icon.svg" alt="" className={className} aria-hidden="true" />;
}

export function LogoLockup() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group" data-testid="link-home-logo">
      <LogoMark className="h-9 w-9" />
      <div className="flex flex-col leading-none">
        <span className="font-display font-extrabold text-[1.05rem] text-navy tracking-tight">
          Remedy<span className="text-teal">508</span>
        </span>
        <span className="text-[0.7rem] font-medium text-navy-muted tracking-wide">Knowledge Base</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
export function StatusBadge({ status }: { status: Article["status"] }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-light px-2.5 py-0.5 text-[0.72rem] font-semibold text-teal-dark">
        <PlayCircle className="h-3 w-3" strokeWidth={2.5} /> Watch now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream-offset px-2.5 py-0.5 text-[0.72rem] font-semibold text-navy-muted border border-navy-faint/30">
      <Clock className="h-3 w-3" strokeWidth={2.5} /> Coming soon
    </span>
  );
}

export function ToolBadge({ tool }: { tool: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md bg-teal px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white">
      {tool}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export function Header({ onSearch }: { onSearch?: (q: string) => void }) {
  const { authed, logout } = useAuth();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(q);
    else navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-cream/90 backdrop-blur-md">
      <div className="container-kb flex h-16 items-center justify-between gap-4">
        <LogoLockup />

        {authed && (
          <form onSubmit={submit} className="hidden md:flex flex-1 max-w-md mx-4" role="search">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the knowledge base…"
                aria-label="Search the knowledge base"
                data-testid="input-search"
                className="w-full rounded-full border border-navy/15 bg-white py-2 pl-9 pr-4 text-sm text-navy placeholder:text-navy-faint focus:border-teal focus:outline-none"
              />
            </div>
          </form>
        )}

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          <a href={CONTACT.site} className="text-navy-muted hover:text-teal" data-testid="link-main-site">Main site</a>
          {authed ? (
            <div className="flex items-center gap-3">
              {user?.firstName && (
                <span className="text-xs text-navy-muted">Hi, {user.firstName}</span>
              )}
              <button onClick={logout} data-testid="button-logout"
                className="rounded-full border border-navy/20 px-4 py-1.5 text-navy hover:border-teal hover:text-teal">
                Log out
              </button>
            </div>
          ) : (
            <Link to="/login" data-testid="link-login"
              className="rounded-full bg-teal px-4 py-1.5 text-white hover:bg-teal-hover">
              Log in
            </Link>
          )}
        </nav>

        <button className="md:hidden text-navy" onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu" data-testid="button-mobile-menu">
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-navy/10 bg-cream px-5 py-4 space-y-3">
          {authed && (
            <form onSubmit={submit} role="search">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search…" aria-label="Search"
                className="w-full rounded-full border border-navy/15 bg-white py-2 px-4 text-sm" />
            </form>
          )}
          <a href={CONTACT.site} className="block text-navy-muted">Main site</a>
          {authed
            ? <button onClick={logout} className="block text-navy">Log out</button>
            : <Link to="/login" className="block font-semibold text-teal">Log in</Link>}
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export function Footer() {
  return (
    <footer className="mt-20 border-t border-navy/10 bg-cream-offset">
      <div className="container-kb py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <LogoLockup />
            <p className="mt-3 text-sm text-navy-muted">
              Not Accessible. Not Acceptable.™ — PDF and course-material accessibility for higher ed.
            </p>
          </div>
          <div className="text-sm">
            <h3 className="font-display font-bold text-navy mb-2">Questions?</h3>
            <a href={`mailto:${CONTACT.email}`} className="block text-teal hover:text-teal-hover font-medium">{CONTACT.email}</a>
            <a href={`tel:+19515031428`} className="block text-navy-muted hover:text-navy mt-1">{CONTACT.phone}</a>
          </div>
        </div>
        <div className="mt-8 border-t border-navy/10 pt-5 text-xs text-navy-muted">
          Left Coast Learning LLC · Riverside, California, USA
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Article card
// ---------------------------------------------------------------------------
export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link to={`/article/${article.id}`} data-testid={`card-article-${article.id}`}
      className="group flex flex-col rounded-xl border border-navy/10 bg-cream-card p-5 shadow-card transition hover:shadow-card-hover hover:border-teal/40">
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-[0.72rem] font-bold text-navy-faint">#{article.order}</span>
        <StatusBadge status={article.status} />
      </div>
      <h3 className="mt-2 font-display font-bold text-navy text-[1.02rem] leading-snug group-hover:text-teal">
        {article.title}
      </h3>
      <p className="mt-1.5 text-sm text-navy-muted leading-relaxed flex-1">{article.summary}</p>
      <div className="mt-4 flex items-center justify-between">
        {article.tool ? <ToolBadge tool={article.tool} /> : <span />}
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-teal opacity-0 group-hover:opacity-100 transition">
          View <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
