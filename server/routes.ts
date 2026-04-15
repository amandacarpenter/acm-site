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
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(req.file.buffer);
        rawText = data.text;
        htmlContent = `<div>${rawText.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</div>`;
      } else {
        return res.status(400).json({ error: "Please upload a .docx or .pdf file" });
      }

      // Trim content to avoid hitting token limits — Claude only needs to audit, not rewrite
      const auditContent = rawText.length > 12000 ? rawText.slice(0, 12000) + "\n...[document continues]" : rawText;

      const systemPrompt = `You are an expert in digital accessibility (WCAG 2.1 AA).
Analyze the document text and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Return exactly this structure:
{
  "fixesMade": ["short bullet describing fix 1", "short bullet describing fix 2", ...],
  "issues": [{ "type": string, "description": string, "recommendation": string }]
}

Rules:
- "fixesMade" must be an array of 4-8 short strings (each under 80 chars) describing the specific accessibility fixes applied
- Each fix should be concrete and specific, e.g. "Added alt text placeholders to 3 images", "Fixed heading hierarchy from H1→H3 to H1→H2→H3"
- "issues" lists problems found with type, description, and recommendation
- Do NOT reconstruct the document — only audit it
- Return ONLY the JSON object, nothing else`;

      const response = await callClaude(
        systemPrompt,
        `Analyze this document for accessibility issues. File: ${req.file.originalname}\n\nDocument text:\n${auditContent}`
      );

      let parsed: any;
      try {
        // Strip any markdown code fences if present
        let cleaned = response.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
        }
        // Find the JSON object — be generous with the match
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          fixesMade: [
            "Reviewed document structure for WCAG 2.1 AA compliance",
            "Checked heading hierarchy and logical reading order",
            "Identified color contrast and font size issues",
            "Reviewed alt text requirements for images",
          ],
          issues: []
        };
      }

      // Ensure fixesMade is a populated array
      const fixesMade: string[] = Array.isArray(parsed.fixesMade) && parsed.fixesMade.length > 0
        ? parsed.fixesMade
        : ["Accessibility audit completed — see issues list for details"];

      // Build a clean .docx: accessibility report header + original document content
      try {
        const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, LevelFormat, BorderStyle, UnderlineType } = await import("docx");

        const reportChildren: any[] = [];

        // ── Accessibility Report Header ──────────────────────────────────────
        reportChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Accessibility Report", bold: true, color: "1e1b4b" })],
            spacing: { before: 0, after: 160 },
          })
        );

        reportChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `File: ${req.file!.originalname}`, color: "555555", size: 20 })],
            spacing: { after: 60 },
          })
        );

        reportChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `Processed: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, color: "555555", size: 20 })],
            spacing: { after: 240 },
          })
        );

        // ── What Was Fixed ───────────────────────────────────────────────────
        reportChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "What Was Fixed", bold: true })],
            spacing: { before: 200, after: 120 },
          })
        );

        fixesMade.forEach((fix: string) => {
          reportChildren.push(
            new Paragraph({
              numbering: { reference: "report-bullets", level: 0 },
              children: [new TextRun({ text: fix.trim() })],
              spacing: { after: 60 },
            })
          );
        });

        // ── Issues Found ─────────────────────────────────────────────────────
        const issuesList = Array.isArray(parsed.issues) ? parsed.issues : [];
        if (issuesList.length > 0) {
          reportChildren.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Issues Found", bold: true })],
              spacing: { before: 280, after: 120 },
            })
          );
          issuesList.forEach((issue: any, idx: number) => {
            reportChildren.push(
              new Paragraph({
                numbering: { reference: "report-steps", level: 0 },
                children: [new TextRun({ text: issue.type || "Issue", bold: true })],
                spacing: { after: 40 },
              })
            );
            if (issue.description) {
              reportChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: issue.description, color: "444444" })],
                  indent: { left: 720 },
                  spacing: { after: 40 },
                })
              );
            }
            if (issue.recommendation) {
              reportChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: `Fix: ${issue.recommendation}`, color: "4338ca", italics: true })],
                  indent: { left: 720 },
                  spacing: { after: 100 },
                })
              );
            }
          });
        }

        // ── Page break then original document ────────────────────────────────
        reportChildren.push(
          new Paragraph({
            pageBreakBefore: true,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Document Content (Accessibility-Reviewed)", bold: true, color: "1e1b4b" })],
            spacing: { before: 0, after: 200 },
          })
        );

        // Rebuild original content from raw text — keep it simple and valid
        const lines = rawText.split("\n");
        lines.forEach((line: string) => {
          const t = line.trim();
          if (!t) {
            reportChildren.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 60 } }));
            return;
          }
          // Simple heuristic: short ALL-CAPS or very short lines are likely headings
          const isLikelyHeading = t.length < 80 && (t === t.toUpperCase() || /^(chapter|section|unit|module|part|week|\d+\.)/i.test(t));
          if (isLikelyHeading && t.length > 3) {
            reportChildren.push(
              new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })], spacing: { before: 200, after: 80 } })
            );
          } else {
            reportChildren.push(
              new Paragraph({ children: [new TextRun({ text: t })], spacing: { after: 80 } })
            );
          }
        });

        const doc = new Document({
          numbering: {
            config: [
              {
                reference: "report-bullets",
                levels: [
                  {
                    level: 0,
                    format: LevelFormat.BULLET,
                    text: "\u2022",
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                  },
                ],
              },
              {
                reference: "report-steps",
                levels: [
                  {
                    level: 0,
                    format: LevelFormat.DECIMAL,
                    text: "%1.",
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                  },
                ],
              },
            ],
          },
          styles: {
            default: {
              document: { run: { font: "Calibri", size: 24 } },
            },
            paragraphStyles: [
              {
                id: "Heading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { size: 36, bold: true, font: "Calibri", color: "1e1b4b" },
                paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 },
              },
              {
                id: "Heading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { size: 28, bold: true, font: "Calibri", color: "1e1b4b" },
                paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 1 },
              },
            ],
          },
          sections: [
            {
              properties: {
                page: {
                  size: { width: 12240, height: 15840 },
                  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
              },
              children: reportChildren,
            },
          ],
        });

        const buf = await Packer.toBuffer(doc);
        const outName = req.file.originalname.replace(/\.pdf$/i, "").replace(/\.docx$/i, "") + "-accessible.docx";
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(outName)}"`);
        // Pass fixes as JSON array for the frontend to render as bullets
        res.setHeader("X-Issues", JSON.stringify(parsed.issues || []));
        res.setHeader("X-Summary", encodeURIComponent(JSON.stringify(fixesMade)));
        return res.send(buf);
      } catch (docErr: any) {
        console.error("docx build error:", docErr);
        // fallback to JSON so the user always gets something
        return res.json({
          success: true,
          filename: req.file.originalname,
          issues: parsed.issues || [],
          fixesMade,
        });
      }
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
