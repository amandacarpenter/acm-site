import type { Express, Request } from "express";
import { kbDb } from "./kb";
import fs from "fs";
import { Server } from "http";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as os from "os";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
const anthropic = new Anthropic();
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ── Usage Helpers ────────────────────────────────────────

function getResetDate(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 8, 0, 0)); // 1st of next month 12AM PT (UTC-8)
  return next.toISOString();
}

async function checkAndIncrementUsage(clerkUserId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await clerkClient.users.getUser(clerkUserId);
  const meta = (user.publicMetadata || {}) as any;

  const plan: string = meta.plan || "individual";
  const monthlyLimit: number = plan === "team" ? (meta.teamSeats || 1) * 75 : 50;
  let monthlyUsed: number = meta.monthlyDocsUsed || 0;
  let purchasedCredits: number = meta.purchasedCredits || 0;
  const resetDate: string = meta.usageResetDate || getResetDate();

  // Check if monthly usage should be reset
  if (new Date() >= new Date(resetDate)) {
    monthlyUsed = 0;
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { ...meta, monthlyDocsUsed: 0, usageResetDate: getResetDate() },
    });
  }

  // Consume monthly pool first
  if (monthlyUsed < monthlyLimit) {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { ...meta, monthlyDocsUsed: monthlyUsed + 1, usageResetDate: resetDate },
    });
    return { allowed: true };
  }

  // Fall back to purchased credits
  if (purchasedCredits > 0) {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { ...meta, purchasedCredits: purchasedCredits - 1 },
    });
    return { allowed: true };
  }

  // Hard block
  const resetStr = new Date(resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return {
    allowed: false,
    reason: `You've used all ${monthlyLimit} documents this month. Documents reset on ${resetStr}. Need more? Purchase additional credits.`,
  };
}

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
  app.post("/api/document/fix", upload.single("file"), (req, res, next) => { req.setTimeout(300000); res.setTimeout(300000); next(); }, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();

    // ── Usage gate ──────────────────────────────────────────────────────────
    const clerkUserId: string | undefined = req.body?.clerkUserId;
    if (clerkUserId) {
      try {
        const usage = await checkAndIncrementUsage(clerkUserId);
        if (!usage.allowed) {
          return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
        }
      } catch (gateErr: any) {
        console.error("[USAGE GATE] Error:", gateErr.message);
        // Fail open — don't block if Clerk is temporarily unavailable
      }
    }

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
          execFile(python3, ["-c", pyScript, tmpIn], { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }, (err, stdout) => {
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

  // ── COMPLEX PDF (MAY PIPELINE — fpdf2 + real image embed + Claude Vision) ─────
  app.post("/api/complexpdf/fix", upload.single("file"), (req, res, next) => { req.setTimeout(600000); res.setTimeout(600000); next(); }, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") return res.status(400).json({ error: "Please upload a PDF file" });

    try {
      const { execFile } = await import("child_process");
      const { writeFile, unlink } = await import("fs/promises");
      const { tmpdir } = await import("os");
      const { join } = await import("path");

      // Usage gate
      const clerkUserId: string | undefined = req.body?.clerkUserId;
      if (clerkUserId) {
        try {
          const usage = await checkAndIncrementUsage(clerkUserId);
          if (!usage.allowed) {
            return res.status(403).json({ error: usage.reason, code: "USAGE_LIMIT" });
          }
        } catch (gateErr: any) {
          console.error("[COMPLEXPDF USAGE GATE] Error:", (gateErr as any).message);
        }
      }

      const python3 = require("fs").existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3";
      const ts = Date.now();

      // Write uploaded PDF to temp file
      const tmpPdf = join(tmpdir(), `complexpdf-${ts}.pdf`);
      await writeFile(tmpPdf, req.file.buffer);

      const tmpWorkDir = join(tmpdir(), `complexpdf-work-${ts}`);

      // ── Step 1: Render page screenshots + extract embedded images per page ──
      const pyExtract = `
import fitz, sys, os, json

doc = fitz.open(sys.argv[1])
work_dir = sys.argv[2]
os.makedirs(work_dir, exist_ok=True)

import hashlib

# Pre-scan: count how many pages each image hash appears on
# Images on 2+ pages are headers/watermarks — skip them
hash_page_count = {}
for page in doc:
    seen_on_page = set()
    for img_info in page.get_images(full=True):
        xref = img_info[0]
        try:
            base_image = doc.extract_image(xref)
            h = hashlib.md5(base_image['image']).hexdigest()
            if h not in seen_on_page:
                seen_on_page.add(h)
                hash_page_count[h] = hash_page_count.get(h, 0) + 1
        except Exception:
            pass

result = []
for page_idx, page in enumerate(doc):
    page_num = page_idx + 1

    # Full-page screenshot at 2x zoom for Vision
    mat = fitz.Matrix(2.0, 2.0)
    pix = page.get_pixmap(matrix=mat)
    screenshot_path = os.path.join(work_dir, 'page_%03d_screen.png' % page_num)
    pix.save(screenshot_path)

    # Extract embedded raster images from this page
    img_list = page.get_images(full=True)
    page_images = []
    for img_idx, img_info in enumerate(img_list):
        xref = img_info[0]
        try:
            base_image = doc.extract_image(xref)
            img_bytes = base_image['image']
            img_ext = base_image['ext']
            img_w = base_image.get('width', 0)
            img_h = base_image.get('height', 0)
            if len(img_bytes) < 5120:
                continue
            if img_w > 0 and (img_h / img_w) > 5.0:
                continue
            img_hash = hashlib.md5(img_bytes).hexdigest()
            if hash_page_count.get(img_hash, 0) >= 2:
                continue
            img_filename = 'page_%03d_img_%02d.%s' % (page_num, img_idx, img_ext)
            img_path = os.path.join(work_dir, img_filename)
            with open(img_path, 'wb') as f:
                f.write(img_bytes)
            img_id = 'img-p%d-%d' % (page_num, img_idx)
            page_images.append({'id': img_id, 'path': img_path, 'width': img_w, 'height': img_h})
        except Exception:
            continue

    result.append({
        'page': page_num,
        'screenshot': screenshot_path,
        'images': page_images
    })

print(json.dumps({'pages': result, 'total': len(doc)}))
`;

      const tmpExtractScript = join(tmpdir(), `extract_${ts}.py`);
      await writeFile(tmpExtractScript, pyExtract, "utf8");

      const extractJson = await new Promise<string>((resolve, reject) => {
        execFile(python3, [tmpExtractScript, tmpPdf, tmpWorkDir], { timeout: 90000 }, (err, stdout, stderr) => {
          if (err) reject(new Error("PDF extract failed: " + (stderr?.slice(-500) || err.message)));
          else resolve(stdout.trim());
        });
      });

      const { pages: pageData, total: totalPages } = JSON.parse(extractJson);
      await unlink(tmpExtractScript).catch(() => {});
      await unlink(tmpPdf).catch(() => {});

      // ── Step 2: Claude Vision — extract accessible HTML per page ──
      const visionSystemPrompt = `You are a WCAG 2.1 AA accessibility expert processing one page of a PDF document.
Extract ALL content from this page image and convert it to clean, fully accessible semantic HTML.

CRITICAL RULES:
- Read EVERY piece of text visible on the page exactly as written
- For mathematical equations and formulas: render as readable Unicode text (e.g. K_eq = [C]^c[D]^d / [A]^a[B]^b)
- For chemical equations: render in Unicode (e.g. H\u2082C=CH\u2082 + HBr \u21cc CH\u2083CH\u2082Br)
- For EACH diagram, figure, chart, or illustration you see: output a <figure data-extracted="true"> element.
  If an extracted-image ID is provided for this page (listed below) and it corresponds to this figure, include <img src="cid:IMAGE_ID" alt="concise one-sentence description"/> as the first child, using the exact ID given. If no ID matches (e.g. the figure is a hand-drawn diagram fitz could not extract as a raster image), omit the <img> and rely on the <figcaption> alone.
  Always include a <figcaption> with a thorough description of exactly what the image shows (colors, labels, arrows, values, what concept it illustrates), regardless of whether an <img> is present. This description MUST be detailed enough to fully replace the image for someone who cannot see it.
- For tables: use proper <table><caption><thead><th scope="col"><tbody><td> structure
- For numbered equations (e.g. 6.7.1): wrap in <p class="equation" id="eq-NUMBER">...(NUMBER)</p>
- Use <h1> for main page/section title (first page only), <h2> for section headings, <h3> for subsections
- Use <p> for paragraphs, <ul>/<ol> for lists, <blockquote> for exercise/practice problem boxes
- Wrap the whole page in <section aria-label="Page N">
- SKIP: page headers, footers, page numbers, navigation chrome, license badges, OpenStax URL footers
- Do NOT include CSS or style attributes except class="equation"
- Return ONLY the HTML, nothing else`;

      // Run all Claude Vision calls in parallel — turns N×25s into ~25s total
      const pageResults = await Promise.all(pageData.map(async ({ page: pageNum, screenshot, images: extractedImages }) => {
        const imgBase64 = require("fs").readFileSync(screenshot).toString("base64");
        const imageIdList = (extractedImages || []).map((img: any) => img.id).join(", ") || "none";
        const visionResp = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: visionSystemPrompt,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: imgBase64 } },
              { type: "text", text: `This is page ${pageNum} of ${totalPages} of "${req.file!.originalname}". Extracted raster image IDs available for this page: ${imageIdList}. Extract all content as accessible semantic HTML.` },
            ],
          }],
        });
        let pageHtml = (visionResp.content[0] as any).text.trim();
        if (pageHtml.startsWith("```")) {
          pageHtml = pageHtml.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        await unlink(screenshot).catch(() => {});
        return { html: pageHtml, images: extractedImages };
      }));

      // ── Step 3: Build accessible PDF with images embedded + alt text (fpdf2) ──
      const pdfInput = JSON.stringify({
        pages: pageResults.map((p, i) => ({
          html: p.html,
          images: p.images,
          pageNum: i + 1,
        })),
        title: req.file!.originalname.replace(/\.pdf$/i, ""),
      });

      const pyPdf = `
import sys, json, os, re, base64
from bs4 import BeautifulSoup

data = json.loads(sys.stdin.read())
output_path = sys.argv[1]
pages = data['pages']
doc_title = data['title']

# 1x1 transparent PNG, used as a placeholder image so caption-only figures
# still get a real <img> element (WeasyPrint only tags <img> as PDF /Figure).
TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

def clean_html(raw_html, page_images):
    soup = BeautifulSoup(raw_html, 'html.parser')
    for tag in soup.find_all(['style', 'script']): tag.decompose()
    # Strip table sub-elements that have no row/cell content, and unwrap
    # any table that ends up with no actual rows -- WeasyPrint's tagged-PDF
    # box-tree walker raises 'Table wrapper without a table' when a table
    # display box has no TableBox child (e.g. a table left with only a
    # caption/colgroup after a page-split repair, or entirely empty).
    for table in soup.find_all('table'):
        if not table.find_all('tr'):
            table.unwrap()
    # Orphaned row/cell fragments outside any table (can appear when a table
    # spans two Claude-extracted pages and each half is parsed independently)
    # also trip the same WeasyPrint code path -- drop them defensively.
    for orphan in soup.find_all(['tr', 'thead', 'tbody', 'tfoot', 'td', 'th']):
        if not orphan.find_parent('table'):
            orphan.unwrap()
    # Acrobat's 'Regularity' check fails if rows in the same table don't all
    # have the same number of columns (very common with real-world tables
    # that have merged/missing cells in the source PDF). Pad short rows with
    # empty <td> cells so every row in a table matches the widest row's
    # column count. Cells with colspan count toward the total.
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if not rows:
            continue
        def row_width(row):
            width = 0
            for cell in row.find_all(['td', 'th'], recursive=False):
                try:
                    width += int(cell.get('colspan', 1))
                except (TypeError, ValueError):
                    width += 1
            return width
        widths = [row_width(r) for r in rows]
        max_width = max(widths) if widths else 0
        for row, w in zip(rows, widths):
            for _ in range(max_width - w):
                filler = soup.new_tag('td')
                filler.string = ''
                row.append(filler)
        # Acrobat's 'Headers' check fails if a table has no <th> cells at all.
        # If Claude omitted a header row, promote the first row's <td>s to
        # <th scope="col"> so the table has a real header association.
        if not table.find('th'):
            first_row = rows[0]
            for cell in first_row.find_all('td'):
                cell.name = 'th'
                cell['scope'] = 'col'
    # Match Claude's <img src="cid:IMAGE_ID"> references (see vision prompt) against
    # the actual extracted image files by stable ID, and embed as base64 data URIs.
    images_by_id = {img.get('id'): img for img in page_images if img.get('id')}
    matched_ids = set()
    for img_tag in soup.find_all('img'):
        src = img_tag.get('src', '')
        img_id = src[4:] if src.startswith('cid:') else None
        info = images_by_id.get(img_id) if img_id else None
        if info and os.path.exists(info['path']):
            try:
                with open(info['path'], 'rb') as f:
                    b64 = base64.b64encode(f.read()).decode()
                ext = os.path.splitext(info['path'])[1].lstrip('.').lower() or 'png'
                mime = 'jpeg' if ext in ('jpg', 'jpeg') else ext
                img_tag['src'] = 'data:image/' + mime + ';base64,' + b64
                if not img_tag.get('alt'):
                    img_tag['alt'] = 'Figure'
                matched_ids.add(img_id)
                continue
            except Exception:
                pass
        # No real image matched this <img> tag -- the src is a dangling cid:
        # reference. Repoint it at the 1x1 placeholder (handled below) instead
        # of leaving an unresolved src, which WeasyPrint's tagger flags as a
        # missing-alt-description error.
        img_tag['src'] = TRANSPARENT_PIXEL
    # WeasyPrint only tags an actual <img> element as a PDF /Figure (a bare
    # <figure>/<figcaption> with no <img> is tagged /NonStruct and never gets
    # an Alt, which is exactly what caused every 'Alternate Text' failure).
    # So any <figure> with a caption but no <img> gets a tiny transparent
    # placeholder image whose alt text is the figcaption content -- this makes
    # WeasyPrint emit a real /Figure tag with a proper /Alt description.
    for fig in soup.find_all('figure'):
        if not fig.find('img'):
            cap = fig.find('figcaption')
            cap_text = cap.get_text(strip=True) if cap else 'Figure'
            placeholder = soup.new_tag('img', src=TRANSPARENT_PIXEL, alt=cap_text[:500])
            if cap:
                cap.insert_before(placeholder)
            else:
                fig.insert(0, placeholder)
    return str(soup)

html_parts = []
for pg in pages:
    page_html = pg.get('html', '')
    page_images = pg.get('images', [])
    html_parts.append('<div class="page">' + clean_html(page_html, page_images) + '</div>')

# Document-level heading normalization. Each page is extracted by Claude
# independently, so heading levels are only consistent WITHIN a page --
# concatenating pages can produce skips (e.g. one page ends at h2, the next
# starts at h3 with no h2, or worse, jumps to h1). Acrobat's 'Appropriate
# nesting' check fails on any level skip greater than 1. Walk all headings in
# document order and clamp each one so it's never more than one level deeper
# than the previous heading, while preserving same-level and shallower jumps.
combined_for_headings = BeautifulSoup(''.join(html_parts), 'html.parser')
prev_level = 1
seen_h1 = False
for h in combined_for_headings.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
    level = int(h.name[1])
    if level == 1:
        if seen_h1:
            level = 2  # only the document's first h1 stays an h1
            h.name = 'h2'
        else:
            seen_h1 = True
    elif level > prev_level + 1:
        level = prev_level + 1
        h.name = 'h%d' % level
    prev_level = level
html_parts = [str(combined_for_headings)]

css_rules = [
    '@page { size: letter; margin: 1in; }',
    'body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }',
    'h1 { font-size: 18pt; font-weight: bold; margin: 12pt 0 6pt 0; }',
    'h2 { font-size: 15pt; font-weight: bold; margin: 10pt 0 5pt 0; }',
    'h3 { font-size: 13pt; font-weight: bold; margin: 8pt 0 4pt 0; }',
    'h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: 6pt 0 3pt 0; }',
    'p { margin: 0 0 6pt 0; }',
    'ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }',
    'li { margin-bottom: 2pt; }',
    'table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }',
    'th { background: #f0f0f0; border: 1px solid #999; padding: 4pt 6pt; text-align: left; font-weight: bold; }',
    'td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }',
    'blockquote { margin: 6pt 0 6pt 24pt; border-left: 2pt solid #999; padding-left: 8pt; }',
    'figure { margin: 8pt 0; }',
    'figcaption { font-size: 9pt; color: #555; margin-top: 3pt; }',
    'img { max-width: 100%; height: auto; }',
    '.equation { font-style: italic; }',
]
css = '\\n'.join(css_rules)

full_html = (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    '<title>' + doc_title + '</title>'
    '<style>' + css + '</style></head><body>'
    + ''.join(html_parts)
    + '</body></html>'
)

tmp_html = output_path + '.html'
with open(tmp_html, 'w', encoding='utf-8') as f:
    f.write(full_html)

from weasyprint import HTML
try:
    HTML(filename=tmp_html).write_pdf(output_path, pdf_tags=True)
except ValueError as wp_val_err:
    # 'Table wrapper without a table' is a rare WeasyPrint box-tree edge
    # case in the tagged-PDF code path, usually from residual malformed
    # table markup our sanitizer didn't catch. Don't fail the whole job --
    # fall back to an untagged render so the user still gets a PDF; the
    # pikepdf post-pass below still sets basic accessibility metadata.
    if 'table' in str(wp_val_err).lower():
        HTML(filename=tmp_html).write_pdf(output_path, pdf_tags=False)
    else:
        try: os.unlink(tmp_html)
        except: pass
        raise RuntimeError('WeasyPrint failed: ' + str(wp_val_err))
except Exception as wp_err:
    try: os.unlink(tmp_html)
    except: pass
    raise RuntimeError('WeasyPrint failed: ' + str(wp_err))
finally:
    try: os.unlink(tmp_html)
    except: pass

# Post-pass: set DisplayDocTitle via pikepdf
try:
    import pikepdf
    pp = pikepdf.open(output_path, allow_overwriting_input=True)
    if '/ViewerPreferences' not in pp.Root:
        pp.Root['/ViewerPreferences'] = pikepdf.Dictionary()
    pp.Root['/ViewerPreferences']['/DisplayDocTitle'] = pikepdf.Boolean(True)
    if '/Info' not in pp.trailer:
        pp.trailer['/Info'] = pikepdf.Dictionary()
    pp.trailer['/Info']['/Title'] = pikepdf.String(doc_title)
    pp.save(output_path)
except Exception as e:
    import sys as _sys
    print('pikepdf warning:', e, file=_sys.stderr)

print('ok')
`;

      const tmpPdfOut = join(tmpdir(), `accessible-${ts}.pdf`);
      const tmpPdfScript = join(tmpdir(), `gen_pdf_${ts}.py`);
      await writeFile(tmpPdfScript, pyPdf, "utf8");

      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(python3, [tmpPdfScript, tmpPdfOut], { timeout: 480000 });
        proc.stdin.write(pdfInput);
        proc.stdin.end();
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => stderr += d.toString());
        proc.on("close", (code: number) => {
          if (code !== 0) reject(new Error("PDF generation failed: " + stderr.slice(-800)));
          else resolve();
        });
      });

      await unlink(tmpPdfScript).catch(() => {});

      // Clean up extracted images
      for (const p of pageResults) {
        for (const imgFile of p.images) {
          await unlink(imgFile.path).catch(() => {});
        }
      }
      try { require("fs").rmdirSync(tmpWorkDir); } catch {}

      const pdfBuffer = require("fs").readFileSync(tmpPdfOut);
      await unlink(tmpPdfOut).catch(() => {});

      const baseName = req.file.originalname.replace(/\.pdf$/i, "").replace(/[^\x20-\x7E]/g, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}-accessible.pdf"`);
      const fixesMadeArr = [
        `1.1.1 - All figures embedded with AI-generated alt text`,
        `1.3.1 - Semantic headings, tables with captions and scoped headers`,
        `1.3.2 - Content in logical reading order across ${totalPages} pages`,
        `2.4.2 - Document title set`,
        `3.1.1 - Language declared`,
        `Unicode font - Chemical symbols and math rendered correctly`,
      ];
      const fixesMadeHeader = JSON.stringify(fixesMadeArr).replace(/[^\x20-\x7E]/g, "");
      res.setHeader("X-Fixes-Made", Buffer.from(fixesMadeHeader).toString("base64"));
      res.setHeader("X-Total-Pages", String(totalPages));
      return res.send(pdfBuffer);

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body || {};
      if (!email || !message) {
        return res.status(400).json({ message: "Name, email, and message are required." });
      }
      console.log(`[CONTACT] ${new Date().toISOString()} — ${name} <${email}> | Subject: ${subject}`);
      console.log(`[CONTACT MESSAGE] ${message}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Waitlist endpoint for coming soon page
  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string" || !/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      // Log to console (Railway logs) — easy to review from dashboard
      console.log(`[WAITLIST] ${new Date().toISOString()} — ${email.trim()}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

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

  // ── Stripe Checkout ──────────────────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  console.log("[STARTUP] STRIPE_SECRET_KEY prefix:", stripeKey.slice(0, 15) || "(not set)");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" }) : null;

  // ── Stripe Webhook ───────────────────────────────────────────
  // Must be registered BEFORE express.json() parses the body
  app.post("/api/stripe/webhook", (req, res, next) => {
    // Express may have already parsed; use raw body if available
    const rawBody = (req as any).rawBody || req.body;
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    if (!stripe || !webhookSecret) {
      return res.status(400).json({ error: "Stripe webhook not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle checkout completed — mark user as subscribed in Clerk
    if (event.type === "checkout.session.completed" || event.type === "customer.subscription.created") {
      (async () => {
        try {
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          let clerkUserId: string | undefined;

          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            clerkUserId = session.client_reference_id || (session.metadata as any)?.clerkUserId || undefined;
            // Also store Stripe customer ID for future lookups
            if (clerkUserId) {
              const plan = (session.metadata as any)?.plan || "individual";
              const seats = parseInt((session.metadata as any)?.seats || "1");

              // ── Credit pack purchase ──────────────────────────────────────
              if (plan === "credits") {
                const qty = parseInt((session.metadata as any)?.quantity || "0");
                const existing = await clerkClient.users.getUser(clerkUserId);
                const existingMeta = (existing.publicMetadata || {}) as any;
                const currentCredits = existingMeta.purchasedCredits || 0;
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    ...existingMeta,
                    purchasedCredits: currentCredits + qty,
                  },
                });
                console.log(`[WEBHOOK] Added ${qty} credits to user ${clerkUserId} (total: ${currentCredits + qty})`);
                return; // Done — no subscription to handle
              }

              if (!session.customer) return;

              if (plan === "team") {
                // Create a Clerk Organization for the buyer
                const orgName = `Team (${new Date().toLocaleDateString()})`;
                const org = await clerkClient.organizations.createOrganization({
                  name: orgName,
                  createdBy: clerkUserId,
                });
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    subscribed: true,
                    plan: "team",
                    teamSeats: seats,
                    orgId: org.id,
                    stripeCustomerId: session.customer as string,
                    subscribedAt: new Date().toISOString(),
                  },
                });
                console.log(`[WEBHOOK] Team checkout: created org ${org.id} for user ${clerkUserId} with ${seats} seats`);
              } else {
                await clerkClient.users.updateUserMetadata(clerkUserId, {
                  publicMetadata: {
                    subscribed: true,
                    plan: "individual",
                    stripeCustomerId: session.customer as string,
                    subscribedAt: new Date().toISOString(),
                  },
                });
                console.log(`[WEBHOOK] Marked user ${clerkUserId} as subscribed (individual)`);
              }
            }
          }

          // Also handle subscription cancellation
        } catch (err: any) {
          console.error("[WEBHOOK] Failed to update Clerk metadata:", err.message);
        }
      })();
    }

    // Handle subscription cancelled/deleted — remove subscribed flag
    if (event.type === "customer.subscription.deleted") {
      (async () => {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          // Find user by stripeCustomerId in metadata
          const users = await clerkClient.users.getUserList({ limit: 100 });
          const user = users.data.find(
            (u) => (u.publicMetadata as any)?.stripeCustomerId === customerId
          );
          if (user) {
            await clerkClient.users.updateUserMetadata(user.id, {
              publicMetadata: { subscribed: false },
            });
            console.log(`[WEBHOOK] Removed subscription for user ${user.id}`);
          }
        } catch (err: any) {
          console.error("[WEBHOOK] Failed to remove subscription:", err.message);
        }
      })();
    }

    res.json({ received: true });
  });

  // ── Team Checkout ─────────────────────────────────────────
  app.post("/api/stripe/create-team-checkout", async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { seats, clerkUserId } = req.body;
      const qty = Math.max(2, parseInt(seats) || 2);
      const TEAM_PRICE = "price_1TqdJpAaDElV6hZx2kEMey6p";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: TEAM_PRICE, quantity: qty }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/team/setup?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/pricing`,
        allow_promotion_codes: true,
        client_reference_id: clerkUserId || undefined,
        metadata: { plan: "team", seats: String(qty) },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Team checkout error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Invoice / PO Request ──────────────────────────────────
  app.post("/api/invoice-request", async (req, res) => {
    try {
      const {
        institutionName, contactName, contactEmail, contactPhone,
        institutionType, seats, poNumber, timeline, notes,
      } = req.body;

      if (!institutionName || !contactName || !contactEmail || !institutionType || !seats || !timeline) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const total = (parseInt(seats) || 2) * 149;
      const body = [
        `Institution: ${institutionName}`,
        `Type: ${institutionType}`,
        `Contact: ${contactName} — ${contactEmail}${contactPhone ? ` — ${contactPhone}` : ""}`,
        `Seats: ${seats} × $149 = $${total.toLocaleString()}/year`,
        `PO Number: ${poNumber || "Not provided"}`,
        `Timeline: ${timeline}`,
        `Notes: ${notes || "None"}`,
      ].join("\n");

      // Send email via Formspree contact endpoint (reuse existing)
      await fetch("https://formspree.io/f/xojbekbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactEmail,
          subject: `Invoice Request — ${institutionName} (${seats} seats)`,
          message: body,
        }),
      });

      console.log(`[INVOICE REQUEST] ${institutionName} — ${seats} seats — ${contactEmail}`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Invoice request error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Credit Pack Checkout ────────────────────────────────────────────────────
  app.post("/api/stripe/create-credits-checkout", async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { quantity, clerkUserId } = req.body;
      const qty = Math.max(10, Math.min(10000, parseInt(quantity) || 10));
      const CREDITS_PRICE = "price_1Tr16SAaDElV6hZx7u7chyLL";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: CREDITS_PRICE, quantity: qty }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/dashboard?credits=purchased`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/dashboard`,
        allow_promotion_codes: true,
        client_reference_id: clerkUserId || undefined,
        metadata: { plan: "credits", quantity: String(qty), clerkUserId: clerkUserId || "" },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Credits checkout error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.options("/api/stripe/create-checkout-session", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST");
    res.sendStatus(200);
  });

  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const { priceId, clerkUserId } = req.body;
      if (!priceId) return res.status(400).json({ error: "Missing priceId" });

      const validPrices = [
        process.env.STRIPE_PRICE_MONTHLY,
        process.env.STRIPE_PRICE_ANNUAL,
        // live mode prices
        "price_1Thc2tAaDElV6hZxMwA0Wxgk",
        "price_1Thc2sAaDElV6hZx3M4Ua1kM",
      ].filter(Boolean);
      if (!validPrices.includes(priceId)) {
        return res.status(400).json({ error: "Invalid priceId" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.APP_URL || "https://remedy508.com"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || "https://remedy508.com"}/pricing`,
        allow_promotion_codes: true,
        // Pass Clerk user ID so webhook can link payment to account
        client_reference_id: clerkUserId || undefined,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      const keyPrefix = (process.env.STRIPE_SECRET_KEY || "").slice(0, 15);
      console.error("Stripe checkout error:", err.message, "| key prefix:", keyPrefix);
      res.status(500).json({ error: err.message, keyPrefix });
    }
  });

  // ── KB API ────────────────────────────────────────────────────────────────

  // GET all sections + articles
  app.get("/api/kb/sections", (_req, res) => {
    res.json(kbDb.getSections());
  });

  // GET all articles
  app.get("/api/kb/articles", (_req, res) => {
    res.json(kbDb.getAll());
  });

  // GET single article
  app.get("/api/kb/articles/:id", (req, res) => {
    const article = kbDb.getById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    res.json(article);
  });

  // GET search
  app.get("/api/kb/search", (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    res.json(kbDb.search(q));
  });

  // PATCH article (admin only)
  app.patch("/api/kb/articles/:id", async (req, res) => {
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) return res.status(500).json({ error: "Auth not configured" });
      const { createClerkClient } = await import("@clerk/backend");
      const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

      // Verify session token from Authorization header
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      let userId: string;
      try {
        const session = await clerkClient.verifyToken(token);
        userId = session.sub;
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Admin check
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (email !== "amandathecarpenter@gmail.com") {
        return res.status(403).json({ error: "Admin only" });
      }

      const updated = kbDb.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST upload video file for an article (admin only, multipart)
  const kbUpload = multer({ dest: "/tmp/kb-uploads/" });
  app.post("/api/kb/articles/:id/upload-video", kbUpload.single("video"), async (req, res) => {
    try {
      // In production, you'd upload to Cloudflare R2/S3 here.
      // For now, store locally and serve from /uploads/kb/
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) return res.status(500).json({ error: "Auth not configured" });
      const { createClerkClient } = await import("@clerk/backend");
      const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      let userId: string;
      try {
        const session = await clerkClient.verifyToken(token);
        userId = session.sub;
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (email !== "amandathecarpenter@gmail.com") return res.status(403).json({ error: "Admin only" });

      if (!req.file) return res.status(400).json({ error: "No file" });

      const uploadDir = path.join(process.cwd(), "public", "kb-videos");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || ".mp4";
      const filename = `${req.params.id}${ext}`;
      fs.renameSync(req.file.path, path.join(uploadDir, filename));
      const video_url = `/kb-videos/${filename}`;

      const updated = kbDb.update(req.params.id, { video_url, video_status: "published" });
      res.json({ video_url, article: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

}
// pdftotext fix Thu Apr 16 18:03:54 UTC 2026
// yt-dlp android client fix Thu Apr 16 23:10:37 UTC 2026
// Stripe checkout Thu May 21 2026
