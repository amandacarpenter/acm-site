import { Link } from "wouter";
import KbGate from "./KbGate";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useKbArticle, useKbSections, type KbArticle } from "./useKb";

function RelatedCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/kb/articles/${article.id}`}>
      <a className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 hover:bg-white border border-gray-200 hover:border-[#0d9488]/40 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0d9488]/20 text-[#0d9488] text-xs font-bold flex items-center justify-center">
          {article.order_num}
        </span>
        <p className="text-sm text-gray-900 font-medium leading-snug">{article.title}</p>
      </a>
    </Link>
  );
}

interface ArticleViewProps { article: KbArticle; allArticles: KbArticle[] }

function ArticleView({ article, allArticles }: ArticleViewProps) {
  const related = article.related_ids
    .map(id => allArticles.find(a => a.id === id))
    .filter(Boolean) as KbArticle[];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SiteHeader />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
          <Link href="/kb"><a className="text-[#0d9488] hover:underline">Knowledge Base</a></Link>
          <span className="text-gray-300" aria-hidden="true">/</span>
          <span className="text-gray-500 truncate">{article.section_name}</span>
        </nav>

        {/* Title */}
        <div className="mb-8">
          <p className="text-xs text-[#0d9488] font-semibold uppercase tracking-wider mb-2">
            Section {article.section} — {article.section_name}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{article.title}</h1>
          <p className="mt-3 text-gray-500 text-base leading-relaxed">{article.summary}</p>
        </div>

        {/* Main content */}
        {article.transcript ? (
          <div
            className="prose prose-gray prose-sm sm:prose max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: article.transcript }}
          />
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">Content coming soon.</p>
          </div>
        )}

        {/* Related articles */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-12 pt-8 border-t border-gray-100">
            <h2 id="related-heading" className="text-base font-semibold text-gray-900 mb-3">Related articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map(r => <RelatedCard key={r.id} article={r} />)}
            </div>
          </section>
        )}

        {/* Help CTA */}
        <div className="mt-12 bg-[#0d9488]/5 border border-[#0d9488]/20 rounded-xl p-5 text-center">
          <p className="text-sm text-gray-700 font-medium mb-1">Still have questions?</p>
          <p className="text-sm text-gray-500">
            Email us at{" "}
            <a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]">
              hello@remedy508.com
            </a>
          </p>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}

export default function KbArticlePage({ params }: { params: { id: string } }) {
  const { article, loading } = useKbArticle(params.id);
  const { sections } = useKbSections();
  const allArticles = sections.flatMap(s => s.articles);

  return (
    <KbGate>
      {loading ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" aria-label="Loading article" />
        </div>
      ) : !article ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-900 text-lg font-semibold">Article not found</p>
            <Link href="/kb"><a className="text-[#0d9488] text-sm mt-2 hover:underline block mt-2">← Back to Knowledge Base</a></Link>
          </div>
        </div>
      ) : (
        <ArticleView article={article} allArticles={allArticles} />
      )}
    </KbGate>
  );
}
