import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ShareControls from "@/components/ShareControls";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  BLOG_AUTHOR,
  BLOG_NAME,
  blogPostPath,
  formatBlogDate,
  getBlogPost,
  getSortedBlogPosts,
} from "@shared/blog";
import { BLOG_CONTENT } from "./content";

function NotFound() {
  useDocumentTitle(`Article not found | ${BLOG_NAME}`);
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#0f766e] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#111827] mb-3">Article not found</h1>
        <p className="text-lg text-gray-800 mb-6">
          That Insights article does not exist, or its address has changed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 font-bold text-[#0f766e] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
          data-testid="blog-notfound-back"
        >
          Back to Remedy508 Insights
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BlogArticle({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  const content = post ? BLOG_CONTENT[post.slug] : undefined;

  useDocumentTitle(post ? post.seoTitle : `Article not found | ${BLOG_NAME}`);

  if (!post || !content) return <NotFound />;

  const moreReading = getSortedBlogPosts()
    .filter((entry) => entry.slug !== post.slug)
    .slice(0, 3);

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
        <article>
          {/* Masthead */}
          <div className="bg-gray-50 border-b border-[#0f766e]/15">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex flex-wrap items-center gap-2 text-sm list-none p-0 m-0">
                  <li>
                    <Link href="/" className="text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true" className="text-gray-400">
                    /
                  </li>
                  <li>
                    <Link
                      href="/blog"
                      className="text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                      data-testid="breadcrumb-blog"
                    >
                      {BLOG_NAME}
                    </Link>
                  </li>
                  <li aria-hidden="true" className="text-gray-400">
                    /
                  </li>
                  <li aria-current="page" className="text-gray-700 max-w-full truncate">
                    {post.category}
                  </li>
                </ol>
              </nav>

              <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#0f766e] mb-4">
                <span aria-hidden="true" className="inline-block h-px w-8 bg-[#0f766e]" />
                {post.category}
              </p>
              <h1 className="text-3xl sm:text-[2.6rem] font-bold leading-[1.15] text-[#111827] mb-4">
                {post.title}
              </h1>
              <p className="text-lg leading-relaxed text-gray-800 mb-6">{post.excerpt}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 border-t border-[#0f766e]/20 pt-4">
                <span className="font-bold text-[#111827]">{BLOG_AUTHOR}</span>
                <span aria-hidden="true" className="text-gray-300">
                  /
                </span>
                <span>
                  Published{" "}
                  <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                </span>
                {post.updatedAt !== post.publishedAt && (
                  <>
                    <span aria-hidden="true" className="text-gray-300">
                      /
                    </span>
                    <span>
                      Updated <time dateTime={post.updatedAt}>{formatBlogDate(post.updatedAt)}</time>
                    </span>
                  </>
                )}
                <span aria-hidden="true" className="text-gray-300">
                  /
                </span>
                <span>{post.readingMinutes} min read</span>
              </div>
            </div>
          </div>

          {/* Editorial image */}
          <figure className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 m-0">
            <img
              src={post.image}
              alt={post.imageAlt}
              width={1600}
              height={900}
              className="w-full h-auto object-cover border border-gray-200"
              loading="eager"
              data-testid="blog-article-image"
            />
          </figure>

          {/* Body */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
            <div className="max-w-[68ch]">{content.body}</div>

            <div className="mt-12">
              <ShareControls
                url={blogPostPath(post.slug)}
                title={post.title}
                summary={post.description}
              />
            </div>

            {/* Resources */}
            <section aria-labelledby="resources-heading" className="mt-12">
              <h2 id="resources-heading" className="text-2xl font-bold text-[#111827] mb-2">
                Resources and further reading
              </h2>
              <p className="text-base text-gray-700 mb-5">
                External references used in this article. All links open in a new tab.
              </p>
              <ul className="list-none p-0 m-0 divide-y divide-gray-200 border-y border-gray-200">
                {content.resources.map((resource) => (
                  <li key={resource.href} className="py-4">
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${resource.label}, ${resource.publisher} (opens in a new tab)`}
                      className="inline-flex min-h-[44px] items-center font-bold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                      data-testid="blog-resource-link"
                    >
                      {resource.label}
                    </a>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-[#3a485b]">{resource.publisher}</span>
                      {". "}
                      {resource.note}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Related Accessibility Guides */}
            <section aria-labelledby="guides-heading" className="mt-12">
              <h2 id="guides-heading" className="text-2xl font-bold text-[#111827] mb-2">
                Step-by-step Accessibility Guides
              </h2>
              <p className="text-base text-gray-700 mb-5">
                Practical instructions that pair with this analysis.
              </p>
              <ul className="list-none p-0 m-0 space-y-3">
                {content.relatedGuides.map((guide) => (
                  <li key={guide.id}>
                    <Link
                      href={`/kb/articles/${guide.id}`}
                      className="flex min-h-[44px] items-center border border-[#0f766e]/20 bg-gray-50 px-4 py-3 text-base font-semibold text-[#0f766e] no-underline transition-colors motion-reduce:transition-none hover:bg-[#0f766e]/10 hover:border-[#0f766e]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                      data-testid={`related-guide-${guide.id}`}
                    >
                      {guide.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-base text-gray-700">
                <Link
                  href="/kb"
                  className="font-bold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                  data-testid="article-guides-link"
                >
                  Browse all Accessibility Guides
                </Link>
              </p>
            </section>

            {/* More from Insights */}
            {moreReading.length > 0 && (
              <section aria-labelledby="more-insights-heading" className="mt-12">
                <h2 id="more-insights-heading" className="text-2xl font-bold text-[#111827] mb-5">
                  More from {BLOG_NAME}
                </h2>
                <ul className="list-none p-0 m-0 divide-y divide-gray-200 border-y border-gray-200">
                  {moreReading.map((entry) => (
                    <li key={entry.slug} className="py-4">
                      <p className="text-sm font-bold uppercase tracking-wide text-[#0f766e] mb-1">
                        {entry.category}
                      </p>
                      <h3 className="text-lg font-bold leading-snug">
                        <Link
                          href={blogPostPath(entry.slug)}
                          className="text-[#111827] no-underline hover:text-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                          data-testid={`more-insights-${entry.slug}`}
                        >
                          {entry.title}
                        </Link>
                      </h3>
                      <p className="mt-1 text-base text-gray-800">{entry.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* CTA */}
          <section aria-labelledby="article-cta-heading" className="bg-[#3a485b]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
              <h2 id="article-cta-heading" className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {content.cta.heading}
              </h2>
              <p className="text-white/90 text-lg mb-7">{content.cta.body}</p>
              <Link
                href="/accessibility-checker"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 bg-white text-[#0f766e] text-base font-bold rounded-lg no-underline transition-colors motion-reduce:transition-none hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                data-testid="blog-article-checker-cta"
              >
                {content.cta.action}
              </Link>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
