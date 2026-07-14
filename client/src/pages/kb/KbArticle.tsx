import { useRef } from "react";
import { Link } from "wouter";
import KbGate from "./KbGate";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useKbArticle, useKbSections, type KbArticle } from "./useKb";

function RelatedCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/kb/articles/${article.id}`}>
      <a className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-50/80 border border-gray-200 hover:border-[#0d9488]/40 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0d9488]/20 text-[#0d9488] text-xs font-bold flex items-center justify-center">
          {article.order_num}
        </span>
        <div>
          <p className="text-sm text-gray-900 font-medium leading-snug">{article.title}</p>
          {article.duration && <p className="text-xs text-gray-400 mt-0.5">{article.duration}</p>}
        </div>
      </a>
    </Link>
  );
}

interface ArticleViewProps { article: KbArticle; allArticles: KbArticle[] }

function ArticleView({ article, allArticles }: ArticleViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const related = article.related_ids
    .map(id => allArticles.find(a => a.id === id))
    .filter(Boolean) as KbArticle[];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SiteHeader />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
          <Link href="/kb"><a className="text-[#0d9488] hover:underline">Knowledge Base</a></Link>
          <span className="text-gray-400" aria-hidden="true">/</span>
          <span className="text-gray-500 truncate">{article.section_name}</span>
        </nav>

        {/* Title + meta */}
        <div className="mb-6">
          <p className="text-xs text-[#0d9488] font-medium uppercase tracking-wide mb-1">
            Section {article.section} — {article.section_name}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{article.title}</h1>
          <p className="mt-2 text-gray-400 text-sm sm:text-base leading-relaxed">{article.summary}</p>
          {article.duration && (
            <p className="mt-1 text-xs text-gray-500">Duration: {article.duration}</p>
          )}
        </div>

        {/* Video player or coming soon */}
        {article.video_status === "published" && article.video_url ? (
          <div className="mb-8">
            <div className="rounded-xl overflow-hidden bg-black aspect-video border border-gray-200">
              <video
                ref={videoRef}
                controls
                preload="metadata"
                className="w-full h-full"
                aria-label={`Video: ${article.title}`}
              >
                <source src={article.video_url} type="video/mp4" />
                {article.captions_url && (
                  <track
                    kind="captions"
                    srcLang="en"
                    src={article.captions_url}
                    label="English captions"
                    default
                  />
                )}
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        ) : (
          <div
            className="mb-8 rounded-xl border-2 border-dashed border-gray-700 bg-gray-50/50 aspect-video flex flex-col items-center justify-center gap-3"
            role="img"
            aria-label="Video coming soon"
          >
            <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">Video coming soon</p>
              <p className="text-gray-400 text-xs mt-1">This video is being produced. Check back soon.</p>
            </div>
          </div>
        )}

        {/* Transcript */}
        {article.transcript ? (
          <section aria-labelledby="transcript-heading" className="mb-8">
            <h2 id="transcript-heading" className="text-lg font-semibold text-gray-900 mb-3">Transcript</h2>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="prose prose-sm  max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {article.transcript}
              </div>
            </div>
          </section>
        ) : (
          <section aria-labelledby="transcript-heading" className="mb-8">
            <h2 id="transcript-heading" className="text-lg font-semibold text-gray-900 mb-3">Transcript</h2>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6">
              <p className="text-gray-500 text-sm italic">Transcript will be added when the video is published.</p>
            </div>
          </section>
        )}

        {/* Related videos */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mb-8">
            <h2 id="related-heading" className="text-lg font-semibold text-gray-900 mb-3">Related videos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map(r => <RelatedCard key={r.id} article={r} />)}
            </div>
          </section>
        )}

        {/* Help footer */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5 text-center">
          <p className="text-sm text-gray-600">
            Questions about this topic?{" "}
            <a href="mailto:hello@remedy508.com" className="text-[#0d9488] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488]">
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
            <p className="text-white text-lg font-semibold">Article not found</p>
            <Link href="/kb"><a className="text-[#0d9488] text-sm mt-2 hover:underline">← Back to Knowledge Base</a></Link>
          </div>
        </div>
      ) : (
        <ArticleView article={article} allArticles={allArticles} />
      )}
    </KbGate>
  );
}
