// Central SEO metadata for all public, indexable routes.
// Used by:
//  - server/static.ts (injects per-route <title>/meta/OG/JSON-LD into index.html)
//  - script/generate-sitemap.ts (build-time sitemap.xml generation)
//
// Keep this list in sync with client/src/App.tsx routes. Only include routes
// that are public and should be indexed — never auth-gated pages (Dashboard,
// AdminPortal, CheckoutSuccess, TeamSetup, InvoiceRequest, kb/admin).

import { getBlogPost, getSortedBlogPosts } from "./blog";

export const SITE_URL = "https://remedy508.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  /** relative changefreq hint for sitemap.xml */
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number; // 0.0 - 1.0
  /** Select the route-specific structured data emitted by the server. */
  jsonLd?: "software" | "checker" | "faq" | "article" | "blog-article";
  /** Absolute URL of a route-specific social share image. */
  ogImage?: string;
  /** og:type for the route. Defaults to "website". */
  ogType?: "website" | "article";
  /** Set for /blog/:slug so the server can emit full Article structured data. */
  blogSlug?: string;
  /** ISO date used as <lastmod> in sitemap.xml. */
  lastmod?: string;
}

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Document Accessibility Remediation Software | Remedy508",
    description:
      "Check documents free, then remediate PDFs, Word files, Canvas HTML, images, and video with Remedy508 accessibility software for WCAG and Section 508 workflows.",
    changefreq: "weekly",
    priority: 1.0,
    jsonLd: "software",
  },
  {
    path: "/accessibility-checker",
    title: "Free PDF & Document Accessibility Checker | Remedy508",
    description:
      "Check PDF and Word accessibility online for tags, headings, tables, alt text, language, and other structural barriers. Free, private, and no signup required.",
    changefreq: "monthly",
    priority: 0.9,
    jsonLd: "checker",
  },
  {
    path: "/pricing",
    title: "PDF & Document Remediation Pricing | Remedy508",
    description:
      "Compare pricing for PDF and document accessibility remediation software. Individual and Team plans include all four Remedy508 tools plus the free checker.",
    changefreq: "monthly",
    priority: 0.9,
    jsonLd: "software",
  },
  {
    path: "/about",
    title: "About Remedy508 | Document Accessibility Software",
    description:
      "Learn why Remedy508 built document accessibility software for higher education, government, healthcare, and teams working toward WCAG and Section 508.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/faq",
    title: "Document Accessibility & PDF Remediation FAQ | Remedy508",
    description:
      "Answers about the free PDF accessibility checker, document remediation, privacy, WCAG, Section 508, supported files, plans, and Remedy508 Credits.",
    changefreq: "monthly",
    priority: 0.6,
    jsonLd: "faq",
  },
  {
    path: "/contact",
    title: "Contact Remedy508",
    description:
      "Get in touch with the Remedy508 team for sales, support, or questions about accessibility remediation for your institution.",
    changefreq: "yearly",
    priority: 0.4,
  },
  {
    path: "/accessibility",
    title: "Our Accessibility Commitment | Remedy508",
    description:
      "Remedy508's own commitment to digital accessibility and WCAG 2.1 AA conformance across our website and product.",
    changefreq: "yearly",
    priority: 0.4,
  },
  {
    path: "/accessibility-guides",
    title: "Document Accessibility Guides & PDF Remediation Tips",
    description:
      "Practical document accessibility guides covering PDF remediation, Word accessibility, headings, tables, alt text, Adobe Acrobat, WCAG, and Section 508.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/blog",
    title: "Remedy508 Insights | Document Accessibility Analysis",
    description:
      "Editorial analysis on document accessibility: how to read checker results, what automated testing misses, PDF structure, and practical remediation workflows.",
    changefreq: "weekly",
    priority: 0.8,
    ogImage: `${SITE_URL}/blog-images/insights-hero.webp`,
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Remedy508",
    description: "Remedy508's privacy policy covering data collection, use, and protection.",
    changefreq: "yearly",
    priority: 0.2,
  },
  {
    path: "/terms",
    title: "Terms of Service | Remedy508",
    description: "Remedy508's terms of service governing use of the platform.",
    changefreq: "yearly",
    priority: 0.2,
  },
];

/**
 * Sitemap and SEO entries for every Remedy508 Insights article. Derived from
 * shared/blog.ts so a new post is indexable without touching this file.
 */
export function getBlogRouteMeta(): RouteMeta[] {
  return getSortedBlogPosts().map((post) => ({
    path: `/blog/${post.slug}`,
    title: post.seoTitle,
    description: post.description,
    changefreq: "monthly" as const,
    priority: 0.7,
    jsonLd: "blog-article" as const,
    ogImage: `${SITE_URL}${post.ogImage}`,
    ogType: "article" as const,
    blogSlug: post.slug,
    lastmod: post.updatedAt,
  }));
}

export function getRouteMeta(pathname: string): RouteMeta | undefined {
  // exact match first
  const exact = ROUTES.find((r) => r.path === pathname);
  if (exact) return exact;

  // Remedy508 Insights articles get a unique title, description, canonical URL,
  // post-specific share image, and Article structured data.
  if (pathname.startsWith("/blog/")) {
    const slug = pathname.slice("/blog/".length);
    if (!slug || slug.includes("/")) return undefined;
    if (!getBlogPost(slug)) return undefined;
    return getBlogRouteMeta().find((route) => route.blogSlug === slug);
  }

  // Give every public knowledge-base article a unique, crawlable title,
  // description, canonical URL, and Article schema without importing the
  // database-backed KB module into the SEO layer.
  if (pathname.startsWith("/accessibility-guides/articles/")) {
    const slug = pathname.slice("/accessibility-guides/articles/".length);
    if (!slug || slug.includes("/")) return undefined;
    const acronyms = new Set(["aa", "ada", "ai", "html", "lms", "ocr", "pdf", "vpat", "wcag"]);
    const articleTitle = slug
      .split("-")
      .filter(Boolean)
      .map((word, index) => {
        if (acronyms.has(word)) return word.toUpperCase();
        return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
      })
      .join(" ")
      .replace(/(\d) (\d)/g, "$1.$2");
    return {
      path: pathname,
      title: `${articleTitle} | Remedy508`,
      description:
        `${articleTitle}: practical guidance for accessible PDFs, Word documents, and course materials, with WCAG and Section 508 guidance from Remedy508.`,
      changefreq: "monthly",
      priority: 0.5,
      jsonLd: "article",
    };
  }
  return undefined;
}
