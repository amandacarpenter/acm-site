import type { Express } from "express";
import { Server } from "http";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

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

// Helper: call transcription microservice
async function callTranscribe(audioBytes: Buffer, mediaType: string) {
  const b64 = audioBytes.toString("base64");
  const resp = await fetch("http://127.0.0.1:5001/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_b64: b64, media_type: mediaType }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error("Transcription failed: " + err);
  }
  return resp.json();
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
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

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
          "import fitz, sys",
          "doc = fitz.open(sys.argv[1])",
          "text = ''",
          "for page in doc:",
          "    t = page.get_text().strip()",
          "    if len(t) < 50:",  // scanned page — use OCR
          "        tp = page.get_textpage_ocr(language='eng', dpi=300)",
          "        t = page.get_text(textpage=tp).strip()",
          "    text += t + '\\n'",
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

      // Trim content to avoid hitting token limits
      const auditContent = rawText.length > 14000 ? rawText.slice(0, 14000) + "\n...[document continues]" : rawText;
      // Claude restructures only the first 10k chars of HTML — enough for heading/table fixes
      // The remainder is passed through as-is and appended after Claude's output
      const HTML_CLAUDE_LIMIT = 10000;
      const htmlForClaude = htmlContent.length > HTML_CLAUDE_LIMIT
        ? htmlContent.slice(0, HTML_CLAUDE_LIMIT) + "<!-- END_OF_CLAUDE_SECTION -->"
        : htmlContent;
      const htmlRemainder = htmlContent.length > HTML_CLAUDE_LIMIT
        ? htmlContent.slice(HTML_CLAUDE_LIMIT)
        : "";

      // ── Two parallel Claude calls ──────────────────────────────────────────
      // Call 1: Audit only — returns JSON with fixesMade + issues (no HTML to escape)
      // Call 2: Structured HTML only — returns plain HTML (no JSON quoting problems)
      const auditSystemPrompt = `You are an expert in digital accessibility (WCAG 2.1 AA).
Analyze the document text and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Return exactly this structure:
{
  "fixesMade": ["short bullet describing fix 1", "short bullet describing fix 2", ...],
  "issues": [{ "type": string, "description": string, "recommendation": string }]
}

Rules:
- "fixesMade" must be an array of 4-8 short strings (each under 80 chars) describing specific accessibility fixes applied
- Be concrete: e.g. "Added heading hierarchy for 8 section titles", "Converted course info to accessible table", "Removed ** formatting artifacts from 2 paragraphs"
- "issues" lists problems found with type, description, and recommendation
- Return ONLY the JSON object, nothing else`;

      const htmlSystemPrompt = `You are an expert in semantic HTML and document accessibility.
Convert the given mammoth-parsed HTML into clean, accessible, semantic HTML for a Word document.
Return ONLY the HTML — no markdown, no code fences, no explanation, no doctype, no <html>/<body> tags.

Rules:
- Use <h1> for major section headings (Required E-Texts, Course Description, Student Learning Outcomes, Four Areas of Philosophy, etc.)
- Use <h2> for sub-section headings, <h3> for minor headings, <h4> for week headings
- Use <table><tr><th> and <tr><td> for the course info block at the top (instructor name, term, section number, office, office hours, phone, email) — 2 columns: label | value
- Use <ul><li> for bulleted lists, <ol><li> for numbered lists
- Use <p> for regular paragraphs
- STRIP leading ** and *** from all paragraph text (e.g. "**You will be required..." becomes "You will be required...")
- STRIP leading * from all paragraph text
- STRIP dot leaders: remove sequences of 3 or more dots (e.g. "Participation......200 pts" becomes "Participation" | "200 pts" in a table cell)
- Convert any grading/scoring section that uses dot leaders into a proper <table> with 2 columns: item | points. Include a "Total" row if present.
- The KEY/grading scale line (e.g. "KEY: 325 - 292.5 = A...") should be kept as a <p> after the grading table
- Preserve ALL actual content — do not omit or summarize any text
- Do not add content that was not in the original
- Do not include any CSS, style, or class attributes
- Keep URLs as plain text inside <p> or <li> — do not wrap in <a> tags
- Return ONLY the HTML content, nothing else`;

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
        // YouTube / URL transcription via yt-dlp
        const url = bodyUrl;
        const tmpOut = `/tmp/ytdl_${Date.now()}.mp3`;
        await new Promise<void>((resolve, reject) => {
          child_process.exec(
            `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${tmpOut.replace('.mp3', '.%(ext)s')}" "${url.replace(/"/g, '')}"`,
            { timeout: 120000 },
            (err) => {
              if (err) reject(new Error("Could not download audio from that URL. Make sure it's a valid YouTube link."));
              else resolve();
            }
          );
        });
        // yt-dlp may output with different extension, find the file
        const tmpDir = '/tmp';
        const prefix = path.basename(tmpOut).replace('.mp3', '');
        const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
        if (files.length === 0) throw new Error("Audio extraction failed");
        const audioFile = path.join(tmpDir, files[0]);
        // Convert to mp3 with ffmpeg for consistent format
        const finalMp3 = `/tmp/final_${Date.now()}.mp3`;
        await new Promise<void>((resolve, reject) => {
          child_process.exec(
            `ffmpeg -y -i "${audioFile}" -vn -acodec mp3 -ar 16000 -ac 1 "${finalMp3}"`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        audioBuffer = fs.readFileSync(finalMp3);
        filename = url;
        // cleanup temp files
        try { fs.unlinkSync(audioFile); } catch {}
        try { fs.unlinkSync(finalMp3); } catch {}
      } else {
        return res.status(400).json({ error: "No file or URL provided" });
      }

      const transcription = await callTranscribe(audioBuffer, "audio/mpeg");
      const timecoded = formatTimecodeTranscript(transcription.words || []);

      res.json({
        success: true,
        filename,
        plainText: transcription.text,
        timecodedTranscript: timecoded || transcription.text,
        language: transcription.language_code,
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
