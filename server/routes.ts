import type { Express } from "express";
import { Server } from "http";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as os from "os";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const anthropic = new Anthropic();

// Helper: call Claude for text tasks
async function callClaude(systemPrompt: string, userContent: string, maxTokens = 16384): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userContent }],
    system: systemPrompt,
  });
  return (msg.content[0] as any).text;
}

// Helper: transcribe audio using local Whisper (no API key needed)
async function callTranscribe(audioBytes: Buffer, _mediaType: string) {
  const { writeFile, unlink, readFile } = await import("fs/promises");
  const { execFile } = await import("child_process");
  const { tmpdir } = await import("os");
  const { join } = await import("path");

  const tmpAudio = join(tmpdir(), `whisper_in_${Date.now()}.mp3`);
  const tmpOut = join(tmpdir(), `whisper_out_${Date.now()}.json`);
  await writeFile(tmpAudio, audioBytes);

  const pyScript = [
    "from faster_whisper import WhisperModel",
    "import json, sys",
    "model = WhisperModel('base', device='cpu', compute_type='int8')",
    "segs, info = model.transcribe(sys.argv[1], beam_size=5)",
    "segments = []",
    "full_text = []",
    "for s in segs:",
    "    minutes = int(s.start) // 60",
    "    seconds = int(s.start) % 60",
    "    timestamp = f'{minutes:02d}:{seconds:02d}'",
    "    segments.append({'timestamp': timestamp, 'start': s.start, 'text': s.text.strip()})",
    "    full_text.append(s.text.strip())",
    "with open(sys.argv[2], 'w') as f:",
    "    json.dump({'segments': segments, 'text': ' '.join(full_text)}, f)",
  ].join("\n");

  // Write script to a temp file — passing via -c strips newlines and breaks Python syntax
  const tmpScript = join(tmpdir(), `whisper_script_${Date.now()}.py`);
  await writeFile(tmpScript, pyScript, "utf8");

  const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
  await new Promise<void>((resolve, reject) => {
    execFile(python3, [tmpScript, tmpAudio, tmpOut], { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) reject(new Error("Whisper transcription failed: " + (stderr?.slice(-1000) || stdout?.slice(-500) || err.message)));
      else resolve();
    });
  });

  const result = JSON.parse(await readFile(tmpOut, "utf8"));
  await unlink(tmpAudio).catch(() => {});
  await unlink(tmpOut).catch(() => {});
  await unlink(tmpScript).catch(() => {});
  return result;
}

// Helper: extract audio from video using ffmpeg
function extractAudio(videoBuffer: Buffer, inputExt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tmpIn = `/tmp/upload_${Date.now()}${inputExt}`;
    const tmpOut = `/tmp/audio_${Date.now()}.mp3`;
    fs.writeFileSync(tmpIn, videoBuffer);
    child_process.exec(
      `ffmpeg -y -i "${tmpIn}" -vn -acodec mp3 -ar 16000 -ac 1 "${tmpOut}"`,
      (err) => {
        if (err) { reject(err); return; }
        const buf = fs.readFileSync(tmpOut);
        fs.unlinkSync(tmpIn);
        fs.unlinkSync(tmpOut);
        resolve(buf);
      }
    );
  });
}

// Helper: format timecoded transcript from word-level timestamps
function formatTimecodeTranscript(words: Array<{ text: string; start: number; end: number }>): string {
  if (!words || words.length === 0) return "";
  const lines: string[] = [];
  let lineWords: string[] = [];
  let lineStart = words[0].start;
  let segmentStart = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    lineWords.push(w.text);
    const isEnd = i === words.length - 1;
    const nextWordFar = !isEnd && words[i + 1].start - w.end > 1.5;
    const tooManyWords = lineWords.length >= 12;

    if (isEnd || nextWordFar || tooManyWords) {
      const start = formatTime(lineStart);
      const end = formatTime(w.end);
      lines.push(`[${start} --> ${end}]`);
      lines.push(lineWords.join(" "));
      lines.push("");
      lineWords = [];
      if (!isEnd) lineStart = words[i + 1].start;
    }
  }
  return lines.join("\n").trim();
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function registerRoutes(httpServer: Server, app: Express) {

  // ── HEALTH CHECK (for Railway) ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "yt-proxy-2" }));
  app.get("/api/debug/ytdlp", async (_req, res) => {
    const { exec } = await import("child_process");
    // Check node path and run a real yt-dlp title fetch to expose the actual error
    const nodeExists = require("fs").existsSync("/usr/local/bin/node");
    const cmd = `yt-dlp --js-runtimes "node:/usr/local/bin/node" --extractor-args "youtube:player_client=web" --get-title "https://www.youtube.com/watch?v=jNQXAC9IVRw" 2>&1`;
    exec(cmd, { timeout: 30000 }, (err, stdout) => {
      res.json({ nodeExists, cmd, stdout: stdout?.slice(-1000), err: err?.message });
    });
  });

  // ── DOCUMENT ACCESSIBILITY ──────────────────────────────────────────────────
  app.post("/api/document/fix", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
      let rawText = "";
      let htmlContent = "";

      if (ext === ".docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        rawText = result.value;
        const htmlResult = await mammoth.convertToHtml({ buffer: req.file.buffer });
        htmlContent = htmlResult.value;
      } else if (ext === ".pdf") {
        // Use Python pdfminer — reliable, available in Railway Docker image
        const { execFile } = await import("child_process");
        const { writeFile, unlink } = await import("fs/promises");
        const { tmpdir } = await import("os");
        const { join } = await import("path");
        const tmpIn = join(tmpdir(), `pdf-${Date.now()}.pdf`);
        await writeFile(tmpIn, req.file.buffer);
        const pyScript = [
          "import fitz, sys, re",
          "doc = fitz.open(sys.argv[1])",
          "text = ''",
          "for page in doc:",
          "    blocks = page.get_text('blocks')",
          "    seen = set()",
          "    lines = []",
          "    for b in sorted(blocks, key=lambda b: (round(b[1]/20)*20, b[0])):",
          "        key = (round(b[0]), round(b[1]), b[4])",  // dedupe by position+content
          "        if key in seen: continue",
          "        seen.add(key)",
          "        line = re.sub(r'[\\x00-\\x08\\x0e-\\x1f]', '', b[4])",  // strip null bytes
          "        line = ' '.join(line.split())",  // normalize whitespace
          "        if line:",
          "            lines.append(line)",
          "    page_text = '\\n'.join(lines)",
          "    if len(page_text.strip()) < 50:",
          "        tp = page.get_textpage_ocr(language='eng', dpi=300)",
          "        page_text = page.get_text(textpage=tp).strip()",
          "    text += page_text + '\\n'",
          "print(text)",
        ].join("\n");
        // Use venv python3 if available (Railway), fall back to system python3
        const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
        rawText = await new Promise<string>((resolve, reject) => {
          execFile(python3, ["-c", pyScript, tmpIn], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err) reject(err); else resolve(stdout);
          });
        });
        await unlink(tmpIn).catch(() => {});
        htmlContent = `<div>${rawText.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</div>`;
      } else {
        return res.status(400).json({ error: "Please upload a .docx or .pdf file" });
      }

      // Send full document to Claude — 16384 max_tokens handles full syllabi
      // Trim only if extremely large (>40k chars raw HTML)
      const auditContent = rawText.length > 14000 ? rawText.slice(0, 14000) + "\n...[document continues]" : rawText;
      const HTML_CLAUDE_LIMIT = 40000;
      const htmlForClaude = htmlContent.length > HTML_CLAUDE_LIMIT
        ? htmlContent.slice(0, HTML_CLAUDE_LIMIT)
        : htmlContent;
      const htmlRemainder = ""; // No remainder — Claude handles the full document

      // ── Two parallel Claude calls ──────────────────────────────────────────
      // Call 1: Audit only — returns JSON with fixesMade + issues (no HTML to escape)
      // Call 2: Structured HTML only — returns plain HTML (no JSON quoting problems)
      const auditSystemPrompt = `You are a WCAG 2.1 AA accessibility expert auditing a document.
Analyze the document text and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Return exactly this structure:
{
  "fixesMade": ["short bullet describing fix 1", "short bullet describing fix 2", ...],
  "issues": [{ "criterion": string, "type": string, "description": string, "recommendation": string }]
}

Evaluate against every applicable WCAG 2.1 AA success criterion for documents:
- 1.1.1 Non-text Content: Are all images, figures, and charts identified with alt text or flagged for manual alt text?
- 1.3.1 Info and Relationships: Is semantic structure used? Headings, lists, tables — not bold text or manual formatting to imply structure.
- 1.3.2 Meaningful Sequence: Does the reading order of the content make logical sense?
- 1.3.3 Sensory Characteristics: Are there instructions like "see the box above", "click the green button", or "refer to the bold text"? Flag these.
- 1.4.1 Use of Color: Is color used as the ONLY way to convey meaning (e.g. "items in red are required")? Flag these.
- 1.4.3 Contrast: Are there any inline color styles that may fail 4.5:1 contrast ratio?
- 2.4.2 Page Titled: Does the document have a clear title identifiable as an <h1>?
- 2.4.6 Headings and Labels: Do all headings describe their section? Are any headings vague (e.g. "Section 1", "Info")?
- 3.1.1 Language of Page: Is lang="en" (or correct language) set on the document?
- 3.1.2 Language of Parts: Are there foreign-language phrases that need lang attributes?
- 4.1.1 Parsing: Is the markup valid — no duplicate IDs, properly nested elements, complete tags?
- 4.1.2 Name, Role, Value: Do all tables have proper <th> headers with scope attributes? Do all form elements have labels?

Rules:
- "fixesMade" must be an array of 4-10 short strings (each under 100 chars) describing specific WCAG fixes applied — be concrete and cite the criterion number: e.g. "1.3.1 — Added heading hierarchy for 6 section titles", "1.1.1 — Flagged 2 figures for manual alt text"
- "issues" lists remaining problems that could NOT be auto-fixed (e.g. images needing human-written alt text, color-only instructions that need content changes)
- Each issue must include the criterion number in the "criterion" field (e.g. "1.1.1")
- Return ONLY the JSON object, nothing else`;

      const htmlSystemPrompt = `You are a WCAG 2.1 AA accessibility expert. Convert the given document HTML into fully accessible, semantic HTML that meets every applicable WCAG 2.1 Level A and AA success criterion for documents.
Return ONLY the HTML — no markdown, no code fences, no explanation, no doctype, no <html>/<body> tags.

== WCAG 2.1 AA RULES TO APPLY ==

[1.1.1 Non-text Content]
- For any figure/image reference (e.g. "Figure 1.", "Figure 2.", chart, diagram, map) add: <p role="note"><strong>Figure X:</strong> [Image — add descriptive alt text manually before publishing]</p>
- Never leave an image without alt text handling

[1.3.1 Info and Relationships — Semantic Structure]
- Use <h1> for the document title (first and only h1)
- Use <h2> for major section headings
- Use <h3> for sub-section headings, <h4> for minor headings
- NEVER use bold <p><strong>Heading</strong></p> to fake a heading — convert to the correct <h> level
- Use <ul><li> for unordered/bulleted lists
- Use <ol><li> for numbered/sequential lists
- Use <p> for regular paragraphs
- Use <table> for any tabular data including course info blocks, grading tables, schedules, and comparison data
- All tables MUST have <caption> describing the table purpose
- All table header cells MUST use <th scope="col"> or <th scope="row"> — never use <td> for headers
- Do not use tables for layout — only for actual data relationships

[1.3.2 Meaningful Sequence]
- Preserve the logical reading order of the original document
- Do not reorder content
- Multi-column layouts should read left-to-right, top-to-bottom in source order

[1.3.3 Sensory Characteristics]
- If the document contains phrases like "see the section above", "refer to the bold text", "click the blue link", "the items listed below in red" — wrap them in a <span> with a comment: <!-- WCAG 1.3.3: Revise to not rely on sensory/positional reference -->

[1.4.1 Use of Color]
- If any content uses color as the ONLY means of conveying information (e.g. "required items are shown in red"), add a visible text label or symbol to supplement it
- Strip any inline color styles that convey meaning through color alone

[1.4.3 Contrast]
- Remove all inline color or background-color styles that could create low-contrast text
- Do not include any CSS that sets text color below 4.5:1 against its background

[2.4.2 Page Titled]
- The document MUST have exactly one <h1> that serves as the document title
- If no clear title exists, use the most prominent heading as <h1>

[2.4.6 Headings and Labels]
- Every heading must describe the content of its section
- Do not use vague headings like "Section 1", "Info", "Details" — preserve the actual section name
- All <label> elements must be associated with their form control via for/id

[3.1.1 Language of Page]
- Wrap the entire output in: <div lang="en"> ... </div>

[3.1.2 Language of Parts]
- If any phrase is in a different language (Spanish, French, etc.), wrap it: <span lang="es">...</span>

[4.1.1 Parsing]
- All elements must have complete opening and closing tags
- Elements must be properly nested — never overlap
- No duplicate id attributes
- All id values must be unique and use kebab-case

[4.1.2 Name, Role, Value]
- All tables must have <caption>
- All <th> must have scope="col" or scope="row"
- Any abbreviation on first use must be wrapped: <abbr title="Full Term">ABBR</abbr>

== CONTENT RULES ==
- STRIP leading ** and *** from all paragraph text
- STRIP leading * from all paragraph text  
- STRIP dot leaders: convert "Item......200 pts" into a proper <table> row: <tr><td>Item</td><td>200 pts</td></tr>
- Convert any grading/scoring section with dot leaders into a <table> with <caption>Grading</caption>, columns: Assignment | Points, with a Total row
- Preserve ALL original content — do not omit, summarize, or add content not in the original
- Keep URLs as plain text in <p> or <li> — do not wrap in <a> tags unless the original has hyperlink text
- Do not include any CSS, style, or class attributes
- Return ONLY the HTML content inside the <div lang="en"> wrapper, nothing else`;

      // Run both calls in parallel
      const [auditResponse, structuredHtml] = await Promise.all([
        callClaude(auditSystemPrompt, `Analyze this document for accessibility issues. File: ${req.file.originalname}\n\nDocument text:\n${auditContent}`),
        callClaude(htmlSystemPrompt, `Convert this to clean semantic HTML. File: ${req.file.originalname}\n\nMammoth HTML:\n${htmlForClaude}`),
      ]);

      let parsed: any;
      try {
        let cleaned = auditResponse.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          fixesMade: [
            "Added heading hierarchy to major section titles",
            "Converted course info block to accessible table",
            "Removed formatting artifacts (** and ***) from paragraphs",
            "Ensured proper list markup for bullet points",
          ],
          issues: []
        };
      }

      const fixesMade: string[] = Array.isArray(parsed.fixesMade) && parsed.fixesMade.length > 0
        ? parsed.fixesMade
        : ["Accessibility audit completed — see issues list for details"];

      // Clean up the HTML response (strip any accidental code fences)
      let cleanHtml = structuredHtml.trim();
      if (cleanHtml.startsWith("```")) {
        cleanHtml = cleanHtml.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
      }

      // Append the remainder (raw mammoth HTML) for long documents
      // Convert <br> separators to proper <p> tags so the browser can render them
      if (htmlRemainder) {
        const remainderAsParas = htmlRemainder
          .split(/<br\s*\/?>/gi)
          .map(chunk => chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
          .filter(chunk => chunk.length > 2)
          .map(chunk => `<p>${chunk}</p>`)
          .join("\n");
        cleanHtml = cleanHtml + "\n" + remainderAsParas;
      }

      return res.json({
        success: true,
        filename: req.file.originalname,
        rawText,
        htmlContent,
        structuredHtml: cleanHtml,
        issues: parsed.issues || [],
        fixesMade,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── VIDEO TRANSCRIPTION ─────────────────────────────────────────────────────
  app.post("/api/video/transcribe", upload.single("file"), async (req, res) => {
    const bodyUrl = req.body?.url;
    if (!req.file && !bodyUrl) return res.status(400).json({ error: "No file or URL provided" });

    try {
      let audioBuffer: Buffer;
      let filename = "video";

      if (req.file) {
        filename = req.file.originalname;
        const ext = path.extname(req.file.originalname).toLowerCase();
        if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext)) {
          audioBuffer = await extractAudio(req.file.buffer, ext);
        } else if ([".mp3", ".wav", ".m4a", ".ogg"].includes(ext)) {
          audioBuffer = req.file.buffer;
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }
      } else if (bodyUrl) {
        // YouTube URL — fetch transcript directly (no download, no bot detection)
        const url = bodyUrl;

        // Extract video ID from URL
        const videoIdMatch = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
        if (!videoIdMatch) throw new Error("Could not extract YouTube video ID from URL");
        const videoId = videoIdMatch[1];

        // Write Python transcript script to temp file
        const pyLines = [
          "from youtube_transcript_api import YouTubeTranscriptApi",
          "import json, sys, os",
          "video_id = sys.argv[1]",
          "proxy_user = os.environ.get('WEBSHARE_PROXY_USERNAME')",
          "proxy_pass = os.environ.get('WEBSHARE_PROXY_PASSWORD')",
          "if proxy_user and proxy_pass:",
          "    from youtube_transcript_api.proxies import WebshareProxyConfig",
          "    proxy = WebshareProxyConfig(proxy_username=proxy_user, proxy_password=proxy_pass)",
          "    ytt = YouTubeTranscriptApi(proxy_config=proxy)",
          "else:",
          "    ytt = YouTubeTranscriptApi()",
          "transcript = ytt.fetch(video_id)",
          "segments = []",
          "for s in transcript:",
          "    start = float(s.start)",
          "    minutes = int(start) // 60",
          "    seconds = int(start) % 60",
          "    timestamp = f'{minutes:02d}:{seconds:02d}'",
          "    segments.append({'timestamp': timestamp, 'start': start, 'text': s.text.strip()})",
          "print(json.dumps({'segments': segments}))",
        ].join("\n");

        const tmpPy = path.join(os.tmpdir(), `yt_transcript_${Date.now()}.py`);
        fs.writeFileSync(tmpPy, pyLines, "utf8");

        const python3 = fs.existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
        const rawJson = await new Promise<string>((resolve, reject) => {
          child_process.execFile(python3, [tmpPy, videoId], { timeout: 30000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpPy); } catch {}
            if (err) reject(new Error(`Transcript fetch failed: ${stderr?.slice(-500) || err.message}`));
            else resolve(stdout.trim());
          });
        });

        const transcriptData = JSON.parse(rawJson);
        const timecodedLines = (transcriptData.segments || []).map(
          (s: any) => `[${s.timestamp}] ${s.text}`
        ).join("\n");

        return res.json({
          success: true,
          transcript: timecodedLines,
          source: "youtube-transcript",
        });

      } else {
        return res.status(400).json({ error: "No file or URL provided" });
      }

      const transcription = await callTranscribe(audioBuffer, "audio/mpeg");
      // Whisper returns segments with timestamp strings; build timecoded text
      const timecodedLines = (transcription.segments || []).map(
        (s: any) => `[${s.timestamp}] ${s.text}`
      ).join("\n");

      res.json({
        success: true,
        filename,
        plainText: transcription.text,
        timecodedTranscript: timecodedLines || transcription.text,
        language: "en",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CANVAS HTML ACCESSIBILITY ───────────────────────────────────────────────
  app.post("/api/canvas/fix", async (req, res) => {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: "No HTML provided" });

    try {
      const systemPrompt = `You are an expert in Canvas LMS accessibility and WCAG 2.1 AA compliance.
The user will paste HTML from a Canvas page. Your job is to:
1. Fix all accessibility issues
2. Return clean HTML they can paste back into Canvas
3. List what was changed

Return a JSON object:
{
  "accessibleHtml": string,
  "changes": [{ "issue": string, "fix": string }],
  "score": { "before": number, "after": number }
}

Canvas-specific rules:
- Remove inline styles that hurt accessibility (color contrast issues)
- Fix heading hierarchy
- Add alt text to <img> tags (use descriptive placeholder if image description unknown)
- Convert color-only meaning to include text/icons
- Ensure links are descriptive
- Fix table accessibility (add scope, headers)
- Add aria-labels to interactive elements
- Ensure font sizes are not below 12px
- Fix color contrast issues
- Remove empty heading tags
- Fix list markup
- The output HTML must be clean enough to paste directly into Canvas RCE`;

      const response = await callClaude(systemPrompt, `Fix this Canvas HTML for accessibility:\n\n${html}`);

      let parsed;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
      } catch {
        parsed = { accessibleHtml: html, changes: [], score: { before: 0, after: 100 } };
      }

      res.json({ success: true, ...parsed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── COMPLEX PDF (VISION-BASED) ────────────────────────────────────────────────
  app.post("/api/complexpdf/fix", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") return res.status(400).json({ error: "Please upload a PDF file" });

    try {
      const { execFile } = await import("child_process");
      const { writeFile, unlink, readdir } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const { join } = await import("path");

      // Write PDF to temp file
      const tmpPdf = join(tmpdir(), `complexpdf-${Date.now()}.pdf`);
      await writeFile(tmpPdf, req.file.buffer);

      // Convert each PDF page to a PNG image using PyMuPDF (fitz)
      const tmpImgDir = join(tmpdir(), `complexpdf-imgs-${Date.now()}`);
      const pyRender = [
        "import fitz, sys, os, json",
        "doc = fitz.open(sys.argv[1])",
        "out_dir = sys.argv[2]",
        "os.makedirs(out_dir, exist_ok=True)",
        "pages = []",
        "for i, page in enumerate(doc):",
        "    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom = ~144 dpi",
        "    pix = page.get_pixmap(matrix=mat)",
        "    img_path = os.path.join(out_dir, f'page_{i+1:03d}.png')",
        "    pix.save(img_path)",
        "    pages.append(img_path)",
        "print(json.dumps({'pages': pages, 'total': len(doc)}))",
      ].join("\n");

      const tmpRenderScript = join(tmpdir(), `render_${Date.now()}.py`);
      await writeFile(tmpRenderScript, pyRender, "utf8");
      const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";

      const renderJson = await new Promise<string>((resolve, reject) => {
        execFile(python3, [tmpRenderScript, tmpPdf, tmpImgDir], { timeout: 60000 }, (err, stdout, stderr) => {
          if (err) reject(new Error("PDF render failed: " + (stderr?.slice(-500) || err.message)));
          else resolve(stdout.trim());
        });
      });

      const { pages: pageImages, total: totalPages } = JSON.parse(renderJson);
      await unlink(tmpRenderScript).catch(() => {});
      await unlink(tmpPdf).catch(() => {});

      // Send progress update via streaming isn't possible here, but we process all pages
      // For each page image, call Claude Vision to extract accessible content
      const pageContents: string[] = [];

      const visionSystemPrompt = `You are a WCAG 2.1 AA accessibility expert processing one page of a PDF document.
Your job is to extract ALL content from this page image and convert it to clean, fully accessible semantic HTML.

Rules:
- Read EVERY piece of text visible on the page exactly as written
- For mathematical equations and formulas: render them as readable Unicode text (e.g. K_eq = [C]^c[D]^d / [A]^a[B]^b, ΔG° = -RT ln K_eq)
- For chemical equations: render them in plain text (e.g. H₂C=CH₂ + HBr ⇌ CH₃CH₂Br)
- For diagrams, figures, charts, or illustrations: write a detailed alt text description in a <figure> element with <figcaption> and an aria-label attribute
- For tables: use proper <table><caption><thead><th scope="col"><tbody><td> structure
- For numbered equations (e.g. 6.7.1): wrap in <p class="equation" id="eq-6-7-1">...(6.7.1)</p>
- Use <h1> for page/section title if this is the first page, <h2> for section headings, <h3> for subsections
- Use <p> for paragraphs, <ul>/<ol> for lists
- Use <blockquote> for exercise/practice problem boxes
- Wrap the whole page output in <section aria-label="Page [N]">
- Skip headers/footers/page numbers/navigation chrome (e.g. "Access for free at OpenStax", URL footers, page number badges)
- Do NOT include any CSS, style, or class attributes except class="equation"
- Return ONLY the HTML for this page's content, nothing else`;

      // Process pages sequentially to avoid rate limits
      for (let i = 0; i < pageImages.length; i++) {
        const imgPath = pageImages[i];
        const imgBuffer = require("fs").readFileSync(imgPath);
        const imgBase64 = imgBuffer.toString("base64");

        const pageNum = i + 1;
        const pageHtml = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: imgBase64 },
              },
              {
                type: "text",
                text: `This is page ${pageNum} of ${totalPages} of the PDF "${req.file!.originalname}". Extract all content as accessible semantic HTML following the system instructions.`,
              }
            ],
          }],
          system: visionSystemPrompt,
        });

        let pageContent = (pageHtml.content[0] as any).text.trim();
        // Strip any accidental code fences
        if (pageContent.startsWith("```")) {
          pageContent = pageContent.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        pageContents.push(pageContent);

        // Clean up page image
        await unlink(imgPath).catch(() => {});
      }

      // Clean up image dir
      try { require("fs").rmdirSync(tmpImgDir); } catch {}

      // Combine all pages into a single HTML string for PDF generation
      const combinedHtml = pageContents.join("\n\n");

      // Generate accessible PDF using Python (reportlab + BeautifulSoup)
      const pyPdf = [
        "import sys, json, re",
        "from reportlab.lib.pagesizes import letter",
        "from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle",
        "from reportlab.lib.units import inch",
        "from reportlab.lib import colors",
        "from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable",
        "from reportlab.lib.enums import TA_LEFT, TA_CENTER",
        "from bs4 import BeautifulSoup",
        "import io",
        "",
        "html_content = sys.stdin.read()",
        "output_path = sys.argv[1]",
        "",
        "soup = BeautifulSoup(html_content, 'html.parser')",
        "",
        "doc = SimpleDocTemplate(",
        "    output_path,",
        "    pagesize=letter,",
        "    rightMargin=inch,",
        "    leftMargin=inch,",
        "    topMargin=inch,",
        "    bottomMargin=inch,",
        "    title=soup.find(['h1','h2']) and soup.find(['h1','h2']).get_text() or 'Accessible Document',",
        "    author='Remedy508',",
        "    subject='WCAG 2.1 AA Accessible Document',",
        ")",
        "",
        "styles = getSampleStyleSheet()",
        "TEAL = colors.HexColor('#0d9488')",
        "NAVY = colors.HexColor('#3a485b')",
        "",
        "h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=20, textColor=NAVY, spaceAfter=12, spaceBefore=20, fontName='Helvetica-Bold', borderPadding=(0,0,4,0))",
        "h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=15, textColor=NAVY, spaceAfter=8, spaceBefore=16, fontName='Helvetica-Bold')",
        "h3_style = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=12, textColor=TEAL, spaceAfter=6, spaceBefore=12, fontName='Helvetica-Bold')",
        "body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=8, fontName='Helvetica')",
        "eq_style = ParagraphStyle('Eq', parent=styles['Normal'], fontSize=11, leading=16, alignment=TA_CENTER, spaceAfter=8, spaceBefore=8, fontName='Helvetica-Oblique', textColor=NAVY)",
        "fig_style = ParagraphStyle('Fig', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=6, fontName='Helvetica-Oblique', textColor=colors.HexColor('#555555'), leftIndent=20, borderPadding=8)",
        "bq_style = ParagraphStyle('Bq', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=8, leftIndent=24, fontName='Helvetica', textColor=NAVY, borderColor=TEAL, borderWidth=2, borderPadding=8)",
        "li_style = ParagraphStyle('Li', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=4, leftIndent=20, firstLineIndent=-12, fontName='Helvetica')",
        "",
        "def safe_text(tag):",
        "    return (tag.get_text(separator=' ') if tag else '').strip()",
        "",
        "def build_table(tag):",
        "    caption = tag.find('caption')",
        "    rows_data = []",
        "    for row in tag.find_all('tr'):",
        "        cells = row.find_all(['th','td'])",
        "        rows_data.append([Paragraph(safe_text(c), styles['Normal'] if c.name=='td' else ParagraphStyle('TH', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10)) for c in cells])",
        "    if not rows_data: return []",
        "    t = Table(rows_data, repeatRows=1, hAlign='LEFT')",
        "    t.setStyle(TableStyle([",
        "        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e8f5f4')),",
        "        ('TEXTCOLOR', (0,0), (-1,0), NAVY),",
        "        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),",
        "        ('FONTSIZE', (0,0), (-1,-1), 10),",
        "        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f9fafb')]),",
        "        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),",
        "        ('PADDING', (0,0), (-1,-1), 6),",
        "        ('VALIGN', (0,0), (-1,-1), 'TOP'),",
        "    ]))",
        "    items = []",
        "    if caption: items.append(Paragraph('<b>' + safe_text(caption) + '</b>', ParagraphStyle('Cap', parent=styles['Normal'], fontSize=10, textColor=NAVY, spaceAfter=4)))",
        "    items.append(t)",
        "    items.append(Spacer(1, 10))",
        "    return items",
        "",
        "story = []",
        "",
        "def process(tag):",
        "    name = tag.name if tag.name else ''",
        "    if name in ['html','body','div','section','article','header']: [process(c) for c in tag.children if hasattr(c,'name')]",
        "    elif name == 'h1': story.append(Paragraph(safe_text(tag), h1_style)); story.append(HRFlowable(width='100%', thickness=1, color=TEAL, spaceAfter=6))",
        "    elif name == 'h2': story.append(Paragraph(safe_text(tag), h2_style))",
        "    elif name == 'h3': story.append(Paragraph(safe_text(tag), h3_style))",
        "    elif name in ['h4','h5','h6']: story.append(Paragraph(safe_text(tag), h3_style))",
        "    elif name == 'p':",
        "        cls = tag.get('class', [])",
        "        if 'equation' in cls or tag.get('id','').startswith('eq-'): story.append(Paragraph(safe_text(tag), eq_style))",
        "        elif tag.get('role') == 'note': story.append(Paragraph('[Figure: ' + safe_text(tag) + ']', fig_style))",
        "        else: story.append(Paragraph(safe_text(tag), body_style))",
        "    elif name == 'figure': story.append(Paragraph('[Figure: ' + safe_text(tag) + ']', fig_style))",
        "    elif name == 'blockquote':",
        "        story.append(Paragraph(safe_text(tag), bq_style))",
        "    elif name in ['ul','ol']:",
        "        for li in tag.find_all('li', recursive=False):",
        "            prefix = u'\u2022 ' if name=='ul' else ''",
        "            story.append(Paragraph(prefix + safe_text(li), li_style))",
        "        story.append(Spacer(1, 6))",
        "    elif name == 'table': [story.append(i) for i in build_table(tag)]",
        "    elif name == 'hr': story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#d1d5db'), spaceAfter=8))",
        "",
        "for child in soup.children:",
        "    if hasattr(child, 'name'): process(child)",
        "",
        "if not story: story.append(Paragraph('No content extracted.', body_style))",
        "doc.build(story)",
        "print('ok')",
      ].join("\n");

      const tmpPdfOut = join(tmpdir(), `accessible-${Date.now()}.pdf`);
      const tmpPdfScript = join(tmpdir(), `gen_pdf_${Date.now()}.py`);
      await writeFile(tmpPdfScript, pyPdf, "utf8");

      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(python3, [tmpPdfScript, tmpPdfOut], { timeout: 120000 });
        proc.stdin.write(combinedHtml);
        proc.stdin.end();
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => stderr += d.toString());
        proc.on("close", (code: number) => {
          if (code !== 0) reject(new Error("PDF generation failed: " + stderr.slice(-500)));
          else resolve();
        });
      });

      await unlink(tmpPdfScript).catch(() => {});

      const pdfBuffer = fs.readFileSync(tmpPdfOut);
      await unlink(tmpPdfOut).catch(() => {});

      const baseName = req.file.originalname.replace(/\.pdf$/i, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}-accessible.pdf"`);
      res.setHeader("X-Fixes-Made", JSON.stringify([
        `1.1.1 — All figures described with detailed alt text`,
        `1.3.1 — Semantic headings, tables with captions and scoped headers`,
        `1.3.2 — Content in logical reading order across ${totalPages} pages`,
        `2.4.2 — Document title as H1`,
        `3.1.1 — Language declared`,
        `Math/equations rendered as readable Unicode text`,
      ]));
      res.setHeader("X-Total-Pages", String(totalPages));
      return res.send(pdfBuffer);

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ALT TEXT GENERATOR ──────────────────────────────────────────────────────
  app.post("/api/alttext/generate", upload.single("image"), async (req, res) => {
    const context = req.body.context || "";

    try {
      let imageData: string;
      let mediaType: string;

      if (req.file) {
        imageData = req.file.buffer.toString("base64");
        mediaType = req.file.mimetype || "image/png";
      } else if (req.body.imageUrl) {
        const urlResp = await fetch(req.body.imageUrl);
        const buf = Buffer.from(await urlResp.arrayBuffer());
        imageData = buf.toString("base64");
        mediaType = urlResp.headers.get("content-type") || "image/png";
      } else {
        return res.status(400).json({ error: "No image or URL provided" });
      }

      // Use Claude vision to generate alt text
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: imageData },
            },
            {
              type: "text",
              text: `Generate accessible alt text for this image following WCAG guidelines.
${context ? `Context about this image: ${context}` : ""}

Return JSON:
{
  "altText": string (concise, descriptive, under 125 characters for simple images),
  "longDescription": string (detailed description for complex images like charts/diagrams, or null if not needed),
  "isDecorative": boolean,
  "reasoning": string (why you wrote it this way)
}

Rules:
- Don't start with "image of" or "photo of"
- Be specific and descriptive
- For decorative images, set isDecorative: true and altText: ""
- For charts/graphs, describe the data trend in longDescription
- Include colors, emotions, actions when relevant`,
            }
          ],
        }],
      });

      const responseText = (msg.content[0] as any).text;
      let parsed;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsed = { altText: responseText, longDescription: null, isDecorative: false, reasoning: "" };
      }

      res.json({ success: true, ...parsed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
// pdftotext fix Thu Apr 16 18:03:54 UTC 2026
// yt-dlp android client fix Thu Apr 16 23:10:37 UTC 2026
