import { useState } from "react";
import { Link } from "wouter";
import KbGate from "./KbGate";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useKbSections, useKbSearch, type KbArticle } from "./useKb";

const SECTION_ICONS = ["🚀", "🛠️", "📄", "✏️", "♿"];

function ComingSoonBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600"
      aria-label="Video coming soon"
    >
      <span aria-hidden="true">⏳</span> Coming soon
    </span>
  );
}

function ArticleCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/kb/articles/${article.id}`}>
      <a
        className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] focus-visible:outline-offset-2"
        aria-label={`${article.title}${article.video_status === "coming_soon" ? " — coming soon" : article.duration ? ` — ${article.duration}` : ""}`}
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0d9488]/20 text-[#0d9488] text-xs font-bold flex items-center justify-center mt-0.5">
          {article.order_num}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white group-hover:text-[#0d9488] transition-colors leading-snug">
              {article.title}
            </span>
            {article.video_status === "coming_soon" ? (
              <ComingSoonBadge />
            ) : article.duration ? (
              <span className="text-xs text-gray-400 whitespace-nowrap">{article.duration}</span>
            ) : null}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{article.summary}</p>
        </div>
      </a>
    </Link>
  );
}

function SearchResults({ q }: { q: string }) {
  const { results, loading } = useKbSearch(q);
  if (loading) return <p className="text-gray-500 text-sm py-4">Searching…</p>;
  if (!results.length) return <p className="text-gray-500 text-sm py-4">No results for "{q}"</p>;
  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">{results.length} result{results.length !== 1 ? "s" : ""} for "{q}"</p>
      <div className="flex flex-col gap-1">
        {results.map(a => <ArticleCard key={a.id} article={a} />)}
      </div>
    </div>
  );
}

export default function KbHome() {
  const { sections, loading } = useKbSections();
  const [query, setQuery] = useState("");

  const totalPublished = sections.flatMap(s => s.articles).filter(a => a.video_status === "published").length;

  return (
    <KbGate>
      <div className="min-h-screen bg-white text-gray-900">
        <SiteHeader />
        <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Knowledge Base</h1>

          {/* Welcome banner */}
          <div className="bg-[#0d9488]/10 border border-[#0d9488]/20 rounded-xl p-4 sm:p-5 mb-8 flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">👋</span>
            <div>
              <p className="text-gray-900 font-semibold text-sm sm:text-base">New here? Start with Video #1</p>
              <Link href="/kb/articles/welcome-to-remedy508">
                <a className="text-[#0d9488] text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]">
                  Welcome to Remedy508 →
                </a>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="mb-8">
            <label htmlFor="kb-search" className="sr-only">Search the knowledge base</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                id="kb-search"
                type="search"
                placeholder="Search videos, transcripts…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                aria-label="Search the knowledge base"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Search results or section listing */}
          {query.trim() ? (
            <SearchResults q={query.trim()} />
          ) : loading ? (
            <div className="flex justify-center py-16" aria-live="polite" aria-label="Loading knowledge base">
              <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {totalPublished > 0 && (
                <p className="text-xs text-gray-400">{totalPublished} of 30 videos published</p>
              )}
              {sections.map((sec, i) => {
                const publishedCount = sec.articles.filter(a => a.video_status === "published").length;
                return (
                  <section key={sec.section} aria-labelledby={`section-${sec.section}-heading`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl" aria-hidden="true">{SECTION_ICONS[i]}</span>
                      <h2 id={`section-${sec.section}-heading`} className="text-base font-semibold text-white">
                        {sec.section_name}
                      </h2>
                      <span className="text-xs text-gray-400 ml-auto">
                        {publishedCount}/{sec.articles.length} videos
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-700/30">
                      {sec.articles.map(article => (
                        <div key={article.id} className="px-2 py-1">
                          <ArticleCard article={article} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </KbGate>
  );
}
