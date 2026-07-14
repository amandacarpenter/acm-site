import Database from "better-sqlite3";
import path from "path";

// ── DB setup ─────────────────────────────────────────────────────────────────
const db = new Database(path.resolve("acm.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS kb_articles (
    id          TEXT PRIMARY KEY,
    section     INTEGER NOT NULL,
    section_name TEXT NOT NULL,
    order_num   INTEGER NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL,
    video_url   TEXT,
    video_status TEXT NOT NULL DEFAULT 'coming_soon',
    transcript  TEXT,
    captions_url TEXT,
    duration    TEXT,
    related_ids TEXT NOT NULL DEFAULT '[]',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface KbArticle {
  id: string;
  section: number;
  section_name: string;
  order_num: number;
  title: string;
  summary: string;
  video_url: string | null;
  video_status: "published" | "coming_soon";
  transcript: string | null;
  captions_url: string | null;
  duration: string | null;
  related_ids: string[];
  updated_at: string;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED: Omit<KbArticle, "updated_at">[] = [
  // Section 1 — Getting Started
  { id: "welcome-to-remedy508", section: 1, section_name: "Getting Started", order_num: 1, title: "Welcome to Remedy508", summary: "A 90-second overview of what Remedy508 does and how it can help you create accessible content fast.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: "1:30", related_ids: ["creating-account-logging-in", "tour-of-your-dashboard"] },
  { id: "creating-account-logging-in", section: 1, section_name: "Getting Started", order_num: 2, title: "Creating your account & logging in", summary: "Step-by-step walkthrough of signing up for Remedy508 and logging in for the first time.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["welcome-to-remedy508", "tour-of-your-dashboard"] },
  { id: "tour-of-your-dashboard", section: 1, section_name: "Getting Started", order_num: 3, title: "A tour of your dashboard", summary: "Learn what's on your dashboard — usage tracking, quick access tools, and account settings.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["uploading-your-first-file", "understanding-your-results"] },
  { id: "uploading-your-first-file", section: 1, section_name: "Getting Started", order_num: 4, title: "Uploading your first file", summary: "How to upload a document or PDF and send it through Remedy508 for the first time.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["welcome-to-remedy508", "understanding-your-results"] },
  { id: "understanding-your-results", section: 1, section_name: "Getting Started", order_num: 5, title: "Understanding your results", summary: "What the output means — how to read your remediated file and what each fix applied.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["uploading-your-first-file", "document-fixer-word-doc"] },

  // Section 2 — Using the 5 Tools
  { id: "document-fixer-word-doc", section: 2, section_name: "Using the 5 Tools", order_num: 6, title: "Document Fixer — remediate a Word doc", summary: "Walk through fixing a real Word document using the Document Fixer tool, from upload to download.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["complex-pdf-remediating", "understanding-your-results"] },
  { id: "complex-pdf-remediating", section: 2, section_name: "Using the 5 Tools", order_num: 7, title: "Complex PDF — remediating a real PDF", summary: "How to use the Complex PDF tool on scanned or complex PDF files that need vision-based remediation.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["document-fixer-word-doc", "opening-remediated-pdf-acrobat"] },
  { id: "alt-text-generator", section: 2, section_name: "Using the 5 Tools", order_num: 8, title: "Alt Text Generator — images made accessible", summary: "Generate accurate, descriptive alt text for images and charts using the Alt Text Generator tool.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["writing-good-alt-text", "canvas-html-fixer"] },
  { id: "canvas-html-fixer", section: 2, section_name: "Using the 5 Tools", order_num: 9, title: "Canvas HTML Fixer — accessible Canvas pages", summary: "Clean up Canvas LMS HTML to meet accessibility standards using the Canvas HTML Fixer tool.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["alt-text-generator", "accessibility-101-wcag"] },
  { id: "video-transcription-captions", section: 2, section_name: "Using the 5 Tools", order_num: 10, title: "Video Transcription — captions & transcripts", summary: "Upload a video or audio file and generate accurate captions and a full text transcript automatically.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["canvas-html-fixer", "welcome-to-remedy508"] },

  // Section 3 — Preparing Files for Remedy508
  { id: "save-powerpoint-as-pdf", section: 3, section_name: "Preparing Files for Remedy508", order_num: 11, title: "How to save a PowerPoint (.pptx) as a PDF", summary: "The right way to export a PowerPoint presentation as a PDF before running it through Remedy508.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["what-file-types-accepted", "save-word-doc-as-pdf"] },
  { id: "save-google-slides-as-pdf", section: 3, section_name: "Preparing Files for Remedy508", order_num: 12, title: "How to save a Google Slides deck as a PDF", summary: "Export a Google Slides presentation as a PDF with the right settings for accessibility remediation.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["save-powerpoint-as-pdf", "save-word-doc-as-pdf"] },
  { id: "save-word-doc-as-pdf", section: 3, section_name: "Preparing Files for Remedy508", order_num: 13, title: "How to save a Word doc as a PDF (and when NOT to)", summary: "When to send Word docs directly vs. converting to PDF first, and how to export correctly either way.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["document-fixer-word-doc", "save-powerpoint-as-pdf"] },
  { id: "export-canva-accessible-pdf", section: 3, section_name: "Preparing Files for Remedy508", order_num: 14, title: "How to export from Canva as an accessible-ready PDF", summary: "Get the best results from Remedy508 by exporting your Canva designs with the right PDF settings.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["save-google-slides-as-pdf", "what-file-types-accepted"] },
  { id: "scan-paper-document-to-pdf", section: 3, section_name: "Preparing Files for Remedy508", order_num: 15, title: "How to scan a paper document into a usable PDF", summary: "Best practices for scanning physical documents into a PDF that Remedy508 can process effectively.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["complex-pdf-remediating", "what-file-types-accepted"] },
  { id: "what-file-types-accepted", section: 3, section_name: "Preparing Files for Remedy508", order_num: 16, title: "What file types Remedy508 accepts (and which to avoid)", summary: "A complete reference of supported file formats and common types that need conversion before upload.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["save-powerpoint-as-pdf", "uploading-your-first-file"] },

  // Section 4 — Editing a PDF After Remedy508
  { id: "opening-remediated-pdf-acrobat", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 17, title: "Opening your remediated PDF in Adobe Acrobat", summary: "How to open and review your Remedy508 output in Adobe Acrobat for further editing or review.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["fixing-reading-order", "running-acrobat-checker"] },
  { id: "fixing-reading-order", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 18, title: "Fixing reading order in a remediated PDF", summary: "How to identify and correct reading order issues in your remediated PDF using Acrobat's tag panel.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["opening-remediated-pdf-acrobat", "editing-alt-text-after"] },
  { id: "editing-alt-text-after", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 19, title: "Editing or improving alt text after remediation", summary: "Review and refine the alt text applied by Remedy508 to images in your PDF using Acrobat.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["fixing-reading-order", "writing-good-alt-text"] },
  { id: "running-acrobat-checker", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 20, title: "Running Acrobat's Accessibility Checker on your result", summary: "Use Adobe Acrobat's built-in checker to verify your remediated PDF meets WCAG 2.1 AA standards.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["opening-remediated-pdf-acrobat", "what-to-do-if-not-perfect"] },
  { id: "editing-pdf-free-no-acrobat", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 21, title: "Editing a remediated PDF for free (no Acrobat)", summary: "Free tools and workflows for reviewing and lightly editing your remediated PDF without Adobe Acrobat.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["opening-remediated-pdf-acrobat", "what-to-do-if-not-perfect"] },
  { id: "what-to-do-if-not-perfect", section: 4, section_name: "Editing a PDF After Remedy508", order_num: 22, title: "What to do if the remediation isn't perfect", summary: "Troubleshooting guide for common imperfections in remediated files and how to address them.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["running-acrobat-checker", "editing-pdf-free-no-acrobat"] },

  // Section 5 — Accessibility Tips & Best Practices
  { id: "accessibility-101-wcag", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 23, title: "Accessibility 101: What WCAG 2.1 AA actually means", summary: "A plain-language explanation of WCAG 2.1 AA — what it requires, why it matters, and how Remedy508 helps.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-law-title-ii", "color-contrast-rule"] },
  { id: "writing-good-alt-text", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 24, title: "Writing good alt text: a 3-minute guide", summary: "The principles of effective alt text — what to include, what to skip, and common mistakes to avoid.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: "3:00", related_ids: ["alt-text-generator", "editing-alt-text-after"] },
  { id: "heading-structure-matters", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 25, title: "Why heading structure matters (and how to do it right)", summary: "How proper heading hierarchy helps screen reader users navigate documents and why most files get it wrong.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "making-tables-accessible"] },
  { id: "color-contrast-rule", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 26, title: "Color contrast: the rule everyone breaks", summary: "What the 4.5:1 contrast ratio requirement means in practice and how to check your own designs.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "common-accessibility-myths"] },
  { id: "making-tables-accessible", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 27, title: "Making tables accessible", summary: "How to structure data tables correctly so screen readers can navigate rows, columns, and headers.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["heading-structure-matters", "accessibility-101-wcag"] },
  { id: "accessibility-law-title-ii", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 28, title: "Accessibility & the law: Title II, Section 508, ADA", summary: "What higher education institutions are legally required to do under Title II, Section 508, and the ADA.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "common-accessibility-myths"] },
  { id: "common-accessibility-myths", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 29, title: "Common accessibility myths, debunked", summary: "Addressing the most common misconceptions about accessibility — what it is, who it's for, and why it's everyone's job.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "accessibility-law-title-ii"] },
  { id: "before-after-real-document", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 30, title: "Before & after: a real document remediated", summary: "A side-by-side walkthrough of an inaccessible document before and after running it through Remedy508.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["document-fixer-word-doc", "understanding-your-results"] },
];

// ── Seed (only if table is empty) ─────────────────────────────────────────────
const count = (db.prepare("SELECT COUNT(*) as c FROM kb_articles").get() as any).c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO kb_articles (id, section, section_name, order_num, title, summary, video_url, video_status, transcript, captions_url, duration, related_ids)
    VALUES (@id, @section, @section_name, @order_num, @title, @summary, @video_url, @video_status, @transcript, @captions_url, @duration, @related_ids)
  `);
  const insertMany = db.transaction((articles: typeof SEED) => {
    for (const a of articles) {
      insert.run({ ...a, related_ids: JSON.stringify(a.related_ids) });
    }
  });
  insertMany(SEED);
  console.log("[KB] Seeded 30 articles");
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function parse(row: any): KbArticle {
  return { ...row, related_ids: JSON.parse(row.related_ids || "[]") };
}

export const kbDb = {
  getAll(): KbArticle[] {
    return db.prepare("SELECT * FROM kb_articles ORDER BY order_num ASC").all().map(parse);
  },
  getById(id: string): KbArticle | null {
    const row = db.prepare("SELECT * FROM kb_articles WHERE id = ?").get(id);
    return row ? parse(row) : null;
  },
  getBySection(section: number): KbArticle[] {
    return db.prepare("SELECT * FROM kb_articles WHERE section = ? ORDER BY order_num ASC").all(section).map(parse);
  },
  search(q: string): KbArticle[] {
    const like = `%${q}%`;
    return db.prepare(`
      SELECT * FROM kb_articles
      WHERE title LIKE ? OR summary LIKE ? OR transcript LIKE ?
      ORDER BY order_num ASC
    `).all(like, like, like).map(parse);
  },
  update(id: string, fields: Partial<Omit<KbArticle, "id" | "updated_at">>): KbArticle | null {
    const article = kbDb.getById(id);
    if (!article) return null;
    const merged = { ...article, ...fields };
    db.prepare(`
      UPDATE kb_articles SET
        video_url = @video_url,
        video_status = @video_status,
        transcript = @transcript,
        captions_url = @captions_url,
        duration = @duration,
        related_ids = @related_ids,
        summary = @summary,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id,
      video_url: merged.video_url,
      video_status: merged.video_status,
      transcript: merged.transcript,
      captions_url: merged.captions_url,
      duration: merged.duration,
      related_ids: JSON.stringify(merged.related_ids),
      summary: merged.summary,
    });
    return kbDb.getById(id);
  },
  getSections(): { section: number; section_name: string; articles: KbArticle[] }[] {
    const all = kbDb.getAll();
    const map = new Map<number, { section: number; section_name: string; articles: KbArticle[] }>();
    for (const a of all) {
      if (!map.has(a.section)) map.set(a.section, { section: a.section, section_name: a.section_name, articles: [] });
      map.get(a.section)!.articles.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.section - b.section);
  },
};
