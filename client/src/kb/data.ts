// ============================================================================
// Remedy508 Knowledge Base — content model
// ----------------------------------------------------------------------------
// This is the single source of truth for every KB article. To add a video
// later: find the article by `id`, set `videoUrl` to the file, flip
// `status` to "published", and (optionally) add `duration` + `transcript`.
// Nothing else needs to change — every page reads from this array.
// ============================================================================

export type VideoStatus = "published" | "coming_soon";

export interface Article {
  id: string;
  section: string;          // must match a Section.id below
  order: number;            // global order 1-30
  title: string;
  summary: string;
  tool?: string;            // shown as a lower-third-style badge (the 5 tools)
  duration?: string;        // e.g. "2:14"
  status: VideoStatus;
  videoUrl?: string;        // set when the finished video is uploaded
  transcript?: string;      // full text transcript (accessibility)
  tier1?: boolean;          // launch-critical (record first)
}

export interface Section {
  id: string;
  number: number;
  title: string;
  blurb: string;
}

export const SECTIONS: Section[] = [
  {
    id: "getting-started",
    number: 1,
    title: "Getting Started",
    blurb: "New to Remedy508? Start here. Accounts, your dashboard, and your first file.",
  },
  {
    id: "the-tools",
    number: 2,
    title: "Using the 5 Tools",
    blurb: "Step-by-step walkthroughs of every Remedy508 tool.",
  },
  {
    id: "preparing-files",
    number: 3,
    title: "Preparing Files for Remedy508",
    blurb: "Get your documents ready — saving, exporting, and scanning the right way.",
  },
  {
    id: "editing-after",
    number: 4,
    title: "Editing a PDF After Remedy508",
    blurb: "Fine-tune, verify, and polish your remediated files.",
  },
  {
    id: "accessibility-tips",
    number: 5,
    title: "Accessibility Tips & Best Practices",
    blurb: "The why behind the what — practical accessibility guidance for higher ed.",
  },
];

export const ARTICLES: Article[] = [
  // ---- Section 1: Getting Started ----
  { id: "welcome-overview", section: "getting-started", order: 1, tier1: true, status: "coming_soon",
    title: "Welcome to Remedy508", summary: "A 90-second overview of what Remedy508 does and how it helps higher ed meet accessibility requirements." },
  { id: "create-account", section: "getting-started", order: 2, tier1: true, status: "coming_soon",
    title: "Creating your account & logging in", summary: "How to sign up, verify your email, and log back in — plus resetting a forgotten password." },
  { id: "dashboard-tour", section: "getting-started", order: 3, status: "coming_soon",
    title: "A tour of your dashboard", summary: "Find your way around your home base — where every tool lives and how your files are organized." },
  { id: "first-upload", section: "getting-started", order: 4, tier1: true, status: "coming_soon",
    title: "Uploading your first file", summary: "The upload-run-download flow, supported file types, and what to know before you start." },
  { id: "understanding-results", section: "getting-started", order: 5, status: "coming_soon",
    title: "Understanding your results", summary: "How to read Remedy508's output, review what was changed, and download your accessible file." },

  // ---- Section 2: Using the 5 Tools ----
  { id: "document-fixer", section: "the-tools", order: 6, tier1: true, status: "coming_soon", tool: "Document Fixer", duration: "2:40",
    title: "Document Fixer: remediate a Word doc", summary: "Turn a Word document into an accessible file automatically — headings, alt text, and reading order." },
  { id: "complex-pdf", section: "the-tools", order: 7, tier1: true, status: "coming_soon", tool: "Complex PDF", duration: "3:10",
    title: "Complex PDF: remediating a real PDF", summary: "Handle multi-column layouts, tables, and images in a genuinely difficult PDF." },
  { id: "alt-text-generator", section: "the-tools", order: 8, status: "coming_soon", tool: "Alt Text Generator",
    title: "Alt Text Generator: images made accessible", summary: "Generate accurate image descriptions in seconds, then review and refine them." },
  { id: "canvas-html-fixer", section: "the-tools", order: 9, status: "coming_soon", tool: "Canvas HTML Fixer",
    title: "Canvas HTML Fixer: accessible Canvas pages", summary: "Clean up your Canvas course pages so they meet accessibility standards." },
  { id: "video-transcription", section: "the-tools", order: 10, tier1: true, status: "coming_soon", tool: "Video Transcription", duration: "2:55",
    title: "Video Transcription: captions & transcripts", summary: "Generate accurate captions and transcripts for your course videos in minutes." },

  // ---- Section 3: Preparing Files ----
  { id: "save-ppt-as-pdf", section: "preparing-files", order: 11, status: "coming_soon",
    title: "How to save a PowerPoint as a PDF", summary: "Export a .pptx to PDF the right way before uploading to Remedy508." },
  { id: "save-slides-as-pdf", section: "preparing-files", order: 12, status: "coming_soon",
    title: "How to save Google Slides as a PDF", summary: "Export a Google Slides deck to an accessible-ready PDF." },
  { id: "save-word-as-pdf", section: "preparing-files", order: 13, tier1: true, status: "coming_soon",
    title: "How to save a Word doc as a PDF (and when NOT to)", summary: "When to convert to PDF, when to upload the original Word file, and how to export properly." },
  { id: "export-from-canva", section: "preparing-files", order: 14, status: "coming_soon",
    title: "How to export from Canva", summary: "Export a Canva design as an accessible-ready PDF." },
  { id: "scan-paper-document", section: "preparing-files", order: 15, status: "coming_soon",
    title: "How to scan a paper document", summary: "Turn a physical page into a usable, text-based PDF — not just an image." },
  { id: "accepted-file-types", section: "preparing-files", order: 16, status: "coming_soon",
    title: "What file types Remedy508 accepts", summary: "The formats that work best — and which ones to avoid." },

  // ---- Section 4: Editing After ----
  { id: "open-in-acrobat", section: "editing-after", order: 17, status: "coming_soon",
    title: "Opening your remediated PDF in Adobe Acrobat", summary: "Where to look and how to open your file for a closer review." },
  { id: "fix-reading-order", section: "editing-after", order: 18, status: "coming_soon",
    title: "Fixing reading order in a remediated PDF", summary: "Adjust the order a screen reader follows when a complex file needs a tweak." },
  { id: "edit-alt-text-after", section: "editing-after", order: 19, status: "coming_soon",
    title: "Editing or improving alt text after remediation", summary: "Refine image descriptions once your file is remediated." },
  { id: "run-accessibility-checker", section: "editing-after", order: 20, status: "coming_soon",
    title: "Running Acrobat's Accessibility Checker", summary: "Verify your result with Acrobat's built-in checker and understand the report." },
  { id: "edit-pdf-free", section: "editing-after", order: 21, status: "coming_soon",
    title: "Editing a remediated PDF for free (no Acrobat)", summary: "Free tools and methods for making small edits without paying for Acrobat." },
  { id: "not-perfect", section: "editing-after", order: 22, status: "coming_soon",
    title: "What to do if the remediation isn't perfect", summary: "Troubleshooting steps and how to get the best possible result." },

  // ---- Section 5: Accessibility Tips ----
  { id: "accessibility-101", section: "accessibility-tips", order: 23, status: "coming_soon",
    title: "Accessibility 101: What WCAG 2.1 AA means", summary: "A plain-English primer on the standard higher ed is held to." },
  { id: "good-alt-text", section: "accessibility-tips", order: 24, status: "coming_soon",
    title: "Writing good alt text: a 3-minute guide", summary: "Practical rules for image descriptions that actually help." },
  { id: "heading-structure", section: "accessibility-tips", order: 25, status: "coming_soon",
    title: "Why heading structure matters", summary: "How proper headings power screen-reader navigation — and how to do it right." },
  { id: "color-contrast", section: "accessibility-tips", order: 26, status: "coming_soon",
    title: "Color contrast: the rule everyone breaks", summary: "Why contrast matters, the AA thresholds, and how to check yours." },
  { id: "accessible-tables", section: "accessibility-tips", order: 27, status: "coming_soon",
    title: "Making tables accessible", summary: "Simple fixes that make data tables work for everyone." },
  { id: "accessibility-law", section: "accessibility-tips", order: 28, status: "coming_soon",
    title: "Accessibility & the law: Title II, 508, ADA", summary: "What the 2026 requirements mean for public institutions, in plain terms." },
  { id: "accessibility-myths", section: "accessibility-tips", order: 29, status: "coming_soon",
    title: "Common accessibility myths, debunked", summary: "Clearing up the misconceptions that trip people up." },
  { id: "before-after", section: "accessibility-tips", order: 30, status: "coming_soon",
    title: "Before & after: a real document remediated", summary: "Watch a real document go from inaccessible to compliant, with a screen-reader demo." },
];

export const CONTACT = {
  email: "hello@remedy508.com",
  phone: "(951) 503-1428",
  site: "https://remedy508.com",
};

export function articlesBySection(sectionId: string): Article[] {
  return ARTICLES.filter((a) => a.section === sectionId).sort((a, b) => a.order - b.order);
}

export function getArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export function getSection(id: string): Section | undefined {
  return SECTIONS.find((s) => s.id === id);
}

export function relatedArticles(article: Article, count = 3): Article[] {
  // same section first, then fill from the rest, excluding self
  const sameSection = ARTICLES.filter((a) => a.section === article.section && a.id !== article.id);
  const others = ARTICLES.filter((a) => a.section !== article.section);
  return [...sameSection, ...others].slice(0, count);
}
