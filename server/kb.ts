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
  { id: "welcome-to-remedy508", section: 1, section_name: "Getting Started", order_num: 1, title: "Welcome to Remedy508", summary: "An overview of what Remedy508 does and how it helps you create accessible content fast.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["creating-account-logging-in", "tour-of-your-dashboard"] },
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
  { id: "writing-good-alt-text", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 24, title: "Writing good alt text: a quick guide", summary: "The principles of effective alt text — what to include, what to skip, and common mistakes to avoid.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["alt-text-generator", "editing-alt-text-after"] },
  { id: "heading-structure-matters", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 25, title: "Why heading structure matters (and how to do it right)", summary: "How proper heading hierarchy helps screen reader users navigate documents and why most files get it wrong.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "making-tables-accessible"] },
  { id: "color-contrast-rule", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 26, title: "Color contrast: the rule everyone breaks", summary: "What the 4.5:1 contrast ratio requirement means in practice and how to check your own designs.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "common-accessibility-myths"] },
  { id: "making-tables-accessible", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 27, title: "Making tables accessible", summary: "How to structure data tables correctly so screen readers can navigate rows, columns, and headers.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["heading-structure-matters", "accessibility-101-wcag"] },
  { id: "accessibility-law-title-ii", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 28, title: "Accessibility & the law: Title II, Section 508, ADA", summary: "What higher education institutions are legally required to do under Title II, Section 508, and the ADA.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "common-accessibility-myths"] },
  { id: "common-accessibility-myths", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 29, title: "Common accessibility myths, debunked", summary: "Addressing the most common misconceptions about accessibility — what it is, who it's for, and why it's everyone's job.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["accessibility-101-wcag", "accessibility-law-title-ii"] },
  { id: "before-after-real-document", section: 5, section_name: "Accessibility Tips & Best Practices", order_num: 30, title: "Before & after: a real document remediated", summary: "A side-by-side walkthrough of an inaccessible document before and after running it through Remedy508.", video_url: null, video_status: "coming_soon", transcript: null, captions_url: null, duration: null, related_ids: ["document-fixer-word-doc", "understanding-your-results"] },
];

const ARTICLE_CONTENT: Record<string, string> = {
  "welcome-to-remedy508": `<h2>What is Remedy508?</h2>
<p>Remedy508 is an accessibility remediation platform built specifically for higher education. It takes your existing documents, PDFs, Canvas pages, and media files and makes them compliant with WCAG 2.1 Level AA, Section 508, and the ADA — without requiring you to be an accessibility expert.</p>
<h2>Who is it for?</h2>
<p>Remedy508 is designed for faculty, instructional designers, staff, and accessibility coordinators at community colleges and universities. If you create or manage course materials, syllabi, handouts, presentations, or any digital content, Remedy508 is for you.</p>
<h2>What problems does it solve?</h2>
<ul>
  <li><strong>Manual remediation is slow and technical.</strong> Fixing PDFs by hand in Acrobat can take hours. Remedy508 handles the heavy lifting in seconds.</li>
  <li><strong>Compliance pressure is real.</strong> Title II of the ADA now requires digital accessibility for all public college content. Remedy508 helps you meet that standard quickly.</li>
  <li><strong>Most staff aren't trained in accessibility.</strong> You don't need to know WCAG inside and out — Remedy508 applies the correct fixes automatically.</li>
</ul>
<h2>The five tools</h2>
<p>Remedy508 gives you five purpose-built tools:</p>
<ol>
  <li><strong>Document Fixer</strong> — remediates Word documents and converts them to accessible PDFs</li>
  <li><strong>Complex PDF</strong> — handles scanned documents, forms, and multi-column layouts</li>
  <li><strong>Alt Text Generator</strong> — writes accurate, descriptive alt text for images and charts</li>
  <li><strong>Canvas HTML Fixer</strong> — cleans up Canvas LMS page HTML for accessibility</li>
  <li><strong>Video Transcription</strong> — generates captions and full transcripts from video or audio files</li>
</ol>
<h2>Next steps</h2>
<p>Start by creating your account, then head to your dashboard to run your first file through the Document Fixer. Most users see results in under 60 seconds.</p>`,
  "creating-account-logging-in": `<h2>Creating your account</h2>
<p>Go to <strong>remedy508.com</strong> and click <strong>Get Started</strong>. You can sign up with your Google account (recommended for campus users) or with an email and password.</p>
<h3>Recommended: Sign in with Google</h3>
<p>If your institution uses Google Workspace (Gmail, Google Drive), signing in with Google is the fastest option. Click <strong>Continue with Google</strong> and select your institutional or personal Google account. No password to manage — you'll use your existing Google credentials every time.</p>
<h3>Email and password sign-in</h3>
<p>If you prefer a separate login, enter your email address and create a password. You'll receive a verification email — click the link to activate your account before logging in.</p>
<h2>Logging in</h2>
<p>Visit <strong>remedy508.com</strong> and click <strong>Log in</strong> in the top navigation. Use the same method you chose during sign-up (Google or email/password).</p>
<h2>Forgot your password?</h2>
<p>On the login page, click <strong>Forgot password?</strong> and enter your email. You'll receive a reset link within a few minutes. Check your spam folder if you don't see it.</p>
<h2>Troubleshooting login issues</h2>
<ul>
  <li>If you signed up with Google, make sure you're selecting the same Google account on login.</li>
  <li>If your institution blocks third-party sign-in, use the email/password option instead.</li>
  <li>Still stuck? Email <a href="mailto:hello@remedy508.com">hello@remedy508.com</a> and we'll sort it out.</li>
</ul>`,
  "tour-of-your-dashboard": `<h2>Your dashboard at a glance</h2>
<p>After logging in, you land on your dashboard. Here's what you'll find:</p>
<h3>Usage meter</h3>
<p>At the top of your dashboard you'll see your current usage — how many documents you've processed this billing period versus your plan limit. Individual plans include 50 documents per month. Team plans pool usage across seats.</p>
<h3>Quick-access tools</h3>
<p>The five Remedy508 tools are displayed as cards in the center of your dashboard. Click any card to go directly to that tool. You can also access tools from the top navigation under <strong>Tools</strong>.</p>
<h3>Credit pack balance</h3>
<p>If you've purchased credit packs (additional document credits beyond your plan limit), your remaining credit balance is shown here. Credits roll over and are valid for 12 months from purchase.</p>
<h3>Recent activity</h3>
<p>Your most recently processed files appear in the activity feed so you can quickly re-download or review past results.</p>
<h3>Account settings</h3>
<p>Click your name or avatar in the top right to access account settings, billing, and plan management.</p>
<h2>Navigation tips</h2>
<ul>
  <li>Use the top nav to jump between Tools, Pricing, FAQ, and this Knowledge Base.</li>
  <li>On mobile, tap the hamburger menu (≡) to access full navigation.</li>
  <li>The Remedy508 logo in the header always returns you to your dashboard.</li>
</ul>`,
  "uploading-your-first-file": `<h2>Choosing the right tool</h2>
<p>Before uploading, make sure you're using the right tool for your file type:</p>
<ul>
  <li><strong>Word document (.docx)</strong> → Document Fixer</li>
  <li><strong>Standard PDF</strong> → Document Fixer</li>
  <li><strong>Scanned PDF, complex layout, or form</strong> → Complex PDF</li>
  <li><strong>Image with alt text needed</strong> → Alt Text Generator</li>
  <li><strong>Canvas LMS page HTML</strong> → Canvas HTML Fixer</li>
  <li><strong>Video or audio file</strong> → Video Transcription</li>
</ul>
<h2>Uploading your file</h2>
<ol>
  <li>From your dashboard or the Tools page, click the tool you need.</li>
  <li>Click <strong>Choose File</strong> or drag and drop your file into the upload area.</li>
  <li>Confirm the file name looks correct, then click <strong>Submit</strong> (or the equivalent button for that tool).</li>
  <li>Wait while Remedy508 processes your file. Most documents take 15–60 seconds depending on size and complexity.</li>
</ol>
<h2>File size limits</h2>
<p>The current upload limit is <strong>50 MB per file</strong>. If your file is larger, try compressing images in the document first, or split it into sections before uploading.</p>
<h2>Downloading your result</h2>
<p>Once processing is complete, a download button appears. Click it to save the remediated file to your computer. Your result is also saved in your recent activity on the dashboard for 30 days.</p>
<h2>What counts as one document?</h2>
<p>Each file you submit counts as one document against your monthly limit — regardless of page count or file size. A 50-page PDF and a 2-page PDF both count as one document.</p>`,
  "understanding-your-results": `<h2>What Remedy508 fixes</h2>
<p>Depending on the tool used, Remedy508 applies some or all of the following fixes automatically:</p>
<ul>
  <li><strong>Document structure</strong> — adds proper heading tags (H1, H2, H3) based on visual formatting</li>
  <li><strong>Alt text</strong> — generates descriptive alt text for images, charts, and graphics</li>
  <li><strong>Reading order</strong> — sets the logical reading order so screen readers follow the correct sequence</li>
  <li><strong>Table headers</strong> — marks column and row headers so screen readers can announce them correctly</li>
  <li><strong>List markup</strong> — converts visual bullet points into properly tagged lists</li>
  <li><strong>Document language</strong> — sets the language attribute so screen readers use the right pronunciation</li>
  <li><strong>Metadata</strong> — adds a document title and author to the file properties</li>
</ul>
<h2>Reading the output file</h2>
<p>Open your remediated file normally. If it's a PDF, open it in Adobe Acrobat or your browser's built-in PDF viewer. Visually, it should look identical to your original — remediation adds accessibility structure that is invisible to sighted readers but essential for screen reader users.</p>
<h2>Verifying the result</h2>
<p>For PDFs, you can run Adobe Acrobat's built-in Accessibility Checker (<strong>Tools → Accessibility → Full Check</strong>) to confirm the fixes were applied. Most Remedy508 outputs pass with zero or very few remaining issues.</p>
<h2>When the result isn't perfect</h2>
<p>Highly complex documents — scanned pages, intricate tables, multi-column layouts — occasionally need minor manual corrections after remediation. See the articles in Section 4 (Editing a PDF After Remedy508) for guidance on common post-remediation edits.</p>
<h2>Counts and credits</h2>
<p>Your document count updates immediately after a successful submission. If a file fails to process for any reason, it does not count against your limit — contact us and we'll investigate.</p>`,
  "document-fixer-word-doc": `<h2>What the Document Fixer does</h2>
<p>The Document Fixer takes a Word document (.docx) or a standard PDF and applies a full suite of WCAG 2.1 AA accessibility fixes. It returns a remediated PDF ready for distribution.</p>
<h2>Best file types for this tool</h2>
<ul>
  <li>Microsoft Word documents (.docx)</li>
  <li>Text-based PDFs (not scanned) — syllabi, handouts, reports, guides</li>
  <li>PowerPoint files saved as PDF (see Section 3 for export tips)</li>
  <li>Google Docs or Google Slides exported as PDF</li>
</ul>
<h2>Step-by-step</h2>
<ol>
  <li>From your dashboard or the Tools page, click <strong>Document Fixer</strong>.</li>
  <li>Click <strong>Choose File</strong> and select your .docx or PDF.</li>
  <li>Click <strong>Fix Document</strong> and wait. Standard documents typically process in 20–45 seconds.</li>
  <li>When the download button appears, click it to save your remediated PDF.</li>
</ol>
<h2>What gets fixed</h2>
<ul>
  <li>Heading structure and hierarchy</li>
  <li>Alt text for embedded images and charts</li>
  <li>Table header markup</li>
  <li>Reading order and tag structure</li>
  <li>Document title and language metadata</li>
  <li>List tagging</li>
</ul>
<h2>Tips for better results</h2>
<ul>
  <li><strong>Use Word's built-in heading styles</strong> before uploading — Heading 1, Heading 2, etc. Remedy508 reads these to set the correct heading hierarchy.</li>
  <li><strong>Add alt text to images in Word</strong> first if you know exactly what each image conveys. Remedy508 will generate alt text for any images that don't have it, but your manual descriptions are often more accurate.</li>
  <li><strong>Avoid text boxes and floating objects</strong> — these are difficult for any remediation tool to handle correctly.</li>
</ul>
<h2>Limitations</h2>
<p>The Document Fixer is designed for standard single-column documents. For scanned pages, complex multi-column layouts, or fillable forms, use the <strong>Complex PDF</strong> tool instead.</p>`,
  "complex-pdf-remediating": `<h2>When to use Complex PDF</h2>
<p>Use the Complex PDF tool when the standard Document Fixer isn't enough. Common cases include:</p>
<ul>
  <li>Scanned documents (images of paper pages — no selectable text)</li>
  <li>Multi-column layouts like newsletters, textbook pages, or journal articles</li>
  <li>PDFs with complex tables spanning multiple pages</li>
  <li>Fillable forms</li>
  <li>Documents with heavy use of text boxes, sidebars, or callouts</li>
  <li>Any PDF where the Document Fixer result has obvious reading order problems</li>
</ul>
<h2>How it works differently</h2>
<p>The Complex PDF tool uses AI vision to analyze each page as an image, understand the layout, and apply accessibility fixes with awareness of visual context — not just raw text extraction. This is especially important for scanned documents, which have no underlying text at all.</p>
<h2>Step-by-step</h2>
<ol>
  <li>From the Tools page, click <strong>Complex PDF</strong>.</li>
  <li>Upload your PDF. Scanned documents may take longer — allow up to 2–3 minutes for large files.</li>
  <li>Download the remediated result when processing completes.</li>
</ol>
<h2>Processing time</h2>
<p>Complex PDF takes longer than the standard Document Fixer because it analyzes every page visually. Expect:</p>
<ul>
  <li>1–5 pages: 30–60 seconds</li>
  <li>6–20 pages: 1–3 minutes</li>
  <li>20+ pages: 3–5 minutes</li>
</ul>
<h2>Tips for best results</h2>
<ul>
  <li>Scan at <strong>300 DPI or higher</strong> for best OCR accuracy. Low-resolution scans produce poor text recognition.</li>
  <li>Scan in <strong>black and white or grayscale</strong> unless color is essential to the content.</li>
  <li>Straighten pages before scanning — skewed pages confuse layout detection.</li>
</ul>`,
  "alt-text-generator": `<h2>What is alt text?</h2>
<p>Alt text (alternative text) is a written description of an image that screen readers announce to users who cannot see the image. It also displays when an image fails to load. Without alt text, images are completely inaccessible to blind and low-vision users.</p>
<h2>Using the Alt Text Generator</h2>
<ol>
  <li>From the Tools page, click <strong>Alt Text Generator</strong>.</li>
  <li>Upload your image file (JPG, PNG, GIF, WebP, or PDF page) or paste an image URL.</li>
  <li>Click <strong>Generate Alt Text</strong>.</li>
  <li>Review the generated description. Edit it if needed for your specific context.</li>
  <li>Copy the alt text and add it to your document, web page, or LMS content.</li>
</ol>
<h2>What good alt text looks like</h2>
<p>Good alt text is specific, concise, and context-aware. It describes what matters about the image for the purpose it serves in your content.</p>
<ul>
  <li><strong>For a photo of a campus building:</strong> "Three-story brick building with large arched windows and a clock tower, surrounded by mature oak trees"</li>
  <li><strong>For a bar chart:</strong> "Bar chart showing enrollment by department. Engineering has the highest enrollment at 1,240 students, followed by Business at 980 and Liberal Arts at 720."</li>
  <li><strong>For a decorative divider line:</strong> Leave the alt text empty (alt="") — purely decorative images should be hidden from screen readers.</li>
</ul>
<h2>When to use this tool</h2>
<ul>
  <li>Before embedding images in Canvas pages or emails</li>
  <li>When preparing PowerPoint or Word documents for remediation</li>
  <li>For charts, graphs, and infographics where alt text needs to convey data</li>
  <li>For scanned photos or historical images where context may not be obvious</li>
</ul>`,
  "canvas-html-fixer": `<h2>Why Canvas pages need accessibility fixes</h2>
<p>Canvas LMS lets instructors edit page content in a rich text editor, but the underlying HTML it generates often contains accessibility issues — missing heading structure, improper list markup, inline font-size styles instead of semantic tags, and images without alt text. These issues are invisible in the visual editor but break the experience for screen reader users.</p>
<h2>Using the Canvas HTML Fixer</h2>
<ol>
  <li>Open your Canvas page in Edit mode.</li>
  <li>Switch to the <strong>HTML editor</strong> view (click the angle brackets &lt;/&gt; icon in the Canvas toolbar).</li>
  <li>Select all the HTML and copy it.</li>
  <li>Go to Remedy508 → <strong>Canvas HTML Fixer</strong> and paste the HTML into the input field.</li>
  <li>Click <strong>Fix HTML</strong>.</li>
  <li>Copy the cleaned HTML output.</li>
  <li>Return to Canvas, paste the fixed HTML into the HTML editor, then save the page.</li>
</ol>
<h2>What gets fixed</h2>
<ul>
  <li>Heading hierarchy (converting visual bold text to proper H2/H3 tags)</li>
  <li>List markup (unordered and ordered lists)</li>
  <li>Image alt text (generated for any images missing it)</li>
  <li>Removal of empty tags and redundant formatting</li>
  <li>Color contrast issues flagged with suggestions</li>
  <li>Link text improvements (replaces "click here" with descriptive link text)</li>
</ul>
<h2>Important: review before saving</h2>
<p>Always preview the Canvas page after pasting the fixed HTML to confirm the visual appearance is unchanged. The fixer is conservative with structural changes, but a quick visual check takes 30 seconds and prevents surprises.</p>`,
  "video-transcription-captions": `<h2>Why captions and transcripts matter</h2>
<p>Captions are required by WCAG 2.1 AA for all pre-recorded video with audio. Transcripts benefit deaf and hard-of-hearing users, non-native speakers, anyone in a noisy environment, and anyone who prefers to skim content rather than watch a full video.</p>
<h2>What the tool accepts</h2>
<ul>
  <li>Video files: MP4, MOV, AVI, MKV, WebM</li>
  <li>Audio files: MP3, WAV, M4A, AAC, OGG</li>
  <li>Maximum file size: 3 GB</li>
</ul>
<h2>Step-by-step</h2>
<ol>
  <li>From the Tools page, click <strong>Video Transcription</strong>.</li>
  <li>Upload your video or audio file.</li>
  <li>Select the primary language of the content (default: English).</li>
  <li>Click <strong>Transcribe</strong>. Processing time varies by file length — expect roughly 1 minute per 10 minutes of audio.</li>
  <li>Download your results: a <strong>.vtt caption file</strong> and a <strong>plain text transcript</strong>.</li>
</ol>
<h2>Using your captions in Canvas</h2>
<p>If your video is hosted in Canvas Studio or uploaded directly to a Canvas page, you can add the .vtt caption file through the media settings. For YouTube videos, upload the .vtt file via YouTube Studio → Subtitles.</p>
<h2>Using your captions in Kaltura</h2>
<p>Upload the .vtt file as a caption track in Kaltura MediaSpace. Set the language to English and mark it as the default track.</p>
<h2>Accuracy and editing</h2>
<p>Transcription accuracy depends on audio quality. Clear recordings with minimal background noise typically achieve 95%+ accuracy. Always review the transcript before publishing — names, technical terms, and acronyms may need manual correction.</p>`,
  "save-powerpoint-as-pdf": `<h2>Why export method matters</h2>
<p>Not all PDF exports are equal. A poorly exported PowerPoint PDF can lose reading order, embed text as images, or strip out structure that Remedy508 needs to work with. Following these steps gives you the best starting point for remediation.</p>
<h2>Exporting from Microsoft PowerPoint (Windows)</h2>
<ol>
  <li>Go to <strong>File → Save As</strong>.</li>
  <li>Choose <strong>PDF (*.pdf)</strong> from the file type dropdown.</li>
  <li>Click <strong>Options</strong> and make sure <strong>"Document structure tags for accessibility"</strong> is checked.</li>
  <li>Click <strong>OK</strong>, then <strong>Save</strong>.</li>
</ol>
<h2>Exporting from Microsoft PowerPoint (Mac)</h2>
<ol>
  <li>Go to <strong>File → Save As</strong>.</li>
  <li>Select <strong>PDF</strong> from the Format dropdown.</li>
  <li>Click <strong>Best for electronic distribution and accessibility</strong>.</li>
  <li>Click <strong>Export</strong>.</li>
</ol>
<h2>What to avoid</h2>
<ul>
  <li><strong>Don't use "Print to PDF"</strong> — this flattens the file and removes all structure.</li>
  <li><strong>Don't use "Save as Pictures"</strong> — this converts every slide to an image with no readable text.</li>
  <li><strong>Don't export from a preview window</strong> — always export directly from PowerPoint.</li>
</ul>
<h2>After exporting</h2>
<p>Upload the PDF to Remedy508's Document Fixer. If your presentation has complex layouts (overlapping text boxes, multiple columns per slide), use the Complex PDF tool instead.</p>`,
  "save-google-slides-as-pdf": `<h2>Exporting from Google Slides</h2>
<ol>
  <li>Open your Google Slides presentation.</li>
  <li>Go to <strong>File → Download → PDF Document (.pdf)</strong>.</li>
  <li>The file downloads automatically to your Downloads folder.</li>
</ol>
<p>That's it — Google Slides exports clean, text-based PDFs by default. No extra settings needed.</p>
<h2>One slide per page vs. handout layout</h2>
<p>The default export puts one slide per page, which is the best format for Remedy508. If you need a handout layout (multiple slides per page), the text is smaller but still readable. Either format works with the Document Fixer.</p>
<h2>Presenter notes</h2>
<p>If you want to include speaker notes in the PDF, go to <strong>File → Print settings and preview</strong>, select <strong>"1 slide with notes"</strong>, then click the print icon and save as PDF from your browser. Note: this format often requires more manual cleanup after remediation.</p>
<h2>After downloading</h2>
<p>Upload the PDF to Remedy508's Document Fixer. Google Slides PDFs typically remediate cleanly and quickly since they are already well-structured text-based files.</p>`,
  "save-word-doc-as-pdf": `<h2>Should you upload the Word doc or a PDF?</h2>
<p>For most documents, <strong>upload the Word .docx file directly</strong> to the Document Fixer. Remedy508 can read the document structure more accurately from a .docx than from an exported PDF — especially heading styles, table structure, and list formatting.</p>
<p>Convert to PDF first only if:</p>
<ul>
  <li>You need to deliver a PDF (not a Word file) to your users</li>
  <li>The document has complex design elements that must be preserved visually</li>
</ul>
<h2>Exporting to PDF from Word (Windows)</h2>
<ol>
  <li>Go to <strong>File → Save As → PDF (*.pdf)</strong>.</li>
  <li>Before saving, click <strong>Options</strong>.</li>
  <li>Check <strong>"Document structure tags for accessibility"</strong> and <strong>"Create bookmarks using Headings"</strong>.</li>
  <li>Click OK, then Save.</li>
</ol>
<h2>Exporting to PDF from Word (Mac)</h2>
<ol>
  <li>Go to <strong>File → Save As</strong>.</li>
  <li>Choose <strong>PDF</strong> from the Format menu.</li>
  <li>Select <strong>"Best for electronic distribution and accessibility"</strong>.</li>
  <li>Click Export.</li>
</ol>
<h2>Before you export: quick prep checklist</h2>
<ul>
  <li>Use Word's built-in <strong>Heading 1 / Heading 2 / Heading 3</strong> styles for all section titles — don't just bold or enlarge text.</li>
  <li>Add alt text to any images (right-click image → Edit Alt Text).</li>
  <li>Use Word's <strong>Table</strong> feature (not tabs) for any data tables. Mark the first row as a header row.</li>
  <li>Use <strong>Insert → List</strong> for bullet points, not manual hyphens.</li>
</ul>`,
  "export-canva-accessible-pdf": `<h2>The challenge with Canva PDFs</h2>
<p>Canva is popular for creating visually rich documents, but its default PDF export often produces files where text is flattened or reading order is unpredictable. Remedy508 can handle Canva PDFs, but following these steps makes the result significantly better.</p>
<h2>Export settings that help</h2>
<ol>
  <li>Click <strong>Share</strong> in the top right of your Canva design.</li>
  <li>Select <strong>Download</strong>.</li>
  <li>Choose <strong>PDF Standard</strong> (not PDF Print — that version is larger and flattens more elements).</li>
  <li>Uncheck <strong>"Flatten PDF"</strong> if that option appears.</li>
  <li>Click <strong>Download</strong>.</li>
</ol>
<h2>Design tips before exporting</h2>
<ul>
  <li><strong>Use text boxes in logical order.</strong> Canva reads text boxes in the order they were created, not their visual position. If your reading order is important, create text boxes top-to-bottom as they should be read.</li>
  <li><strong>Avoid placing text over complex backgrounds.</strong> This can cause the text to be interpreted as part of an image rather than readable content.</li>
  <li><strong>Add alt text to images.</strong> In Canva, click an image → click the three-dot menu → <strong>Edit alt text</strong>.</li>
</ul>
<h2>After exporting</h2>
<p>Upload to Remedy508's <strong>Complex PDF</strong> tool (not Document Fixer) for Canva files, since Canva layouts often have multiple columns and overlapping elements that benefit from vision-based analysis.</p>`,
  "scan-paper-document-to-pdf": `<h2>When you need to scan</h2>
<p>Physical paper documents — old syllabi, printed handouts, forms, consent documents — can be scanned and remediated through Remedy508's Complex PDF tool. The tool uses AI vision to read scanned pages and apply accessibility structure even when there is no underlying digital text.</p>
<h2>Scanner settings for best results</h2>
<ul>
  <li><strong>Resolution: 300 DPI minimum.</strong> 600 DPI is better for documents with small text. Higher resolution means better OCR (optical character recognition) accuracy.</li>
  <li><strong>Color mode: Black and white or grayscale</strong> for text documents. Use color only if the document uses color to convey information (charts, highlighted text, etc.).</li>
  <li><strong>File format: PDF.</strong> Most scanners can output directly to PDF — use this rather than scanning to image files and combining them.</li>
</ul>
<h2>Physical preparation</h2>
<ul>
  <li>Remove staples and paper clips before scanning.</li>
  <li>Straighten pages — skewed or tilted pages reduce OCR accuracy significantly.</li>
  <li>Flatten creased or folded documents as much as possible.</li>
</ul>
<h2>Scanning with a phone</h2>
<p>If you don't have a scanner, you can use your phone:</p>
<ul>
  <li><strong>iPhone:</strong> Open the Notes app → tap the camera icon → Scan Documents. This automatically straightens and enhances pages.</li>
  <li><strong>Android:</strong> Use Google Drive → tap + → Scan. Saves directly to Drive as a PDF.</li>
  <li><strong>Adobe Scan</strong> (free, iOS and Android) works well for multi-page documents.</li>
</ul>
<h2>After scanning</h2>
<p>Upload the scanned PDF to Remedy508's <strong>Complex PDF</strong> tool. Expect slightly longer processing time for scanned files compared to digital documents.</p>`,
  "what-file-types-accepted": `<h2>Supported file types by tool</h2>
<h3>Document Fixer</h3>
<ul>
  <li>Microsoft Word: .docx</li>
  <li>PDF: .pdf (text-based, not scanned)</li>
</ul>
<h3>Complex PDF</h3>
<ul>
  <li>PDF: .pdf (any — including scanned, multi-column, forms)</li>
</ul>
<h3>Alt Text Generator</h3>
<ul>
  <li>Images: .jpg, .jpeg, .png, .gif, .webp, .bmp</li>
  <li>PDF pages can also be uploaded to generate alt text for embedded images</li>
</ul>
<h3>Canvas HTML Fixer</h3>
<ul>
  <li>Paste HTML directly — no file upload</li>
</ul>
<h3>Video Transcription</h3>
<ul>
  <li>Video: .mp4, .mov, .avi, .mkv, .webm</li>
  <li>Audio: .mp3, .wav, .m4a, .aac, .ogg</li>
</ul>
<h2>File types that need conversion first</h2>
<table>
  <thead><tr><th>Your file type</th><th>Convert to</th><th>Tool to use</th></tr></thead>
  <tbody>
    <tr><td>PowerPoint (.pptx)</td><td>PDF</td><td>Document Fixer or Complex PDF</td></tr>
    <tr><td>Google Slides</td><td>PDF (download from Google)</td><td>Document Fixer</td></tr>
    <tr><td>Google Docs</td><td>PDF or .docx</td><td>Document Fixer</td></tr>
    <tr><td>Excel / Google Sheets</td><td>PDF</td><td>Document Fixer</td></tr>
    <tr><td>InDesign (.indd)</td><td>PDF (export from InDesign)</td><td>Complex PDF</td></tr>
    <tr><td>Publisher (.pub)</td><td>PDF</td><td>Complex PDF</td></tr>
    <tr><td>Scanned images (.jpg, .tiff)</td><td>Combine into PDF</td><td>Complex PDF</td></tr>
  </tbody>
</table>
<h2>File size limit</h2>
<p>Maximum upload size is <strong>50 MB</strong> for documents and images, and <strong>3 GB</strong> for video and audio files. If a document exceeds 50 MB, try reducing image resolution inside the file before uploading.</p>`,
  "opening-remediated-pdf-acrobat": `<h2>Why open in Acrobat?</h2>
<p>While you can open a remediated PDF in any PDF viewer, Adobe Acrobat (Pro or Reader) gives you tools to verify the accessibility fixes, check reading order, view the tag tree, and make manual corrections if needed. For full editing, you need Acrobat Pro.</p>
<h2>Opening your file</h2>
<ol>
  <li>Download your remediated PDF from Remedy508.</li>
  <li>Right-click the file → <strong>Open with → Adobe Acrobat</strong>. Or open Acrobat first, then go to <strong>File → Open</strong>.</li>
</ol>
<h2>Running a quick visual check</h2>
<p>Scroll through the document and confirm:</p>
<ul>
  <li>Text is selectable (click and drag over any paragraph — you should be able to highlight words)</li>
  <li>Images appear correct</li>
  <li>Tables are visually intact</li>
  <li>Page order is correct</li>
</ul>
<h2>Checking the tag structure (Acrobat Pro)</h2>
<ol>
  <li>Go to <strong>View → Show/Hide → Navigation Panes → Tags</strong>.</li>
  <li>The Tags panel on the left shows the document's accessibility structure — headings (H1, H2), paragraphs (P), lists (L, LI), tables (Table, TR, TH, TD), and figures (Figure).</li>
  <li>Click any tag to highlight the corresponding content on the page.</li>
</ol>
<h2>What to look for</h2>
<ul>
  <li>Headings should follow a logical hierarchy: H1 appears once at the top, H2 for major sections, H3 for subsections.</li>
  <li>Images should have a Figure tag with Alt attribute text.</li>
  <li>Tables should have TH tags for header cells and TD for data cells.</li>
</ul>`,
  "fixing-reading-order": `<h2>What is reading order?</h2>
<p>Reading order is the sequence in which a screen reader announces content on a page. In a well-structured document, reading order follows the logical top-to-bottom, left-to-right flow of the content. In complex layouts — multi-column pages, sidebars, callout boxes — the visual and logical order can diverge, causing screen readers to jump around confusingly.</p>
<h2>Checking reading order in Acrobat Pro</h2>
<ol>
  <li>Go to <strong>Tools → Accessibility → Reading Order</strong>.</li>
  <li>The Reading Order tool highlights content regions on each page and numbers them in the order a screen reader will encounter them.</li>
  <li>Verify the numbers follow the logical reading sequence for your content.</li>
</ol>
<h2>Fixing reading order</h2>
<p>If regions are out of order:</p>
<ol>
  <li>In the Reading Order panel, click and drag the content regions to reorder them.</li>
  <li>Alternatively, use the <strong>Order panel</strong> (View → Show/Hide → Navigation Panes → Order) to drag items into the correct sequence.</li>
</ol>
<h2>Common reading order issues in multi-column layouts</h2>
<p>Two-column documents sometimes read left column and right column alternately line-by-line, instead of reading the full left column first, then the right. To fix this in Acrobat Pro:</p>
<ol>
  <li>Open the Order panel.</li>
  <li>Select all items in the right column and drag them below all items in the left column.</li>
</ol>
<h2>When to use Remedy508's Complex PDF instead</h2>
<p>If you're consistently seeing reading order issues with a particular document template, try re-running it through the Complex PDF tool. The vision-based analysis often produces better initial reading order than the standard Document Fixer for complex layouts.</p>`,
  "editing-alt-text-after": `<h2>Reviewing alt text in Acrobat Pro</h2>
<ol>
  <li>Go to <strong>Tools → Accessibility → Reading Order</strong>.</li>
  <li>Click on any image in the document.</li>
  <li>In the Reading Order panel, click <strong>Edit Alternate Text</strong>.</li>
  <li>Review the current alt text and edit it if needed.</li>
  <li>Click <strong>Save</strong>.</li>
</ol>
<h2>Alt text best practices for revision</h2>
<p>When reviewing Remedy508's generated alt text, ask yourself:</p>
<ul>
  <li><strong>Is it specific enough?</strong> "A graph" is not useful. "Bar chart showing fall enrollment by department, with Biology highest at 312 students" is useful.</li>
  <li><strong>Does it include data?</strong> For charts and graphs, the alt text should convey the key data or trend, not just describe the chart type.</li>
  <li><strong>Is it too long?</strong> Alt text should be concise — under 150 characters when possible. For complex images, use a caption or surrounding text to provide more detail.</li>
  <li><strong>Is it decorative?</strong> If an image is purely decorative (a design border, a stock photo that adds no information), the alt text should be empty (alt=""). In Acrobat, mark the image as an Artifact instead of a Figure.</li>
</ul>
<h2>Marking an image as decorative in Acrobat Pro</h2>
<ol>
  <li>Open the Tags panel.</li>
  <li>Find the Figure tag for the decorative image.</li>
  <li>Right-click the tag → <strong>Change Tag to Artifact</strong>.</li>
  <li>Screen readers will skip artifacts entirely.</li>
</ol>`,
  "running-acrobat-checker": `<h2>What the Acrobat Accessibility Checker checks</h2>
<p>Adobe Acrobat's Accessibility Checker runs a systematic review of your PDF against PDF/UA and WCAG 2.1 AA standards, checking for:</p>
<ul>
  <li>Document title presence</li>
  <li>Language setting</li>
  <li>Tagged content (all content properly tagged)</li>
  <li>Tab order</li>
  <li>Logical heading structure</li>
  <li>Alt text on all figures</li>
  <li>Table header markup</li>
  <li>Color contrast (flagged, not auto-fixed)</li>
</ul>
<h2>Running the check</h2>
<ol>
  <li>In Acrobat Pro, go to <strong>Tools → Accessibility → Full Check</strong>.</li>
  <li>Leave all options checked and click <strong>Start Checking</strong>.</li>
  <li>The Accessibility Checker panel opens on the left with results categorized as <strong>Passed</strong>, <strong>Failed</strong>, <strong>Needs manual check</strong>, or <strong>Skipped</strong>.</li>
</ol>
<h2>Interpreting results</h2>
<ul>
  <li><strong>Passed</strong> — no issue found, no action needed.</li>
  <li><strong>Failed</strong> — a specific accessibility requirement was not met. Right-click any failed item to see fix options.</li>
  <li><strong>Needs manual check</strong> — Acrobat cannot automatically verify this rule (e.g., whether alt text is meaningful, not just present). You must review manually.</li>
  <li><strong>Skipped</strong> — the check was not applicable to this document.</li>
</ul>
<h2>Common failures and quick fixes</h2>
<ul>
  <li><strong>Title: Failed</strong> → File → Properties → Description tab → enter a document title.</li>
  <li><strong>Primary language not set</strong> → File → Properties → Advanced → Language → select English (or your document language).</li>
  <li><strong>Figures alternate text: Failed</strong> → Follow the steps in "Editing alt text after remediation."</li>
</ul>`,
  "editing-pdf-free-no-acrobat": `<h2>Free options for reviewing remediated PDFs</h2>
<p>Adobe Acrobat Pro costs money. If you don't have it, here are free alternatives for common post-remediation tasks.</p>
<h3>Adobe Acrobat Reader (free)</h3>
<p>The free Reader lets you view, navigate, and annotate PDFs. It does not let you edit tags, reading order, or alt text — but it's useful for visual review and for checking that text is selectable.</p>
<h3>PDF Accessibility Checker (PAC 2024)</h3>
<p>PAC is a free Windows application from the PDF/UA Foundation that runs a thorough accessibility check — more detailed than Acrobat's built-in checker in some ways. Download at <strong>pdfua.foundation/pac</strong>. Highly recommended for verifying remediation results without Acrobat Pro.</p>
<h3>PDF Mage or PDF24 (browser-based)</h3>
<p>These free web tools allow basic PDF editing — reordering pages, merging files, and simple text edits. They don't support tag editing but can help with structural document issues.</p>
<h3>Microsoft Word round-trip</h3>
<p>For documents that started as Word files, you can:</p>
<ol>
  <li>Open the original .docx in Word.</li>
  <li>Make structural corrections (fix heading styles, add alt text to images, fix tables).</li>
  <li>Re-export to PDF with accessibility settings.</li>
  <li>Re-upload to Remedy508 for a fresh remediation pass.</li>
</ol>
<p>This round-trip approach often produces better results than trying to fix a PDF after the fact.</p>`,
  "what-to-do-if-not-perfect": `<h2>First: understand what type of issue you're seeing</h2>
<p>Not every imperfection requires the same response. Common post-remediation issues fall into a few categories:</p>
<h3>Structural issues (heading order, reading order)</h3>
<p>These can be fixed manually in Acrobat Pro, or by correcting the source document and re-running through Remedy508. If your original Word document used bold text instead of Heading styles, fix that in Word and re-upload.</p>
<h3>Alt text that's inaccurate or too generic</h3>
<p>Review and edit alt text in Acrobat Pro (see "Editing alt text after remediation"). For charts and graphs, you will almost always want to manually specify the key data points rather than rely on auto-generated descriptions.</p>
<h3>Tables not reading correctly</h3>
<p>Complex or merged-cell tables are the hardest thing to remediate automatically. If your table has merged cells or unusual structure, the Complex PDF tool may produce better results. For highly complex tables, manual Acrobat Pro tag editing may be needed.</p>
<h3>Scanned pages not recognized correctly</h3>
<p>Poor scan quality is the most common cause of OCR failures. Rescan at 300 DPI or higher, straighten the pages, and try again.</p>
<h2>When to contact support</h2>
<p>If you're consistently getting poor results with a specific document type or template, email <a href="mailto:hello@remedy508.com">hello@remedy508.com</a> with the original file and the remediated output. We can often identify why and suggest a better workflow — or improve the tool to handle your specific case.</p>
<h2>Iterating is normal</h2>
<p>For brand new document templates, the first remediation run often surfaces issues in the source document structure. Fix those issues in the original file, re-upload, and the second run almost always produces a significantly better result.</p>`,
  "accessibility-101-wcag": `<h2>What WCAG stands for</h2>
<p>WCAG stands for <strong>Web Content Accessibility Guidelines</strong>. It's the internationally recognized standard for digital accessibility, developed by the World Wide Web Consortium (W3C). WCAG 2.1 Level AA is the specific version and conformance level required by most laws and regulations in the United States.</p>
<h2>The four principles (POUR)</h2>
<p>WCAG is organized around four principles. All digital content must be:</p>
<ul>
  <li><strong>Perceivable</strong> — users can perceive all information, regardless of how they access it. Example: images have alt text so blind users can hear a description via screen reader.</li>
  <li><strong>Operable</strong> — users can navigate and interact using any input method. Example: all functionality works with a keyboard, not just a mouse.</li>
  <li><strong>Understandable</strong> — content is readable and predictable. Example: forms explain errors clearly and language is plain.</li>
  <li><strong>Robust</strong> — content works with current and future assistive technologies. Example: HTML is valid and properly structured.</li>
</ul>
<h2>Levels A, AA, and AAA</h2>
<p>WCAG has three conformance levels:</p>
<ul>
  <li><strong>Level A</strong> — minimum requirements. Very basic fixes. Not sufficient on its own for legal compliance.</li>
  <li><strong>Level AA</strong> — the standard required by law for most organizations. This is what Remedy508 targets.</li>
  <li><strong>Level AAA</strong> — the highest level. Exceeds most legal requirements. Not always achievable for all content types.</li>
</ul>
<h2>Key WCAG 2.1 AA requirements for documents</h2>
<ul>
  <li>Text alternatives (alt text) for all non-text content</li>
  <li>Captions for all pre-recorded video with audio</li>
  <li>Logical heading structure</li>
  <li>4.5:1 color contrast ratio for normal text</li>
  <li>Meaningful link text (not "click here")</li>
  <li>Proper table markup with headers</li>
  <li>Document language specified</li>
</ul>
<h2>How Remedy508 helps</h2>
<p>Remedy508 automatically applies the most common Level AA document requirements — alt text, heading structure, reading order, table headers, language attributes — so you meet the standard without needing to know every WCAG rule by heart.</p>`,
  "writing-good-alt-text": `<h2>The purpose of alt text</h2>
<p>Alt text conveys the same information or function that an image provides to a sighted reader. If a sighted person would gain something meaningful from looking at the image, that meaning belongs in the alt text.</p>
<h2>The three types of images</h2>
<h3>1. Informative images</h3>
<p>Images that convey information not available in surrounding text. Write alt text that describes the relevant content.</p>
<p><em>Example:</em> A photo of a student using a screen reader at a computer.<br><strong>Good alt text:</strong> "Student seated at a desk using a screen reader with headphones, reading a textbook PDF on screen."</p>
<h3>2. Functional images</h3>
<p>Images used as buttons, links, or controls. Describe what the image does, not what it looks like.</p>
<p><em>Example:</em> A magnifying glass icon that opens a search box.<br><strong>Good alt text:</strong> "Search"</p>
<h3>3. Decorative images</h3>
<p>Images that are purely aesthetic and add no information. Use empty alt text (alt="") or mark as an Artifact in Acrobat. Screen readers will skip them.</p>
<h2>Writing alt text for charts and graphs</h2>
<p>Data visualizations require alt text that conveys the key data or trend, not just the chart type.</p>
<p><em>Example:</em> A bar chart showing monthly enrollment.<br><strong>Poor alt text:</strong> "Bar chart showing enrollment data"<br><strong>Good alt text:</strong> "Bar chart showing monthly enrollment from August to December 2024. Enrollment peaks in August at 3,240 students and declines to 2,890 by December."</p>
<h2>Length guidelines</h2>
<ul>
  <li>Aim for under 150 characters for simple images.</li>
  <li>For complex images with significant data, use a visible caption or adjacent description in addition to alt text.</li>
  <li>Do not start with "Image of" or "Picture of" — screen readers already announce that it's an image.</li>
</ul>`,
  "heading-structure-matters": `<h2>What headings do for accessibility</h2>
<p>Headings are the primary navigation tool for screen reader users. Most screen reader users press H to jump from heading to heading to quickly scan a document or page — just like sighted users visually skim bold titles. Without proper heading structure, a 20-page document becomes a wall of undifferentiated text that must be read linearly from start to finish.</p>
<h2>The heading hierarchy</h2>
<ul>
  <li><strong>H1</strong> — the document title. There should be exactly one H1 per document.</li>
  <li><strong>H2</strong> — major section headings.</li>
  <li><strong>H3</strong> — subsection headings within H2 sections.</li>
  <li><strong>H4, H5, H6</strong> — deeper nesting, rarely needed in course materials.</li>
</ul>
<p>The rule: you cannot skip heading levels. An H3 must always be inside an H2. An H2 must always be inside an H1. If you find yourself wanting to use a heading style for its visual appearance rather than its structural meaning, that's the wrong approach — use CSS or paragraph formatting instead.</p>
<h2>The most common mistake: using bold instead of headings</h2>
<p>Visually, bold 14pt text looks like a heading. To a screen reader, it's just a bold paragraph — it doesn't appear in the heading navigation list and provides no structure. Always use your application's built-in heading styles.</p>
<h2>How to fix this in Word</h2>
<ol>
  <li>Select the text that should be a heading.</li>
  <li>In the Styles panel (Home tab), click <strong>Heading 1</strong>, <strong>Heading 2</strong>, or <strong>Heading 3</strong>.</li>
  <li>If you don't like the default heading appearance, modify the style — don't abandon the semantic tag.</li>
</ol>
<h2>How to fix this in Canvas</h2>
<p>In Canvas's rich text editor, use the <strong>Paragraph</strong> dropdown to select Heading 2 or Heading 3 for section titles. Don't just bold and enlarge text.</p>`,
  "color-contrast-rule": `<h2>The WCAG 2.1 AA contrast requirement</h2>
<p>WCAG 2.1 AA requires a minimum contrast ratio of <strong>4.5:1</strong> between text and its background for normal-sized text, and <strong>3:1</strong> for large text (18pt or larger, or 14pt bold).</p>
<p>Contrast ratio measures the luminance difference between two colors on a scale from 1:1 (identical — invisible) to 21:1 (black on white — maximum contrast).</p>
<h2>Why this matters</h2>
<p>Approximately 8% of men and 0.5% of women have some form of color vision deficiency. Low contrast text is also difficult to read in bright sunlight, on older monitors, or for anyone with aging eyesight. Good contrast helps everyone.</p>
<h2>Common contrast failures in course materials</h2>
<ul>
  <li>Light gray text on a white background (very common in slide templates)</li>
  <li>Yellow or light green text on white</li>
  <li>White text on light blue or light teal backgrounds</li>
  <li>Red text on green backgrounds (also fails for colorblind users)</li>
</ul>
<h2>How to check contrast</h2>
<p>Free tools:</p>
<ul>
  <li><strong>WebAIM Contrast Checker</strong> — webaim.org/resources/contrastchecker — enter your foreground and background hex color codes to get the ratio instantly.</li>
  <li><strong>Colour Contrast Analyser</strong> (free download) — pick colors directly from your screen with an eyedropper tool.</li>
  <li><strong>Adobe Acrobat Pro</strong> — the Accessibility Checker flags potential contrast issues (though it cannot auto-fix them).</li>
</ul>
<h2>Fixing contrast issues</h2>
<p>Darken the text color or lighten/darken the background. Even small adjustments can push a failing ratio over 4.5:1. Run the WebAIM checker before finalizing any document template or slide design.</p>`,
  "making-tables-accessible": `<h2>Why tables break for screen readers</h2>
<p>A sighted reader can look at a table and immediately understand the relationship between row headers, column headers, and data cells. A screen reader user navigating a table cell-by-cell needs the table's markup to specify those relationships explicitly — otherwise every cell is just a random number or word with no context.</p>
<h2>The essential fix: header cells</h2>
<p>Every table must have header cells (TH tags) that identify what each row or column represents. Without them, a screen reader announces cell content but cannot tell the user which column or row the cell belongs to.</p>
<h2>Creating accessible tables in Word</h2>
<ol>
  <li>Insert a table using <strong>Insert → Table</strong> (not tabs or spaces).</li>
  <li>Select the first row (your column headers).</li>
  <li>Right-click → <strong>Table Properties → Row tab</strong> → check <strong>"Repeat as header row at the top of each page"</strong>.</li>
  <li>This tells Word (and Remedy508) that this row contains column headers.</li>
</ol>
<h2>Creating accessible tables in Canvas</h2>
<ol>
  <li>Insert a table using the Canvas editor's table tool.</li>
  <li>Right-click in the header row → <strong>Row Properties</strong> → set Row Type to <strong>Header</strong>.</li>
</ol>
<h2>Tables to avoid</h2>
<ul>
  <li><strong>Layout tables</strong> — don't use tables to arrange visual content (two-column layouts, image grids). Use CSS or columns for layout. Tables should only be used for actual data with clear row/column relationships.</li>
  <li><strong>Merged cells</strong> — merged header cells (colspan, rowspan) are much harder for screen readers to navigate. Simplify table structure where possible.</li>
  <li><strong>Nested tables</strong> — a table inside a table cell is very difficult to navigate with a screen reader. Restructure the data instead.</li>
</ul>`,
  "accessibility-law-title-ii": `<h2>The legal landscape for higher education</h2>
<p>Three major legal frameworks govern digital accessibility for public colleges and universities in the United States. Remedy508 is built to help you meet all three.</p>
<h2>Title II of the ADA</h2>
<p>Title II of the Americans with Disabilities Act applies to all state and local government entities — including public community colleges and universities. In April 2024, the Department of Justice finalized a rule establishing that <strong>WCAG 2.1 Level AA is the specific technical standard</strong> that Title II requires for web content and mobile apps.</p>
<p>Key deadlines:</p>
<ul>
  <li><strong>April 24, 2026</strong> — compliance required for institutions with 50,000+ population (city/county population, not enrollment)</li>
  <li><strong>April 26, 2027</strong> — compliance required for smaller institutions</li>
</ul>
<p>Most California community colleges and CSU/UC campuses fall under the earlier deadline.</p>
<h2>Section 508 of the Rehabilitation Act</h2>
<p>Section 508 applies to federal agencies and organizations that receive federal funding. It requires that electronic and information technology (including documents, software, and websites) be accessible to people with disabilities.</p>
<p>For higher education, Section 508 specifically governs content in federally funded programs — which includes virtually all financial aid, research grants, and Title IV programs.</p>
<h2>Section 504 of the Rehabilitation Act</h2>
<p>Section 504 prohibits discrimination against people with disabilities by programs that receive federal financial assistance. It's broader than Section 508 and covers the full educational experience — ensuring students with disabilities have equivalent access to course materials is a Section 504 obligation.</p>
<h2>What this means practically</h2>
<p>Any document, PDF, video, or web page you distribute to students as part of a course or campus service should meet WCAG 2.1 AA. This includes:</p>
<ul>
  <li>Syllabi and course handouts</li>
  <li>Canvas pages and module content</li>
  <li>Presentation slides shared with students</li>
  <li>Library resources and research guides</li>
  <li>Administrative forms and policy documents</li>
</ul>`,
  "common-accessibility-myths": `<h2>Myth 1: "Accessibility is only for blind people"</h2>
<p><strong>Reality:</strong> Accessibility benefits a much broader population. Captions help deaf and hard-of-hearing users — but also people in noisy environments, non-native speakers, and anyone who processes information better through reading. High contrast text helps colorblind users — but also people reading on phones in sunlight. Logical heading structure helps screen reader users navigate — but also sighted users who skim documents. The disability community represents 26% of U.S. adults, and accessibility improvements improve the experience for everyone.</p>
<h2>Myth 2: "Our students haven't complained, so we're fine"</h2>
<p><strong>Reality:</strong> Students with disabilities are less likely to complain than to quietly drop a course or seek accommodations through disability services. Inaccessible materials disproportionately disadvantage students who are already navigating additional barriers. Lack of complaints is not evidence of accessibility — it's evidence that students have learned not to expect it.</p>
<h2>Myth 3: "Accessible design is ugly design"</h2>
<p><strong>Reality:</strong> Good accessibility and good design are not in conflict. Color contrast requirements don't prevent beautiful color choices — they prevent unreadable ones. Heading structure doesn't restrict visual layout — it enriches it with meaning. Some of the most well-designed documents and websites in the world are also fully accessible.</p>
<h2>Myth 4: "We have a Disability Services office — that's their job"</h2>
<p><strong>Reality:</strong> Disability Services provides individualized accommodations for students with documented disabilities. But accessibility is not an accommodation — it's a baseline requirement for all content. Waiting for a student to request accommodations and then providing an accessible version is reactive and legally insufficient under the ADA. Content should be accessible before it reaches students.</p>
<h2>Myth 5: "It's too expensive and time-consuming"</h2>
<p><strong>Reality:</strong> Retrofitting inaccessible content after the fact is expensive. Building accessibility in from the start — or using tools like Remedy508 to remediate efficiently — is far cheaper than dealing with complaints, OCR investigations, or litigation. The DOJ's 2024 Title II rule makes this a compliance cost, not an optional one.</p>`,
  "before-after-real-document": `<h2>The document: a community college syllabus</h2>
<p>This walkthrough uses a real-world example: a 4-page course syllabus created in Microsoft Word and exported to PDF. This document type is among the most commonly distributed and most frequently inaccessible files in higher education.</p>
<h2>Before remediation: what was wrong</h2>
<h3>No heading structure</h3>
<p>The instructor used bold, centered, 14pt text to create section titles like "Course Requirements" and "Grading Policy." Visually they looked like headings. In the PDF tag tree, they were plain paragraphs. A screen reader user had no way to jump between sections.</p>
<h3>An image with no alt text</h3>
<p>The syllabus included a course diagram — a flowchart showing the relationship between assignments. No alt text was present. A screen reader would announce "Unlabeled figure" and move on, leaving the student without any information about the chart's content.</p>
<h3>A table with no header row</h3>
<p>The grading breakdown was in a table: Category | Points | Percentage. Without a header row, a screen reader navigating the table would announce "Midterm Exam, 150, 30%" with no way for the user to know which column each value belonged to.</p>
<h3>No document language</h3>
<p>The PDF had no language attribute set. Screen readers default to whatever language the user has set on their device — if an English document is read by a screen reader set to Spanish, it may mispronounce every word.</p>
<h2>After Remedy508: what changed</h2>
<ul>
  <li>All bold section titles promoted to H2 tags. The document now has a navigable heading structure.</li>
  <li>The course diagram received generated alt text describing the assignment flow.</li>
  <li>The grading table has TH tags on the header row. Screen readers now announce column context with every cell.</li>
  <li>Language attribute set to English.</li>
</ul>
<h2>The result</h2>
<p>Visually, the document looks identical. For a screen reader user, it went from an inaccessible wall of text to a structured, navigable document that communicates the same information available to sighted readers.</p>`,
};

// ── Seed (only if table is empty) ─────────────────────────────────────────────
const count = (db.prepare("SELECT COUNT(*) as c FROM kb_articles").get() as any).c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO kb_articles (id, section, section_name, order_num, title, summary, video_url, video_status, transcript, captions_url, duration, related_ids)
    VALUES (@id, @section, @section_name, @order_num, @title, @summary, @video_url, @video_status, @transcript, @captions_url, @duration, @related_ids)
  `);
  const insertMany = db.transaction((articles: typeof SEED) => {
    for (const a of articles) {
      insert.run({
        ...a,
        related_ids: JSON.stringify(a.related_ids),
        transcript: ARTICLE_CONTENT[a.id] ?? null,
      });
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
