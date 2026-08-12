// Injects per-route SEO metadata (title, description, canonical, Open Graph,
// Twitter Card, JSON-LD) into the SPA's index.html before it's sent to the
// client. This is what lets crawlers and link-preview bots that don't run
// JS see real per-page metadata, since the app itself is a client-rendered
// Vite/React SPA with no server-side rendering.
import { getRouteMeta, SITE_URL, DEFAULT_OG_IMAGE } from "../shared/seo";
import { BLOG_AUTHOR, BLOG_NAME, getBlogPost } from "../shared/blog";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function softwareApplicationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Remedy508",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Document accessibility remediation software for PDFs, Word files, Canvas HTML, images, and video, with a free browser-based accessibility checker.",
    url: SITE_URL,
    image: DEFAULT_OG_IMAGE,
    offers: [
      {
        "@type": "Offer",
        name: "Individual Monthly",
        price: "19.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
      {
        "@type": "Offer",
        name: "Individual Annual",
        price: "199.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "249.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: "Left Coast Learning LLC",
    },
  });
}

function checkerApplicationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Remedy508 Free PDF and Document Accessibility Checker",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/accessibility-checker`,
    description:
      "A free browser-based PDF and Word accessibility checker for machine-detectable document structure, including tags, headings, tables, alt text, language, links, and form labels.",
    featureList: [
      "PDF and Word document accessibility checks",
      "PDF table tag and header association checks",
      "Heading and document structure checks",
      "Alternative text checks",
      "Language and metadata checks",
      "Local browser-based document processing",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    provider: {
      "@type": "Organization",
      name: "Left Coast Learning LLC",
      url: SITE_URL,
    },
  });
}

function faqPageJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the Free Accessibility Checker?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It is a free, browser-based check that reviews documents for common machine-detectable accessibility barriers. No account or Remedy508 Credits are required.",
        },
      },
      {
        "@type": "Question",
        name: "How do I check a PDF for accessibility?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Open the free PDF accessibility checker, choose your PDF, and review the results for tags, headings, tables, alternative text, language, links, forms, and text layers. Manual review is still required.",
        },
      },
      {
        "@type": "Question",
        name: "Does Remedy508 upload or save my document?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Document contents stay in the browser and are not uploaded or saved. Remedy508 records limited check metadata for internal usage reporting for up to 90 days.",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between the checker and Remedy Docs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Free Accessibility Checker identifies and explains common barriers. Remedy Docs is the paid remediation service that provides automated remediation assistance and produces an updated document.",
        },
      },
    ],
  });
}

function articleJsonLd(title: string, description: string, canonicalUrl: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    publisher: {
      "@type": "Organization",
      name: "Left Coast Learning LLC",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon-192.png`,
      },
    },
  });
}

/**
 * Full Article structured data for a Remedy508 Insights post, including the
 * byline, publish/modified dates, section, and the post-specific share image.
 */
function blogArticleJsonLd(slug: string, canonicalUrl: string): string | undefined {
  const post = getBlogPost(slug);
  if (!post) return undefined;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    image: `${SITE_URL}${post.ogImage}`,
    articleSection: post.category,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "Blog",
      name: BLOG_NAME,
      url: `${SITE_URL}/blog`,
    },
    author: {
      "@type": "Organization",
      name: BLOG_AUTHOR,
      url: `${SITE_URL}/blog`,
    },
    publisher: {
      "@type": "Organization",
      name: "Left Coast Learning LLC",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon-192.png`,
      },
    },
  });
}

function injectNoIndex(html: string): string {
  return html.replace(
    "</head>",
    '  <meta name="robots" content="noindex, nofollow" />\n</head>',
  );
}

/**
 * Rewrites the <title>, meta description, and adds canonical/OG/Twitter/JSON-LD
 * tags for the given request path. Falls back to the template's existing
 * title/description when the path has no registered SEO metadata (e.g.
 * auth-gated routes like /dashboard, /admin).
 */
export function injectSeoMeta(html: string, requestPath: string): string {
  const meta = getRouteMeta(requestPath);
  // Any route not intentionally registered as public is private, transactional,
  // or unknown. Keep it out of search results by default.
  if (!meta) return injectNoIndex(html);

  const canonicalUrl = `${SITE_URL}${requestPath === "/" ? "" : requestPath}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const ogImage = escapeHtml(meta.ogImage ?? DEFAULT_OG_IMAGE);

  let result = html;

  // Replace <title>...</title>
  result = result.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

  // Replace the existing meta description
  result = result.replace(
    /<meta name="description" content=".*?" \/>/i,
    `<meta name="description" content="${description}" />`,
  );

  const extraTags: string[] = [
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:type" content="${meta.ogType ?? "website"}" />`,
    `<meta property="og:site_name" content="Remedy508" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
  ];

  if (meta.jsonLd === "software") {
    extraTags.push(`<script type="application/ld+json">${softwareApplicationJsonLd()}</script>`);
  }
  if (meta.jsonLd === "checker") {
    extraTags.push(`<script type="application/ld+json">${checkerApplicationJsonLd()}</script>`);
  }
  if (meta.jsonLd === "faq") {
    extraTags.push(`<script type="application/ld+json">${faqPageJsonLd()}</script>`);
  }
  if (meta.jsonLd === "blog-article" && meta.blogSlug) {
    const post = getBlogPost(meta.blogSlug);
    const blogLd = blogArticleJsonLd(meta.blogSlug, canonicalUrl);
    if (post) {
      extraTags.push(
        `<meta property="article:published_time" content="${post.publishedAt}" />`,
        `<meta property="article:modified_time" content="${post.updatedAt}" />`,
        `<meta property="article:section" content="${escapeHtml(post.category)}" />`,
        `<meta property="article:author" content="${escapeHtml(BLOG_AUTHOR)}" />`,
        `<meta property="og:image:alt" content="${escapeHtml(post.imageAlt)}" />`,
        `<meta name="twitter:image:alt" content="${escapeHtml(post.imageAlt)}" />`,
      );
    }
    if (blogLd) extraTags.push(`<script type="application/ld+json">${blogLd}</script>`);
  }
  if (meta.jsonLd === "article") {
    extraTags.push(
      `<script type="application/ld+json">${articleJsonLd(meta.title, meta.description, canonicalUrl)}</script>`,
    );
  }

  result = result.replace("</head>", `  ${extraTags.join("\n  ")}\n</head>`);

  return result;
}
