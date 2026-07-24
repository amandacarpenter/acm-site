import { useState } from "react";
import { Link } from "wouter";
import KbGate from "./KbGate";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useKbSections, useKbSearch, type KbArticle } from "./useKb";
import { BookOpen } from "lucide-react";

const SECTION_ICONS = ["🚀", "🛠️", "📄", "✏️", "♿"];

function ArticleCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/kb/articles/${article.id}`}>
      <a
        className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] focus-visible:outline-offset-2"
        aria-label={article.title}
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0d9488]/20 text-[#0f766e] text-xs font-bold flex items-center justify-center mt-0.5">
          {article.order_num}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-base font-semibold text-gray-900 group-hover:text-[#0f766e] transition-colors leading-snug block">
            {article.title}
          </span>
          <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{article.summary}</p>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-gray-300 group-hover:text-[#0f766e] mt-0.5 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </a>
    </Link>
  );
}

function SearchResults({ q }: { q: string }) {
  const { results, loading } = useKbSearch(q);
  if (loading) return <p className="text-gray-700 text-base py-4">Searching…</p>;
  if (!results.length) return <p className="text-gray-700 text-base py-4">No results for "{q}"</p>;
  return (
    <div>
      <p className="text-base text-gray-700 mb-3">{results.length} result{results.length !== 1 ? "s" : ""} for "{q}"</p>
      <div className="flex flex-col gap-1">
        {results.map(a => <ArticleCard key={a.id} article={a} />)}
      </div>
    </div>
  );
}

export default function KbHome() {
  const { sections, loading } = useKbSections();
  const [query, setQuery] = useState("");

  return (
    <KbGate>
      <div className="min-h-screen bg-white text-gray-900">
        <SiteHeader />

        {/* Page hero — matches Contact, Pricing, etc. */}
        <section className="bg-[#3a485b] py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Knowledge Base
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">How-To Guides & Tips</h1>
            <p className="text-white max-w-xl mx-auto">Step-by-step articles for creating accessible content with Remedy508 — from uploading your first file to editing in Acrobat.</p>
          </div>
        </section>

        <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

          {/* Search */}
          <div className="mb-8">
            <label htmlFor="kb-search" className="sr-only">Search the knowledge base</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                id="kb-search"
                type="search"
                placeholder="Search articles…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                aria-label="Search the knowledge base"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]"
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
              {sections.map((sec, i) => (
                <section key={sec.section} aria-labelledby={`section-${sec.section}-heading`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl" aria-hidden="true">{SECTION_ICONS[i]}</span>
                    <h2 id={`section-${sec.section}-heading`} className="text-lg font-bold text-gray-900">
                      {sec.section_name}
                    </h2>
                    <span className="text-sm text-gray-700 ml-auto">{sec.articles.length} articles</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {sec.articles.map(article => (
                      <div key={article.id} className="px-2 py-1">
                        <ArticleCard article={article} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </KbGate>
  );
}
