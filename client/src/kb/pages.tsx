import { useState, useMemo } from "react";
import { SignIn } from "@clerk/clerk-react";
import { Link, useParams, useNavigate, Navigate } from "react-router-dom";
import { Search, Lock, ArrowLeft, PlayCircle, Clock, FileText, ChevronRight, Mail } from "lucide-react";
import {
  SECTIONS, ARTICLES, articlesBySection, getArticle, getSection, relatedArticles, CONTACT,
} from "./data";
import {
  Header, Footer, ArticleCard, StatusBadge, ToolBadge, LogoMark, useAuth,
} from "./components";

// ===========================================================================
// LOGIN WALL — visual only. Any email/password "works" (front-end mock).
// ===========================================================================
export function LoginPage() {
  const { authed } = useAuth();
  if (authed) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      <div className="container-kb py-6">
        <Link to="/" className="inline-flex items-center gap-2" data-testid="link-login-home">
          <LogoMark className="h-8 w-8" />
          <span className="font-display font-extrabold text-navy">Remedy<span className="text-teal">508</span></span>
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <SignIn
          routing="hash"
          afterSignInUrl="/kb"
          appearance={{
            variables: {
              colorPrimary: "#0C9488",
              colorBackground: "#FAF7F2",
              fontFamily: "Inter, sans-serif",
              borderRadius: "0.75rem",
            },
          }}
        />
      </div>
    </div>
  );
}


// ===========================================================================
// HOME
// ===========================================================================
export function HomePage() {
  const { authed } = useAuth();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ARTICLES.filter(
      (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || (a.tool ?? "").toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header onSearch={setQuery} />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-teal-light/60 to-cream">
          <div className="container-kb py-14 sm:py-20 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-teal/20 px-3 py-1 text-xs font-semibold text-teal-dark">
              <PlayCircle className="h-3.5 w-3.5" /> 30 video walkthroughs
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold text-navy tracking-tight">
              How can we help you today?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-navy-muted">
              Short, practical walkthroughs for every part of Remedy508 — from your first upload to advanced accessibility tips.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="mx-auto mt-7 max-w-xl" role="search">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-muted" />
                <input
                  type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a topic, tool, or how-to…"
                  aria-label="Search the knowledge base" data-testid="input-hero-search"
                  className="w-full rounded-full border border-navy/15 bg-white py-3.5 pl-12 pr-4 text-base shadow-card focus:border-teal focus:outline-none"
                />
              </div>
            </form>
          </div>
        </section>

        <div className="container-kb py-12">
          {/* Search results */}
          {query.trim() ? (
            <section aria-label="Search results">
              <h2 className="font-display text-xl font-bold text-navy mb-1">
                {results.length} result{results.length !== 1 ? "s" : ""} for "{query.trim()}"
              </h2>
              <p className="text-sm text-navy-muted mb-6">
                <button onClick={() => setQuery("")} className="text-teal font-semibold hover:underline">Clear search</button>
              </p>
              {results.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((a) => <ArticleCard key={a.id} article={a} />)}
                </div>
              ) : (
                <p className="text-navy-muted">No matches. Try a different word, or browse the sections below.</p>
              )}
            </section>
          ) : (
            <>
              {/* Login notice banner (only when not authed) */}
              {!authed && (
                <div className="mb-10 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-teal/25 bg-teal-light/50 p-4">
                  <Lock className="h-5 w-5 text-teal shrink-0" strokeWidth={2.5} />
                  <p className="text-sm text-navy flex-1">
                    You can browse every topic below. <span className="font-semibold">Log in to watch the walkthroughs.</span>
                  </p>
                  <Link to="/login" data-testid="link-banner-login"
                    className="shrink-0 rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-hover text-center">
                    Log in
                  </Link>
                </div>
              )}

              {/* Section cards */}
              <div className="grid gap-5 sm:grid-cols-2">
                {SECTIONS.map((s) => {
                  const count = articlesBySection(s.id).length;
                  return (
                    <Link key={s.id} to={`/section/${s.id}`} data-testid={`card-section-${s.id}`}
                      className="group rounded-2xl border border-navy/10 bg-cream-card p-6 shadow-card transition hover:shadow-card-hover hover:border-teal/40">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white font-display font-extrabold">
                          {s.number}
                        </span>
                        <h2 className="font-display text-lg font-bold text-navy group-hover:text-teal">{s.title}</h2>
                      </div>
                      <p className="mt-3 text-sm text-navy-muted leading-relaxed">{s.blurb}</p>
                      <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-teal">
                        {count} articles <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ===========================================================================
// SECTION
// ===========================================================================
export function SectionPage() {
  const { id } = useParams();
  const section = getSection(id ?? "");
  if (!section) return <Navigate to="/" replace />;
  const articles = articlesBySection(section.id);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 container-kb py-10">
        <nav className="text-sm text-navy-muted mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-teal">Knowledge Base</Link>
          <span className="mx-2">/</span>
          <span className="text-navy font-medium">{section.title}</span>
        </nav>
        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal text-white font-display font-extrabold text-lg">
            {section.number}
          </span>
          <h1 className="font-display text-2xl font-extrabold text-navy">{section.title}</h1>
        </div>
        <p className="text-navy-muted max-w-2xl mb-8">{section.blurb}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ===========================================================================
// ARTICLE
// ===========================================================================
export function ArticlePage() {
  const { id } = useParams();
  const { authed } = useAuth();
  const article = getArticle(id ?? "");
  if (!article) return <Navigate to="/" replace />;
  const section = getSection(article.section);
  const related = relatedArticles(article);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 container-narrow py-10">
        <nav className="text-sm text-navy-muted mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-teal">Knowledge Base</Link>
          <span className="mx-2">/</span>
          <Link to={`/section/${section?.id}`} className="hover:text-teal">{section?.title}</Link>
        </nav>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-display text-sm font-bold text-navy-faint">#{article.order}</span>
          {article.tool && <ToolBadge tool={article.tool} />}
          <StatusBadge status={article.status} />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-navy leading-tight">{article.title}</h1>
        <p className="mt-3 text-lg text-navy-muted">{article.summary}</p>

        {/* Video area */}
        <div className="mt-7">
          {article.status === "published" && article.videoUrl ? (
            <figure>
              <video controls preload="metadata" className="w-full rounded-xl border border-navy/10 bg-black shadow-card"
                data-testid="video-player" aria-label={`Video: ${article.title}`}>
                <source src={article.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {article.duration && (
                <figcaption className="mt-2 flex items-center gap-1 text-sm text-navy-muted">
                  <Clock className="h-4 w-4" /> {article.duration}
                </figcaption>
              )}
            </figure>
          ) : (
            <ComingSoonPlaceholder authed={authed} />
          )}
        </div>

        {/* Transcript */}
        {article.status === "published" && article.transcript && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
              <FileText className="h-5 w-5 text-teal" /> Transcript
            </h2>
            <div className="mt-3 rounded-xl border border-navy/10 bg-cream-card p-5 text-sm leading-relaxed text-navy whitespace-pre-line">
              {article.transcript}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-lg font-bold text-navy mb-4">Related articles</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </section>
        )}

        <div className="mt-10">
          <Link to={`/section/${section?.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:text-teal-hover">
            <ArrowLeft className="h-4 w-4" /> Back to {section?.title}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ComingSoonPlaceholder({ authed }: { authed: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-navy/20 bg-cream-offset p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card">
        {authed ? <Clock className="h-6 w-6 text-teal" /> : <Lock className="h-6 w-6 text-teal" />}
      </div>
      {authed ? (
        <>
          <h2 className="font-display text-lg font-bold text-navy">This walkthrough is coming soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-muted">
            We're recording this video now. Check back shortly — or email us and we'll walk you through it in the meantime.
          </p>
          <a href={`mailto:${CONTACT.email}`} data-testid="link-email-help"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
            <Mail className="h-4 w-4" /> Ask us anything
          </a>
        </>
      ) : (
        <>
          <h2 className="font-display text-lg font-bold text-navy">Log in to watch</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-muted">
            The walkthrough videos are available to account holders. Log in to watch every tutorial in the Knowledge Base.
          </p>
          <Link to="/login" data-testid="link-article-login"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
            <Lock className="h-4 w-4" /> Log in
          </Link>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// 404
// ===========================================================================
export function NotFoundPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 container-narrow py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold text-navy">Page not found</h1>
        <p className="mt-3 text-navy-muted">We couldn't find that page.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-hover">
          <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
        </Link>
      </main>
      <Footer />
    </div>
  );
}
