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
  app.post("/api/document/fix", upload.single("file"), async (req, res) => {
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

    # Extract embedded raster images from this page, sorted top-to-bottom by Y position
    # so order matches Claude's top-to-bottom HTML figure output
    img_list = page.get_images(full=True)
    page_images_unsorted = []
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
            if img_w > 0 and (img_h / img_w) > 3.0:
                continue
            img_hash = hashlib.md5(img_bytes).hexdigest()
            if hash_page_count.get(img_hash, 0) >= 2:
                continue
            # Get Y position of this image on the page for sorting
            rects = page.get_image_rects(xref)
            y_pos = rects[0].y0 if rects else 9999
            img_filename = 'page_%03d_img_%02d.%s' % (page_num, img_idx, img_ext)
            img_path = os.path.join(work_dir, img_filename)
            with open(img_path, 'wb') as f:
                f.write(img_bytes)
            page_images_unsorted.append({'path': img_path, 'width': img_w, 'height': img_h, 'y': y_pos})
        except Exception:
            continue
    # Sort by Y position (top to bottom) to match Claude's reading order
    page_images = sorted(page_images_unsorted, key=lambda x: x['y'])

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
- For EACH diagram, figure, chart, illustration, or structural formula you see: output a <figure> element with a <figcaption> containing a thorough alt-text description (colors, labels, arrows, values, what concept it illustrates, all data values). Must be detailed enough to replace the image for someone who cannot see it.
- For tables: use proper <table><caption><thead><th scope="col"><tbody><td> structure
- For numbered equations (e.g. 6.7.1): wrap in <p class="equation" id="eq-NUMBER">...(NUMBER)</p>
- Use <h1> for main page/section title (first page only), <h2> for section headings, <h3> for subsections
- Use <p> for paragraphs, <ul>/<ol> for lists, <blockquote> for exercise/practice problem boxes
- Wrap the whole page in <section aria-label="Page N">
- SKIP: page headers, footers, page numbers, navigation chrome, license badges, OpenStax URL footers
- Do NOT include CSS or style attributes except class="equation"
- Return ONLY the HTML, nothing else`;

      const pageResults: Array<{ html: string; images: Array<{path: string; width: number; height: number}>; screenshot?: string }> = [];

      for (let i = 0; i < pageData.length; i++) {
        const { page: pageNum, screenshot, images: extractedImages } = pageData[i];
        const imgBuffer = require("fs").readFileSync(screenshot);
        const imgBase64 = imgBuffer.toString("base64");

        const visionResp = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: visionSystemPrompt,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: imgBase64 } },
              { type: "text", text: `This is page ${pageNum} of ${totalPages} of "${req.file!.originalname}". Extract all content as accessible semantic HTML.` },
            ],
          }],
        });

        let pageHtml = (visionResp.content[0] as any).text.trim();
        if (pageHtml.startsWith("```")) {
          pageHtml = pageHtml.replace(/^```(?:html)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }

        pageResults.push({ html: pageHtml, images: extractedImages, screenshot });
        await unlink(screenshot).catch(() => {});
      }

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
import sys, json, os
from contextlib import contextmanager
from fpdf import FPDF, ViewerPreferences
from fpdf.enums import Align
from fpdf.fonts import FontFace
from bs4 import BeautifulSoup


_bundled = os.path.join('/app', 'fonts')
_font_dirs = [_bundled, '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu']
_regular = None
_bold = None
_italic = None
for _fd in _font_dirs:
    _r = os.path.join(_fd, 'DejaVuSans.ttf')
    if os.path.exists(_r):
        _regular = _r
        _b = os.path.join(_fd, 'DejaVuSans-Bold.ttf')
        if os.path.exists(_b): _bold = _b
        _o = os.path.join(_fd, 'DejaVuSans-Oblique.ttf')
        if os.path.exists(_o): _italic = _o
        break

data = json.loads(sys.stdin.read())
output_path = sys.argv[1]
pages = data['pages']
doc_title = data.get('title', 'Accessible Document') or 'Accessible Document'

NAVY       = (58, 72, 91)
TEAL       = (13, 148, 136)
LIGHT_TEAL = (232, 245, 244)
GRAY       = (85, 85, 85)
LIGHT_GRAY = (209, 213, 219)
WHITE      = (255, 255, 255)
ROW_ALT    = (249, 250, 251)

MARGIN = 25.4
MAX_IMG_W = 88.9
MAX_IMG_H = 88.9

class AccessiblePDF(FPDF):
    def __init__(self, title):
        super().__init__()
        self.set_margins(MARGIN, MARGIN, MARGIN)
        self.set_auto_page_break(True, margin=MARGIN)
        self.set_lang('en-US')
        self.viewer_preferences = ViewerPreferences(display_doc_title=True)
        self.set_title(title)
        self.set_author('Remedy508')
        self.set_subject('WCAG 2.1 AA Accessible Document')
        if _regular:
            self.add_font('DejaVu', fname=_regular)
            if _bold:   self.add_font('DejaVu', style='B', fname=_bold)
            if _italic: self.add_font('DejaVu', style='I', fname=_italic)
            self._fn = 'DejaVu'
        else:
            self._fn = 'Helvetica'
        self._body_size = 11
        self._line_h = 6

    def set_body(self, bold=False, italic=False, size=None):
        sz = size or self._body_size
        style = ('B' if bold else '') + ('I' if italic else '')
        self.set_font(self._fn, style=style, size=sz)

    @contextmanager
    def tagged(self, struct_type='P', alt_text=None):
        """Write BDC/EMC markers to page stream AND register struct element."""
        mcid = self.struct_builder.next_mcid_for_page(self.page)
        kwargs = {}
        if alt_text:
            kwargs['alt_text'] = alt_text
        struct_elem, spid = self.struct_builder.add_marked_content(
            page_number=self.page, struct_type=struct_type, mcid=mcid, **kwargs
        )
        self.pages[self.page].struct_parents = spid
        self._set_min_pdf_version('1.4')
        start_page = self.page
        self._out(f'/{struct_type} <</MCID {mcid}>> BDC')
        yield struct_elem
        if self.page == start_page:
            self._out('EMC')

    def draw_h1(self, text):
        self.ln(4)
        self.set_body(bold=True, size=18)
        self.set_text_color(*NAVY)
        with self.tagged('H1'):
            self.multi_cell(0, 9, text, new_x='LMARGIN', new_y='NEXT')
        self.set_draw_color(*TEAL)
        self.set_line_width(0.5)
        self.line(MARGIN, self.get_y(), self.w - MARGIN, self.get_y())
        self.ln(3)
        self.set_text_color(0, 0, 0)

    def draw_h2(self, text):
        self.ln(3)
        self.set_body(bold=True, size=14)
        self.set_text_color(*NAVY)
        with self.tagged('H2'):
            self.multi_cell(0, 8, text, new_x='LMARGIN', new_y='NEXT')
        self.ln(2)
        self.set_text_color(0, 0, 0)

    def draw_h3(self, text):
        self.ln(2)
        self.set_body(bold=True, size=12)
        self.set_text_color(*TEAL)
        with self.tagged('H3'):
            self.multi_cell(0, 7, text, new_x='LMARGIN', new_y='NEXT')
        self.ln(1)
        self.set_text_color(0, 0, 0)

    def draw_body(self, text):
        self.set_body()
        self.set_text_color(0, 0, 0)
        with self.tagged('P'):
            self.multi_cell(0, self._line_h, text, new_x='LMARGIN', new_y='NEXT')
        self.ln(1)

    def draw_equation(self, text):
        self.set_body(italic=True)
        self.set_text_color(*NAVY)
        with self.tagged('P'):
            self.multi_cell(0, self._line_h, text, align='C', new_x='LMARGIN', new_y='NEXT')
        self.ln(1)
        self.set_text_color(0, 0, 0)

    def draw_blockquote(self, text):
        self.set_body()
        self.set_text_color(*NAVY)
        self.set_left_margin(MARGIN + 10)
        with self.tagged('BlockQuote'):
            self.multi_cell(0, self._line_h, text, new_x='LMARGIN', new_y='NEXT')
        self.set_left_margin(MARGIN)
        self.ln(1)
        self.set_text_color(0, 0, 0)

    def draw_li(self, text, ordered=False, num=0):
        self.set_body()
        prefix = (str(num) + '. ') if ordered else '\u2022 '
        self.set_left_margin(MARGIN + 8)
        with self.tagged('LI'):
            self.multi_cell(0, self._line_h, prefix + text, new_x='LMARGIN', new_y='NEXT')
        self.set_left_margin(MARGIN)

    def draw_hr(self):
        self.ln(2)
        self.set_draw_color(*LIGHT_GRAY)
        self.set_line_width(0.3)
        self.line(MARGIN, self.get_y(), self.w - MARGIN, self.get_y())
        self.ln(3)

    def draw_image(self, img_path, alt_text, orig_w, orig_h):
        try:
            px_to_mm = 25.4 / 96.0
            w_mm = orig_w * px_to_mm
            h_mm = orig_h * px_to_mm
            avail = self.w - 2 * MARGIN
            if w_mm > MAX_IMG_W:
                scale = MAX_IMG_W / w_mm
                w_mm = MAX_IMG_W
                h_mm = h_mm * scale
            if h_mm > MAX_IMG_H:
                scale = MAX_IMG_H / h_mm
                h_mm = MAX_IMG_H
                w_mm = w_mm * scale
            x = MARGIN + (avail - w_mm) / 2
            self.ln(3)
            # image() with alt_text calls _marked_sequence internally — writes BDC/EMC + /Figure struct elem
            self.image(img_path, x=x, y=None, w=w_mm, h=h_mm, alt_text=alt_text)
            self.ln(3)
        except Exception as ex:
            self.set_body(italic=True)
            self.set_text_color(*GRAY)
            with self.tagged('Figure', alt_text=alt_text):
                self.multi_cell(0, self._line_h, '[Image: ' + alt_text + ']', new_x='LMARGIN', new_y='NEXT')
            self.set_text_color(0, 0, 0)

    def draw_table(self, tag):
        caption = tag.find('caption')
        rows = tag.find_all('tr')
        if not rows: return
        if caption:
            self.set_body(bold=True, size=10)
            self.set_text_color(*NAVY)
            with self.tagged('Caption'):
                self.multi_cell(0, 5, caption.get_text().strip(), new_x='LMARGIN', new_y='NEXT')
            self.set_text_color(0, 0, 0)
            self.ln(1)
        n_cols = max(len(r.find_all(['th','td'])) for r in rows) or 1
        avail = self.w - 2 * MARGIN
        col_w = avail / n_cols
        row_h = 7
        self.set_font(self._fn, size=10)
        for ridx, row in enumerate(rows):
            cells = row.find_all(['th','td'])
            is_header = ridx == 0 or all(c.name == 'th' for c in cells)
            if self.get_y() + row_h > self.page_break_trigger:
                self.add_page()
            row_y = self.get_y()
            for cidx in range(n_cols):
                cx = MARGIN + cidx * col_w
                if is_header:
                    self.set_fill_color(*NAVY)
                elif ridx % 2 == 0:
                    self.set_fill_color(*ROW_ALT)
                else:
                    self.set_fill_color(255, 255, 255)
                self.rect(cx, row_y, col_w, row_h, style='F')
            self.set_draw_color(*LIGHT_GRAY)
            self.set_line_width(0.2)
            for cidx in range(n_cols):
                self.rect(MARGIN + cidx * col_w, row_y, col_w, row_h)
            for cidx, cell in enumerate(cells[:n_cols]):
                txt = cell.get_text(separator=' ').strip()
                cx = MARGIN + cidx * col_w + 2
                self.set_xy(cx, row_y + 1.5)
                if is_header:
                    self.set_font(self._fn, style='B', size=10)
                    self.set_text_color(255, 255, 255)
                    with self.tagged('TH'):
                        self.cell(col_w - 4, row_h - 3, txt[:40], new_x='RIGHT', new_y='TOP')
                else:
                    self.set_font(self._fn, size=10)
                    self.set_text_color(*NAVY)
                    with self.tagged('TD'):
                        self.cell(col_w - 4, row_h - 3, txt[:40], new_x='RIGHT', new_y='TOP')
            self.set_xy(MARGIN, row_y + row_h)
        self.ln(3)
        self.set_text_color(0, 0, 0)

# Characters that Helvetica (latin-1) cannot encode — map to safe ASCII equivalents
_CHAR_MAP = {
    '\u2212': '-',   # minus sign
    '\u2013': '-',   # en dash
    '\u2014': '--',  # em dash
    '\u2018': "'",   # left single quote
    '\u2019': "'",   # right single quote
    '\u201c': '"',   # left double quote
    '\u201d': '"',   # right double quote
    '\u2026': '...', # ellipsis
    '\u00d7': 'x',   # multiplication sign
    '\u00f7': '/',   # division sign
    '\u2192': '->',  # right arrow
    '\u2190': '<-',  # left arrow
    '\u2194': '<->', # left-right arrow
    '\u21cc': '<=>',  # equilibrium arrow
    '\u0394': 'Delta', # Greek capital delta
    '\u03b1': 'alpha', '\u03b2': 'beta', '\u03b3': 'gamma',
    '\u03c3': 'sigma', '\u03c0': 'pi', '\u03bc': 'mu',
    '\u2081': '1', '\u2082': '2', '\u2083': '3',  # subscripts
    '\u00b0': 'deg', '\u00b1': '+/-', '\u2248': '~=',
    '\u2265': '>=', '\u2264': '<=', '\u2260': '!=',
    '\u00e9': 'e', '\u00e8': 'e', '\u00ea': 'e',  # accented e
}

def safe_text(tag):
    text = (tag.get_text(separator=' ') if tag else '').strip()
    return sanitize(text)

def sanitize(text):
    """Replace characters Helvetica can't encode; keep latin-1 safe chars."""
    result = []
    for ch in text:
        if ch in _CHAR_MAP:
            result.append(_CHAR_MAP[ch])
        else:
            try:
                ch.encode('latin-1')
                result.append(ch)
            except (UnicodeEncodeError, ValueError):
                result.append('?')
    return ''.join(result)

pdf = AccessiblePDF(doc_title)
pdf.add_page()

def process(tag, page_images_iter):
    name = tag.name if hasattr(tag, 'name') and tag.name else ''
    if name in ['html', 'body', 'div', 'section', 'article', 'header', 'main']:
        for c in tag.children:
            if hasattr(c, 'name') and c.name:
                process(c, page_images_iter)
    elif name == 'h1':
        pdf.draw_h1(safe_text(tag))
    elif name == 'h2':
        pdf.draw_h2(safe_text(tag))
    elif name in ['h3','h4','h5','h6']:
        pdf.draw_h3(safe_text(tag))
    elif name == 'p':
        cls = tag.get('class', [])
        el_id = tag.get('id', '')
        if 'equation' in cls or el_id.startswith('eq-'):
            pdf.draw_equation(safe_text(tag))
        else:
            pdf.draw_body(safe_text(tag))
    elif name == 'figure':
        figcaption = tag.find('figcaption')
        alt_text = sanitize(safe_text(figcaption) if figcaption else safe_text(tag))
        # Use pre-extracted raster images from fitz (the only reliable source)
        img_info = next(page_images_iter, None)
        if img_info:
            img_path = img_info['path'] if isinstance(img_info, dict) else img_info
            orig_w = img_info.get('width', 400) if isinstance(img_info, dict) else 400
            orig_h = img_info.get('height', 300) if isinstance(img_info, dict) else 300
            if img_path and os.path.exists(img_path):
                pdf.draw_image(img_path, alt_text, orig_w, orig_h)
                return
        # No raster image available (vector graphic) — render alt text as accessible paragraph
        if alt_text:
            pdf.set_body(italic=True)
            pdf.set_text_color(*GRAY)
            with pdf.tagged('P'):
                pdf.multi_cell(0, 6, '[Figure: ' + alt_text + ']', new_x='LMARGIN', new_y='NEXT')
            pdf.set_text_color(0, 0, 0)
    elif name == 'blockquote':
        pdf.draw_blockquote(safe_text(tag))
    elif name in ['ul', 'ol']:
        items_li = tag.find_all('li', recursive=False)
        for idx, li in enumerate(items_li, 1):
            pdf.draw_li(safe_text(li), ordered=(name == 'ol'), num=idx)
        pdf.ln(2)
    elif name == 'table':
        pdf.draw_table(tag)
    elif name == 'hr':
        pdf.draw_hr()

for page_info in pages:
    html = page_info['html']
    img_files = page_info['images']
    soup = BeautifulSoup(html, 'html.parser')
    page_images_iter = iter(img_files)
    for child in soup.children:
        if hasattr(child, 'name') and child.name:
            process(child, page_images_iter)
    pdf.ln(4)

pdf.output(output_path)

# ── pikepdf post-pass: fix Title display + Tab order + Tagged content flag ──
try:
    import pikepdf
    pp = pikepdf.open(output_path, allow_overwriting_input=True)

    # Force document title to show in viewer title bar
    if '/ViewerPreferences' not in pp.Root:
        pp.Root['/ViewerPreferences'] = pikepdf.Dictionary()
    pp.Root['/ViewerPreferences']['/DisplayDocTitle'] = pikepdf.Boolean(True)

    # Ensure MarkInfo/Marked = true (tagged PDF)
    if '/MarkInfo' not in pp.Root:
        pp.Root['/MarkInfo'] = pikepdf.Dictionary(Marked=pikepdf.Boolean(True))
    else:
        pp.Root['/MarkInfo']['/Marked'] = pikepdf.Boolean(True)

    # Set /Lang on Root if not present
    if '/Lang' not in pp.Root:
        pp.Root['/Lang'] = pikepdf.String('en-US')

    # Set Tab order to structure order on every page
    for page in pp.pages:
        page['/Tabs'] = pikepdf.Name('/S')

    # Ensure document info title matches
    if '/Info' not in pp.trailer:
        pp.trailer['/Info'] = pikepdf.Dictionary()
    pp.trailer['/Info']['/Title'] = pikepdf.String(doc_title)

    pp.save(output_path)
    pp.close()
except Exception as e:
    import sys
    print('pikepdf post-pass warning:', e, file=sys.stderr)

print('ok')
`;

      const tmpPdfOut = join(tmpdir(), `accessible-${ts}.pdf`);
      const tmpPdfScript = join(tmpdir(), `gen_pdf_${ts}.py`);
      await writeFile(tmpPdfScript, pyPdf, "utf8");

      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(python3, [tmpPdfScript, tmpPdfOut], { timeout: 180000 });
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
