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
      "An abstract white document is interpreted by overlapping teal scanning planes and a navy structural grid, with a gold marker at their intersection.",
    ogImage: "/blog-images/insights-checker-differences.webp",
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
      "A white paper path continues through teal, navy, and gold checkpoint frames to represent review that continues beyond an automated check.",
    ogImage: "/blog-images/insights-beyond-passing-check.webp",
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
      "A sculptural white table grid with a navy header row and teal lines connecting header cells to data cells.",
    ogImage: "/blog-images/insights-pdf-tables.webp",
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
      "A continuous white paper path moves through teal scanning, navy structure, transparent review, and a finished document marked in gold.",
    ogImage: "/blog-images/insights-remediation-workflow.webp",
  },
  {
    slug: "how-to-check-pdf-accessibility-checklist",
    title: "How to check a PDF for accessibility: a practical checklist",
    seoTitle: "How to Check a PDF for Accessibility: A Checklist",
    description:
      "A standards-based checklist for checking a PDF's title, tags, language, reading order, images, tables, and forms, plus what still has to be verified by hand.",
    excerpt:
      "You have a PDF in front of you and twenty minutes. This is the order to check it in, starting with the cheap disqualifying items and ending with the automated report.",
    category: "Checker Interpretation",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-pdf-accessibility-checklist.webp",
    imageAlt:
      "A white document under a teal magnifier ring, layered over translucent inspection planes and a navy grid, with a single gold marker at the top right.",
    ogImage: "/blog-images/insights-pdf-accessibility-checklist.webp",
  },
  {
    slug: "what-is-pdf-remediation-process-cost-drivers",
    title: "What is PDF remediation? Process, cost drivers, and timelines",
    seoTitle: "What Is PDF Remediation? Process and Cost Drivers",
    description:
      "PDF remediation explained: what the work involves step by step, which document features drive the effort, and how to scope a timeline you can defend.",
    excerpt:
      "Remediation is repair work on a file that was produced without structure. Knowing which features drive the effort is the difference between a real estimate and a guess.",
    category: "Workflows",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-what-is-pdf-remediation.webp",
    imageAlt:
      "A disordered stack of white pages on the left resolves into a neat stack topped with a gold block on the right, separated by teal glass panels.",
    ogImage: "/blog-images/insights-what-is-pdf-remediation.webp",
  },
  {
    slug: "pdf-ua-vs-wcag-vs-section-508",
    title: "PDF/UA vs WCAG vs Section 508: what each standard means",
    seoTitle: "PDF/UA vs WCAG vs Section 508: What Each Means",
    description:
      "PDF/UA, WCAG, and Section 508 are related but not interchangeable. Here is what each one covers, who requires it, and which to name in a policy or RFP.",
    excerpt:
      "One is a file format standard, one is a set of content guidelines, and one is a US legal standard. Naming the wrong one in a specification creates work nobody needed.",
    category: "Standards & Practice",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-pdfua-wcag-section-508.webp",
    imageAlt:
      "Three folded paper structures in white, teal, and navy stand side by side on a layered base, joined by a thin gold line.",
    ogImage: "/blog-images/insights-pdfua-wcag-section-508.webp",
  },
  {
    slug: "scanned-pdf-accessibility-ocr-manual-review",
    title: "How to make scanned PDFs accessible with OCR and manual review",
    seoTitle: "How to Make Scanned PDFs Accessible with OCR Review",
    description:
      "A scanned PDF is an image to a screen reader. Here is how detection, scan quality, OCR, suspect correction, and tagging turn it into a readable document.",
    excerpt:
      "Recognition is the first step, not the whole job. The errors that matter most are the ones the software was confident about, and only a person catches those.",
    category: "Workflows",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-scanned-pdf-ocr.webp",
    imageAlt:
      "A blank white sheet lifts away from a page of navy text lines under a teal scanning plane, with a gold pin marking the transition.",
    ogImage: "/blog-images/insights-scanned-pdf-ocr.webp",
  },
  {
    slug: "accessible-pdf-forms-labels-instructions-keyboard-order",
    title: "Accessible PDF forms: labels, instructions, errors, and keyboard order",
    seoTitle: "Accessible PDF Forms: Labels, Errors, Keyboard Order",
    description:
      "Fillable PDFs fail in predictable ways. How tooltips, instructions, tab order, and error handling make a form usable by keyboard and assistive technology.",
    excerpt:
      "A form can announce every field correctly and still be unusable if the tab order wanders. These four requirements fail independently, so they have to be checked separately.",
    category: "PDF Structure",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-accessible-pdf-forms.webp",
    imageAlt:
      "A white sheet of raised blank form fields is threaded by a navy connecting line with teal and gold nodes marking the tab sequence.",
    ogImage: "/blog-images/insights-accessible-pdf-forms.webp",
  },
  {
    slug: "accessible-word-document-before-pdf-export",
    title: "How to create an accessible Word document before exporting to PDF",
    seoTitle: "Create an Accessible Word Document Before PDF Export",
    description:
      "Most PDF accessibility problems start in Word. Fix headings, alt text, tables, links, and color first, then export with document structure tags intact.",
    excerpt:
      "Every problem you fix in the source costs a fraction of what it costs in the PDF. This is the pre-export routine that keeps documents out of the remediation queue.",
    category: "Workflows",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-accessible-word-document.webp",
    imageAlt:
      "Layered white pages showing a heading bar, body lines, a teal chart block, and a small table, with a gold paper plane leaving the top layer.",
    ogImage: "/blog-images/insights-accessible-word-document.webp",
  },
  {
    slug: "doj-title-ii-web-accessibility-deadlines-higher-education",
    title: "DOJ Title II web accessibility deadlines: what higher education needs to know",
    seoTitle: "DOJ Title II Deadlines: What Higher Ed Needs to Know",
    description:
      "DOJ extended the Title II web accessibility compliance dates in April 2026. What applies to public institutions now, what is unchanged, and what is contested.",
    excerpt:
      "The dates moved by a year. The standard did not, the ongoing obligations did not, and the extension is being challenged in court. Here is the state of play.",
    category: "Standards & Practice",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-title-ii-deadlines.webp",
    imageAlt:
      "Two open rectangular frames in teal and navy stand like gateways over a stack of white pages, with a gold disc on a horizontal line at the left.",
    ogImage: "/blog-images/insights-title-ii-deadlines.webp",
  },
  {
    slug: "vpat-vs-acr-what-buyers-should-request",
    title: "VPAT vs ACR: what accessibility buyers should request",
    seoTitle: "VPAT vs ACR: What Accessibility Buyers Request",
    description:
      "A VPAT is the blank template and an ACR is the completed report. What to request from vendors, what a credible report contains, and how to read the answer.",
    excerpt:
      "Ask for a VPAT and a vendor can hand you an empty template. Ask for a current ACR and you get a claim you can actually evaluate, if you know what to look for.",
    category: "Standards & Practice",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-vpat-vs-acr.webp",
    imageAlt:
      "An empty white wire frame outline on the left contrasts with a solid stack of printed white pages on the right, linked by navy rails and a gold marker.",
    ogImage: "/blog-images/insights-vpat-vs-acr.webp",
  },
  {
    slug: "pdf-tags-explained-structure-screen-readers-use",
    title: "PDF tags explained: the structure screen readers actually use",
    seoTitle: "PDF Tags Explained: The Structure Screen Readers Use",
    description:
      "Tags are the hidden outline that tells assistive technology what each part of a PDF is. What tags do, which ones you will meet, and how they break.",
    excerpt:
      "Two files can look identical on screen and behave completely differently out loud. The tags tree is where that difference lives, and it is readable once you know the vocabulary.",
    category: "PDF Structure",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 5,
    image: "/blog-images/insights-pdf-tags-explained.webp",
    imageAlt:
      "A white page floats above translucent teal layers connected by a navy branching tree of small white blocks, topped by a gold node.",
    ogImage: "/blog-images/insights-pdf-tags-explained.webp",
  },
  {
    slug: "document-accessibility-program-colleges-universities",
    title: "Building a document accessibility program for colleges and universities",
    seoTitle: "Building a Document Accessibility Program for Colleges",
    description:
      "A practical framework for a campus document accessibility program: policy, roles, training, prioritized remediation, monitoring, and procurement guardrails.",
    excerpt:
      "Documents are produced by hundreds of people outside the web team, which is why they need their own program lane, their own owner, and their own routines.",
    category: "Workflows",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    readingMinutes: 6,
    image: "/blog-images/insights-document-accessibility-program.webp",
    imageAlt:
      "Four stacks of white pages converge on a central teal panel crossed by navy connecting rails, with a small gold sphere at the intersection.",
    ogImage: "/blog-images/insights-document-accessibility-program.webp",
  },
];

/**
 * Newest first, which is the order both the listing and the sitemap use.
 * Posts published on the same day keep their order in BLOG_POSTS, so an
 * editorial sequence within one publication date stays intentional.
 */
export function getSortedBlogPosts(): BlogPostMeta[] {
  return [...BLOG_POSTS].sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return 0;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  });
}

/**
 * Related reading for an article: same-category posts first, newest first,
 * topped up with the most recent posts from other categories so every article
 * has a full set even in a thinly populated category.
 */
export function getRelatedBlogPosts(slug: string, limit = 3): BlogPostMeta[] {
  const post = getBlogPost(slug);
  const others = getSortedBlogPosts().filter((entry) => entry.slug !== slug);
  if (!post) return others.slice(0, limit);
  const sameCategory = others.filter((entry) => entry.category === post.category);
  const rest = others.filter((entry) => entry.category !== post.category);
  return [...sameCategory, ...rest].slice(0, limit);
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
