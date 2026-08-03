// Central SEO metadata for all public, indexable routes.
// Used by:
//  - server/static.ts (injects per-route <title>/meta/OG/JSON-LD into index.html)
//  - script/generate-sitemap.ts (build-time sitemap.xml generation)
//
// Keep this list in sync with client/src/App.tsx routes. Only include routes
// that are public and should be indexed — never auth-gated pages (Dashboard,
// AdminPortal, CheckoutSuccess, TeamSetup, InvoiceRequest, kb/admin).

export const SITE_URL = "https://remedy508.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  /** relative changefreq hint for sitemap.xml */
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number; // 0.0 - 1.0
  /** Set true to emit SoftwareApplication JSON-LD (homepage/pricing only) */
  jsonLd?: "software" | "faq" | "article";
}

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Remedy508 | AI Accessibility Remediation for Higher Ed",
    description:
      "Remedy508 automatically remediates inaccessible course materials to meet WCAG 2.1 AA. Fix PDFs and Word docs, generate alt text, clean Canvas HTML, and caption videos — built for higher education.",
    changefreq: "weekly",
    priority: 1.0,
    jsonLd: "software",
  },
  {
    path: "/tools",
    title: "Accessibility Tools | Remedy Docs, Image, HTML & Video | Remedy508",
    description:
      "Four AI-powered tools for course material accessibility: Remedy Docs (PDF/Word remediation), Remedy Image (alt text), Remedy HTML (Canvas cleanup), and Remedy Video (captions & transcripts).",
    changefreq: "monthly",
    priority: 0.9,
  },
  {
    path: "/pricing",
    title: "Pricing | Remedy508 Accessibility Remediation",
    description:
      "Simple per-seat pricing for AI-powered accessibility remediation. Individual and Team plans with monthly credit pools, WCAG 2.1 AA compliant output, built for higher education budgets.",
    changefreq: "monthly",
    priority: 0.9,
    jsonLd: "software",
  },
  {
    path: "/about",
    title: "About Remedy508 | Accessibility Built for Higher Ed",
    description:
      "Remedy508 was built by Left Coast Learning to help higher education institutions meet WCAG 2.1 AA and ADA Title II accessibility requirements without manual remediation bottlenecks.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/faq",
    title: "FAQ | Remedy508 Accessibility Remediation",
    description:
      "Answers to common questions about Remedy508's accessibility remediation tools, pricing, credits, WCAG 2.1 AA compliance, and how it fits into your institution's workflow.",
    changefreq: "monthly",
    priority: 0.6,
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
    path: "/kb",
    title: "How-To Guides & Tips | Remedy508 Knowledge Base",
    description:
      "Step-by-step guides for using Remedy508's accessibility tools, preparing files for remediation, and understanding WCAG 2.1 AA best practices.",
    changefreq: "weekly",
    priority: 0.7,
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

export function getRouteMeta(pathname: string): RouteMeta | undefined {
  // exact match first
  const exact = ROUTES.find((r) => r.path === pathname);
  if (exact) return exact;
  // /tools/:tab -> fall back to /tools meta
  if (pathname.startsWith("/tools/")) return ROUTES.find((r) => r.path === "/tools");
  return undefined;
}
