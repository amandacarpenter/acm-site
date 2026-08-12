import { useMemo, useState } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  BLOG_CATEGORIES,
  blogPostPath,
  formatBlogDate,
  getSortedBlogPosts,
  type BlogPostMeta,
} from "@shared/blog";

const ALL = "All topics";

function Meta({ post }: { post: BlogPostMeta }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
      <span className="font-bold uppercase tracking-wide text-[#0f766e]">{post.category}</span>
      <span aria-hidden="true" className="text-gray-300">
        /
      </span>
      <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
      <span aria-hidden="true" className="text-gray-300">
        /
      </span>
      <span>{post.readingMinutes} min read</span>
    </p>
  );
}

export default function BlogHome() {
  useDocumentTitle("Remedy508 Insights | Document Accessibility Analysis");
  const posts = useMemo(() => getSortedBlogPosts(), []);
  const [active, setActive] = useState<string>(ALL);

  const featured = posts.find((post) => post.featured) ?? posts[0];
  const filtered = active === ALL ? posts : posts.filter((post) => post.category === active);
  const rest = filtered.filter((post) => post.slug !== featured.slug || active !== ALL);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0f766e] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <SiteHeader />

      <main id="main-content">
        {/* Editorial hero — asymmetric, cream, no card */}
        <section className="bg-[#faf6f1] border-b border-[#0f766e]/15">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#991b1b] mb-4">
                <span aria-hidden="true" className="inline-block h-px w-10 bg-[#991b1b]" />
                Remedy508 Insights
              </p>
              <h1 className="max-w-[15ch] text-4xl sm:text-5xl font-bold leading-[1.1] text-[#111827] mb-5">
                Analysis for people who fix the documents
              </h1>
              <p className="text-lg leading-relaxed text-gray-800 max-w-xl mb-4">
                Editorial writing on accessibility trends, how to read a checker report, and the
                judgment calls automation cannot make for you. Written by the team building
                Remedy508 for the people doing the remediation.
              </p>
              <p className="text-base leading-relaxed text-gray-700 max-w-xl mb-8">
                Looking for step-by-step instructions instead?{" "}
                <Link href="/kb" className="font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">
                  Accessibility Guides
                </Link>{" "}
                covers the practical how-to work.
              </p>
              <Link
                href="/accessibility-checker"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 bg-[#0f766e] text-white text-base font-bold rounded-lg no-underline transition-colors motion-reduce:transition-none hover:bg-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                data-testid="blog-hero-checker-cta"
              >
                Run a free accessibility check
              </Link>
            </div>
            <div className="lg:justify-self-end w-full">
              <img
                src="/blog-images/insights-hero.webp"
                alt="A quiet desk corner with a closed slate laptop, a stack of printed documents, a deep teal ceramic cup, and reading glasses in morning light."
                width={1600}
                height={900}
                className="w-full h-auto object-cover border border-[#0f766e]/20"
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* Category navigation */}
        <section aria-labelledby="topics-heading" className="border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
            <h2 id="topics-heading" className="sr-only">
              Browse Insights by topic
            </h2>
            <ul className="flex flex-wrap items-center gap-2 list-none p-0 m-0">
              {[ALL, ...BLOG_CATEGORIES].map((category) => {
                const isActive = active === category;
                return (
                  <li key={category}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActive(category)}
                      data-testid={`blog-filter-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                      className={`inline-flex items-center min-h-[44px] px-4 py-2 text-sm font-bold border transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${
                        isActive
                          ? "bg-[#0f766e] text-white border-[#0f766e]"
                          : "bg-white text-gray-800 border-gray-300 hover:border-[#0f766e] hover:text-[#0f766e]"
                      }`}
                    >
                      {category}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p role="status" aria-live="polite" className="sr-only" data-testid="blog-filter-status">
              {`${filtered.length} article${filtered.length === 1 ? "" : "s"} shown${
                active === ALL ? "" : ` in ${active}`
              }.`}
            </p>
          </div>
        </section>

        {/* Featured story — only in the unfiltered view */}
        {active === ALL && (
          <section aria-labelledby="featured-heading" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
            <h2
              id="featured-heading"
              className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#991b1b] mb-6"
            >
              <span aria-hidden="true" className="inline-block h-px w-10 bg-[#991b1b]" />
              Featured
            </h2>
            <article className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
              <img
                src={featured.image}
                alt=""
                width={1600}
                height={900}
                className="w-full h-auto object-cover border border-gray-200"
                loading="lazy"
              />
              <div>
                <Meta post={featured} />
                <h3 className="mt-3 mb-4 text-2xl sm:text-3xl font-bold leading-tight text-[#111827]">
                  <Link
                    href={blogPostPath(featured.slug)}
                    className="text-[#111827] no-underline hover:text-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                    data-testid={`blog-card-${featured.slug}`}
                  >
                    {featured.title}
                  </Link>
                </h3>
                <p className="text-[1.0625rem] leading-relaxed text-gray-800 mb-4">{featured.excerpt}</p>
                <p className="text-base font-bold text-[#0f766e]">Read the analysis</p>
              </div>
            </article>
          </section>
        )}

        {/* Story list — hairline-ruled editorial rows, not a card grid */}
        <section aria-labelledby="stories-heading" className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h2
            id="stories-heading"
            className="text-sm font-bold uppercase tracking-[0.18em] text-[#3a485b] pb-4 border-b-2 border-[#3a485b]"
          >
            {active === ALL ? "More from Insights" : active}
          </h2>

          {rest.length === 0 ? (
            <p className="py-10 text-lg text-gray-800" data-testid="blog-empty-state">
              No articles in this topic yet. Choose another topic, or read everything under All
              topics.
            </p>
          ) : (
            <ul className="list-none p-0 m-0 divide-y divide-gray-200">
              {rest.map((post) => (
                <li key={post.slug}>
                  <article className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start py-8">
                    <div>
                      <Meta post={post} />
                      <h3 className="mt-2 mb-3 text-xl sm:text-2xl font-bold leading-snug text-[#111827]">
                        <Link
                          href={blogPostPath(post.slug)}
                          className="text-[#111827] no-underline hover:text-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                          data-testid={`blog-card-${post.slug}`}
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="text-[1.0625rem] leading-relaxed text-gray-800 max-w-2xl">
                        {post.excerpt}
                      </p>
                    </div>
                    <img
                      src={post.image}
                      alt=""
                      width={1600}
                      height={900}
                      className="order-first sm:order-none w-full h-40 sm:h-32 object-cover border border-gray-200"
                      loading="lazy"
                    />
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Closing CTA band */}
        <section aria-labelledby="blog-cta-heading" className="relative overflow-hidden bg-[#3a485b]">
          <HeroWatermark corner="left" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center">
            <h2 id="blog-cta-heading" className="text-2xl sm:text-3xl font-bold text-white mb-3">
              See where your own documents stand
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-7">
              The free checker reports machine-detectable structure issues in PDFs and Word files.
              No account and no credits needed to run it.
            </p>
            <Link
              href="/accessibility-checker"
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 bg-white text-[#0f766e] text-base font-bold rounded-lg no-underline transition-colors motion-reduce:transition-none hover:bg-[#faf6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              data-testid="blog-footer-checker-cta"
            >
              Open the free checker
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
