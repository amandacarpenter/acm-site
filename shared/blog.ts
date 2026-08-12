// Remedy508 Insights — editorial blog metadata.
//
// This module is deliberately dependency-free and database-free so it can be
// imported by:
//  - client/src/pages/blog/* (listing + article rendering)
//  - shared/seo.ts (per-post title/description/canonical/OG/Article JSON-LD)
//  - script/generate-sitemap.ts (build-time sitemap.xml, no DB side effects)
//
// Article prose lives in client/src/pages/blog/content.tsx. Everything a
// crawler or the server needs is here.

export const BLOG_BASE_PATH = "/blog";
export const BLOG_NAME = "Remedy508 Insights";
export const BLOG_AUTHOR = "Remedy508 Editorial Team";

export type BlogCategory =
  | "Checker Interpretation"
  | "Standards & Practice"
  | "PDF Structure"
  | "Workflows";

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Checker Interpretation",
  "Standards & Practice",
  "PDF Structure",
  "Workflows",
];

export interface BlogPostMeta {
  slug: string;
  /** On-page H1 */
  title: string;
  /** <title> tag, kept under ~60 characters where possible */
  seoTitle: string;
  /** meta description + og:description, under ~160 characters */
  description: string;
  /** Listing excerpt and article standfirst */
  excerpt: string;
  category: BlogCategory;
  /** ISO date (YYYY-MM-DD) */
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  /** In-page editorial image, served from client/public */
  image: string;
  imageAlt: string;
  /** 1200x630 social share image, served from client/public */
  ogImage: string;
  featured?: boolean;
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "why-accessibility-checkers-disagree",
    title: "Why two accessibility checkers give you two different answers",
    seoTitle: "Why Accessibility Checkers Disagree | Remedy508 Insights",
    description:
      "Automated accessibility checkers test different rules against different document models, which is why two tools can score the same PDF very differently.",
    excerpt:
      "Two tools, one file, two verdicts. The disagreement is rarely a bug. It usually tells you something specific about what each tool measures and where human review has to take over.",
    category: "Checker Interpretation",
    publishedAt: "2026-06-24",
    updatedAt: "2026-08-11",
    readingMinutes: 5,
    image: "/blog-images/insights-checker-differences.webp",
    imageAlt:
      "Two identical stacks of printed pages on a cream desk, one tabbed with teal markers and the other with red markers at different positions.",
    ogImage: "/blog-images/insights-checker-differences-og.jpg",
    featured: true,
  },
  {
    slug: "passing-automated-check-is-not-the-finish-line",
    title: "A passing automated check is a starting line, not a finish line",
    seoTitle: "A Passing Automated Check Is Not the Finish Line | Remedy508",
    description:
      "Automated checks catch machine-detectable barriers. Reading order, alt text quality, and table meaning still need human judgment before a document is usable.",
    excerpt:
      "A clean automated report is genuinely good news. It is also a narrow claim. Here is what those green results actually cover, and the short list of checks a person still has to make.",
    category: "Standards & Practice",
    publishedAt: "2026-07-08",
    updatedAt: "2026-08-11",
    readingMinutes: 4,
    image: "/blog-images/insights-beyond-passing-check.webp",
    imageAlt:
      "A thick stack of printed pages on a cream desk with a single teal tab about a third of the way through and a red pencil resting alongside.",
    ogImage: "/blog-images/insights-beyond-passing-check-og.jpg",
  },
  {
    slug: "accessible-pdf-tables-what-tools-detect",
    title: "What accessible PDF tables require, and what automated tools can actually see",
    seoTitle: "Accessible PDF Tables: What Tools Detect | Remedy508",
    description:
      "Accessible PDF tables need real table tags, header cells, and scope or ID associations. Learn which of those an automated checker can verify and which it cannot.",
    excerpt:
      "Tables are where document accessibility gets technical fast. Tags, header cells, and cell associations each fail in different ways, and only some of those failures are machine-detectable.",
    category: "PDF Structure",
    publishedAt: "2026-07-22",
    updatedAt: "2026-08-11",
    readingMinutes: 5,
    image: "/blog-images/insights-pdf-tables.webp",
    imageAlt:
      "Close-up of a cream sheet printed with an empty ruled grid of rows and columns under a solid teal header row.",
    ogImage: "/blog-images/insights-pdf-tables-og.jpg",
  },
  {
    slug: "free-check-to-remediation-workflow",
    title: "From a free check to a fixed document: a practical remediation workflow",
    seoTitle: "Free Check to Remediation: A Practical Workflow | Remedy508",
    description:
      "A repeatable five-stage document remediation workflow: triage with a free check, decide the repair path, fix structure, verify with a person, then publish and record.",
    excerpt:
      "Most teams do not need more tools. They need an order of operations. This is the five-stage workflow we see working for document queues that never quite reach zero.",
    category: "Workflows",
    publishedAt: "2026-08-05",
    updatedAt: "2026-08-11",
    readingMinutes: 5,
    image: "/blog-images/insights-remediation-workflow.webp",
    imageAlt:
      "Three document folders arranged left to right on a cream desk, progressing from plain to red-flagged to a closed teal folder, beside a laptop.",
    ogImage: "/blog-images/insights-remediation-workflow-og.jpg",
  },
];

/** Newest first, which is the order both the listing and the sitemap use. */
export function getSortedBlogPosts(): BlogPostMeta[] {
  return [...BLOG_POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getBlogPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function blogPostPath(slug: string): string {
  return `${BLOG_BASE_PATH}/${slug}`;
}

/** "June 24, 2026" — used in bylines and listing metadata. */
export function formatBlogDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  if (!year || !month || !day) return iso;
  return `${months[month - 1]} ${day}, ${year}`;
}
