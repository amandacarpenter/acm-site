import { useState, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Video, Code2, ImageIcon, Upload, CheckCircle2, AlertCircle,
  Copy, Download, Zap, Shield, Eye, ChevronRight, X, Loader2, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

// ── Shared helpers ───────────────────────────────────────────────────────────
function FileDropZone({ accept, onFile, label, sublabel, icon: Icon, testId }: {
  accept: string; onFile: (f: File) => void; label: string; sublabel: string; icon: any; testId: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid={testId}
      className={`upload-zone flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[160px] ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) { setSelected(f); onFile(f); } }}
      onClick={() => inputRef.current?.click()}
      role="button" tabIndex={0} aria-label={label}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelected(f); onFile(f); }}} />
      {selected ? (
        <>
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <div><p className="font-semibold">{selected.name}</p><p className="text-sm text-muted-foreground">{(selected.size / 1024).toFixed(1)} KB — click to change</p></div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-[#4338ca]/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-[#4338ca]" />
          </div>
          <div><p className="font-semibold">{label}</p><p className="text-sm text-muted-foreground">{sublabel}</p></div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Upload className="w-3 h-3" />Drop file here or click to browse</div>
        </>
      )}
    </div>
  );
}

function CopyBtn({ text, testId }: { text: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="sm" data-testid={testId} onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

function DownloadBtn({ content, filename, testId }: { content: string; filename: string; testId?: string }) {
  return (
    <Button variant="outline" size="sm" data-testid={testId} onClick={() => {
      const blob = new Blob([content], { type: "text/plain" }); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }}>
      <Download className="w-3.5 h-3.5 mr-1" />Download
    </Button>
  );
}

function IssueBadge({ type }: { type: string }) {
  const t = type?.toLowerCase();
  if (t?.includes("error") || t?.includes("missing")) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-semibold uppercase">Error</span>;
  if (t?.includes("warn") || t?.includes("contrast")) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase">Warning</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold uppercase">Info</span>;
}

function LoadingState({ text, steps }: { text: string; steps?: string[] }) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const defaultSteps = steps || [text];

  useState(() => {
    // Animate progress from 0 to 90 over ~30s, slowing near the end
    const intervals: ReturnType<typeof setInterval>[] = [];
    let p = 0;
    const tick = setInterval(() => {
      p = p < 60 ? p + 2.5 : p < 80 ? p + 0.8 : p < 90 ? p + 0.2 : p;
      setProgress(Math.min(p, 90));
    }, 800);
    intervals.push(tick);
    // Cycle through steps
    if (defaultSteps.length > 1) {
      let i = 0;
      const stepTick = setInterval(() => {
        i = (i + 1) % defaultSteps.length;
        setStepIndex(i);
      }, 4000);
      intervals.push(stepTick);
    }
    return () => intervals.forEach(clearInterval);
  });

  return (
    <div className="space-y-3 p-4 rounded-xl bg-[#4338ca]/5 border border-[#4338ca]/20">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-[#4338ca] animate-spin shrink-0" />
        <span className="text-sm text-[#4338ca] font-medium">{defaultSteps[stepIndex]}</span>
      </div>
      <div className="relative w-full h-2 bg-[#4338ca]/15 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-[#4338ca] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{message}
    </div>
  );
}

// ── Document Tab ─────────────────────────────────────────────────────────────
function DocumentTab() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const run = async () => {
    if (!file) { toast({ title: "No file", variant: "destructive" }); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const resp = await fetch("/api/document/fix", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      // Build the .docx right here in the browser — no server-side bundling issues
      const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, LevelFormat } = await import("docx");
      const fixesMade: string[] = data.fixesMade || [];
      const issues: any[] = data.issues || [];
      const rawText: string = data.rawText || "";
      const baseName = file.name.replace(/\.pdf$/i, "").replace(/\.docx$/i, "");
      const filename = baseName + "-accessible.docx";

      const children: any[] = [];

      // ── Report header ──────────────────────────────────────────────────────
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Accessibility Report", bold: true, color: "1e1b4b" })],
        spacing: { before: 0, after: 160 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: `File: ${file.name}`, color: "555555", size: 20 })],
        spacing: { after: 60 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: `Processed: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, color: "555555", size: 20 })],
        spacing: { after: 240 },
      }));

      // ── What Was Fixed ─────────────────────────────────────────────────────
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "What Was Fixed", bold: true })],
        spacing: { before: 200, after: 120 },
      }));
      fixesMade.forEach((fix: string) => {
        children.push(new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun({ text: fix.trim() })],
          spacing: { after: 60 },
        }));
      });

      // ── Issues Found ───────────────────────────────────────────────────────
      if (issues.length > 0) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "Issues Found", bold: true })],
          spacing: { before: 280, after: 120 },
        }));
        issues.forEach((issue: any) => {
          children.push(new Paragraph({
            numbering: { reference: "steps", level: 0 },
            children: [new TextRun({ text: issue.type || "Issue", bold: true })],
            spacing: { after: 40 },
          }));
          if (issue.description) children.push(new Paragraph({
            children: [new TextRun({ text: issue.description, color: "444444" })],
            indent: { left: 720 }, spacing: { after: 40 },
          }));
          if (issue.recommendation) children.push(new Paragraph({
            children: [new TextRun({ text: `Fix: ${issue.recommendation}`, color: "4338ca", italics: true })],
            indent: { left: 720 }, spacing: { after: 100 },
          }));
        });
      }

      // ── Original document content ──────────────────────────────────────────
      children.push(new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Document Content (Accessibility-Reviewed)", bold: true, color: "1e1b4b" })],
        spacing: { before: 0, after: 200 },
      }));
      rawText.split("\n").forEach((line: string) => {
        const t = line.trim();
        if (!t) { children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 60 } })); return; }
        const isHeading = t.length < 80 && (t === t.toUpperCase() || /^(chapter|section|unit|module|part|week|\d+\.)/i.test(t));
        if (isHeading && t.length > 3) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })], spacing: { before: 200, after: 80 } }));
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: t })], spacing: { after: 80 } }));
        }
      });

      const doc = new Document({
        numbering: {
          config: [
            { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
          ],
        },
        styles: {
          default: { document: { run: { font: "Calibri", size: 24 } } },
          paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, font: "Calibri", color: "1e1b4b" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Calibri", color: "1e1b4b" }, paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 1 } },
          ],
        },
        sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
      });

      const blob = await Packer.toBlob(doc);
      setResult({ fixesMade, issues, blob, filename });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropZone accept=".docx,.pdf" onFile={setFile} label="Upload Document" sublabel=".docx and .pdf files" icon={FileText} testId="doc-upload" />
      <Button className="w-full bg-[#4338ca] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || !file} data-testid="btn-fix-doc">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><Zap className="w-4 h-4 mr-2" />Fix Accessibility</>}
      </Button>
      {loading && <LoadingState text="Analyzing document…" steps={["Reading your document…", "Identifying accessibility issues…", "Applying WCAG 2.1 fixes…", "Generating accessible version…"]} />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="space-y-4" data-testid="doc-result">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">What was fixed</span></div>
            {result.fixesMade?.length > 0 ? (
              <ul className="space-y-1">
                {result.fixesMade.slice(0, 8).map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />{s.trim()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Accessibility improvements applied.</p>
            )}
          </div>
          {result.blob && (
            <Button className="w-full bg-[#4338ca] text-white hover:brightness-110 font-semibold" onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(result.blob);
              a.download = result.filename;
              a.click();
            }}>
              <Download className="w-4 h-4 mr-2" />Download {result.filename}
            </Button>
          )}
          {result.issues?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" />Issues ({result.issues.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.issues.map((issue: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-card border text-sm space-y-1">
                    <div className="flex items-center gap-2"><IssueBadge type={issue.type} /><span className="font-medium">{issue.type}</span></div>
                    <p className="text-muted-foreground">{issue.description}</p>
                    {issue.recommendation && <p className="text-xs text-[#4338ca] flex items-center gap-1"><ChevronRight className="w-3 h-3" />{issue.recommendation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.accessibleHtml && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Accessible Document</h3>
                <div className="flex gap-2">
                  <CopyBtn text={result.accessibleHtml} testId="copy-doc" />
                  <Button variant="outline" size="sm" onClick={async () => {
                    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = await import("docx");
                    const html = result.accessibleHtml || "";
                    // Use DOMParser to properly parse the HTML structure
                    const parser = new DOMParser();
                    const doc2 = parser.parseFromString(`<body>${html}</body>`, "text/html");
                    const children: any[] = [];
                    const processNode = (node: Element) => {
                      const tag = node.tagName?.toLowerCase();
                      const text = node.textContent?.trim() || "";
                      if (!text && !tag) return;
                      if (tag === "h1") children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
                      else if (tag === "h2") children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
                      else if (tag === "h3") children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
                      else if (tag === "h4" || tag === "h5" || tag === "h6") children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_4 }));
                      else if (tag === "li") children.push(new Paragraph({ text: `• ${text}`, indent: { left: 360 } }));
                      else if (tag === "p") { if (text) children.push(new Paragraph({ children: [new TextRun(text)] })); }
                      else if (tag === "ul" || tag === "ol" || tag === "section" || tag === "div" || tag === "body") {
                        Array.from(node.children).forEach(processNode);
                      } else if (text) {
                        children.push(new Paragraph({ children: [new TextRun(text)] }));
                      }
                    };
                    Array.from(doc2.body.children).forEach(processNode);
                    if (children.length === 0) children.push(new Paragraph({ children: [new TextRun(html.replace(/<[^>]+>/g, ""))] }));
                    const docx = new Document({ sections: [{ children }] });
                    const buf = await Packer.toBlob(docx);
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(buf);
                    a.download = (result.filename || "document").replace(/\.pdf$/i, "").replace(/\.docx$/i, "") + "-accessible.docx";
                    a.click();
                  }}>
                    <Download className="w-3.5 h-3.5 mr-1" />Download .docx
                  </Button>
                </div>
              </div>
              <pre className="result-panel">{result.accessibleHtml}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Video Tab ────────────────────────────────────────────────────────────────
function VideoTab() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"timecoded" | "plain">("timecoded");
  const { toast } = useToast();

  const run = async () => {
    if (mode === "file" && !file) { toast({ title: "No file", variant: "destructive" }); return; }
    if (mode === "url" && !youtubeUrl.trim()) { toast({ title: "No URL", variant: "destructive" }); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      let resp: Response;
      if (mode === "file" && file) {
        const fd = new FormData(); fd.append("file", file);
        resp = await fetch("/api/video/transcribe", { method: "POST", body: fd });
      } else {
        resp = await fetch("/api/video/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: youtubeUrl }),
        });
      }
      const data = await resp.json(); if (!resp.ok) throw new Error(data.error); setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}>
          <Upload className="w-3.5 h-3.5 mr-1" />Upload File
        </Button>
        <Button size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>
          <Video className="w-3.5 h-3.5 mr-1" />YouTube Link
        </Button>
      </div>

      {mode === "file" ? (
        <FileDropZone accept=".mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.m4a" onFile={setFile} label="Upload Video or Audio" sublabel="MP4, MOV, AVI, WebM, MP3, WAV, M4A" icon={Video} testId="video-upload" />
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="yt-url">YouTube URL</label>
          <input
            id="yt-url" type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
            value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
            data-testid="input-yt-url"
          />
          <p className="text-xs text-muted-foreground">Paste any YouTube video link — we'll extract the audio and transcribe it.</p>
        </div>
      )}

      <Button className="w-full bg-[#4338ca] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || (mode === "file" ? !file : !youtubeUrl.trim())} data-testid="btn-transcribe">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transcribing…</> : <><Zap className="w-4 h-4 mr-2" />Generate Timecoded Transcript</>}
      </Button>
      {loading && <LoadingState text="Transcribing…" steps={["Downloading audio…", "Extracting audio track…", "Sending to transcription AI…", "Generating timecoded transcript…"]} />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="space-y-4" data-testid="video-result">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Transcribed: {result.filename}</span>
            {result.language && <Badge variant="secondary">{result.language?.toUpperCase()}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={view === "timecoded" ? "default" : "outline"} onClick={() => setView("timecoded")}>Timecoded</Button>
            <Button size="sm" variant={view === "plain" ? "default" : "outline"} onClick={() => setView("plain")}>Plain Text</Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{view === "timecoded" ? "Timecoded Transcript" : "Plain Text"}</h3>
              <div className="flex gap-2">
                <CopyBtn text={view === "timecoded" ? result.timecodedTranscript : result.plainText} />
                <DownloadBtn content={view === "timecoded" ? result.timecodedTranscript : result.plainText} filename={`${result.filename}-transcript.${view === "timecoded" ? "vtt" : "txt"}`} />
              </div>
            </div>
            <pre className="result-panel">{view === "timecoded" ? result.timecodedTranscript : result.plainText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Canvas Tab ───────────────────────────────────────────────────────────────
function CanvasTab() {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const run = async () => {
    if (!html.trim()) { toast({ title: "No HTML", variant: "destructive" }); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const resp = await fetch("/api/canvas/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html }) });
      const data = await resp.json(); if (!resp.ok) throw new Error(data.error); setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="canvas-input">Paste Canvas Page HTML</label>
        <p className="text-xs text-muted-foreground">Open the page editor in Canvas → click the HTML/Source button (&lt;&gt;) → copy the HTML → paste below.</p>
        <Textarea id="canvas-input" placeholder="<p>Paste your Canvas HTML here...</p>" className="font-mono text-xs min-h-[180px] resize-y" value={html} onChange={(e) => setHtml(e.target.value)} data-testid="canvas-input" />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{html.length} characters</span>
          {html && <Button variant="ghost" size="sm" onClick={() => { setHtml(""); setResult(null); }}><X className="w-3.5 h-3.5 mr-1" />Clear</Button>}
        </div>
      </div>
      <Button className="w-full bg-[#4338ca] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || !html.trim()} data-testid="btn-fix-canvas">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Making it accessible…</> : <><Zap className="w-4 h-4 mr-2" />Fix Canvas Accessibility</>}
      </Button>
      {loading && <LoadingState text="Fixing Canvas HTML…" steps={["Parsing your HTML…", "Checking color contrast…", "Fixing heading structure…", "Adding ARIA labels…", "Finalizing accessible HTML…"]} />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="space-y-4" data-testid="canvas-result">
          {result.score && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
                <div className="score-badge text-red-600 dark:text-red-400">{result.score.before}</div>
                <div className="text-xs text-muted-foreground mt-1">Before</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                <div className="score-badge text-emerald-600 dark:text-emerald-400">{result.score.after}</div>
                <div className="text-xs text-muted-foreground mt-1">After</div>
              </div>
            </div>
          )}
          {result.changes?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Changes ({result.changes.length})</h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {result.changes.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#4338ca] shrink-0" />
                    <div><span className="font-medium">{c.issue}</span>{c.fix && <span className="text-muted-foreground"> → {c.fix}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Paste Back into Canvas</h3><CopyBtn text={result.accessibleHtml} testId="copy-canvas" /></div>
            <pre className="result-panel">{result.accessibleHtml}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Alt Text Tab ─────────────────────────────────────────────────────────────
function AltTextTab() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [context, setContext] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleFile = (f: File) => { setFile(f); setImageUrl(""); setPreviewUrl(URL.createObjectURL(f)); };

  const run = async () => {
    if (!file && !imageUrl.trim()) { toast({ title: "No image", variant: "destructive" }); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      if (imageUrl) fd.append("imageUrl", imageUrl);
      fd.append("context", context);
      const resp = await fetch("/api/alttext/generate", { method: "POST", body: fd });
      const data = await resp.json(); if (!resp.ok) throw new Error(data.error); setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropZone accept="image/*" onFile={handleFile} label="Upload Image" sublabel="PNG, JPG, GIF, WebP — or paste a URL below" icon={ImageIcon} testId="img-upload" />
      {previewUrl && <div className="rounded-xl overflow-hidden border max-h-48"><img src={previewUrl} alt="Preview of uploaded image" className="w-full h-full object-contain bg-muted" /></div>}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="img-url">Or enter image URL</label>
        <input id="img-url" type="url" placeholder="https://example.com/image.png" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setFile(null); setPreviewUrl(null); }} data-testid="input-img-url" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="alt-context">Context <span className="text-muted-foreground font-normal">(optional — describe the page this image is for)</span></label>
        <Textarea id="alt-context" placeholder="e.g. This is a chart showing student enrollment trends…" className="text-sm min-h-[80px] resize-y" value={context} onChange={(e) => setContext(e.target.value)} data-testid="input-context" />
      </div>
      <Button className="w-full bg-[#4338ca] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || (!file && !imageUrl.trim())} data-testid="btn-gen-alt">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><Eye className="w-4 h-4 mr-2" />Generate Alt Text</>}
      </Button>
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="space-y-4" data-testid="alt-result">
          {result.isDecorative ? (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-blue-600" /><span className="font-semibold text-blue-800 dark:text-blue-300 text-sm">Decorative Image</span></div>
              <p className="text-sm text-blue-700 dark:text-blue-400">Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">alt=""</code> so screen readers skip it.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Alt Text</h3><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{result.altText?.length} chars</span><CopyBtn text={result.altText} testId="copy-alt" /></div></div>
                <div className="p-3 rounded-lg bg-muted border font-mono text-sm" data-testid="alt-output">{result.altText}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">HTML Snippet</h3><CopyBtn text={`alt="${result.altText}"`} /></div>
                <pre className="result-panel">{`alt="${result.altText}"`}</pre>
              </div>
              {result.longDescription && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Long Description</h3><CopyBtn text={result.longDescription} /></div>
                  <div className="p-3 rounded-lg bg-muted border text-sm">{result.longDescription}</div>
                </div>
              )}
              {result.reasoning && <div className="p-3 rounded-lg bg-[#4338ca]/5 border border-[#4338ca]/20 text-sm text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{result.reasoning}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── TOOLS PAGE SHELL ─────────────────────────────────────────────────────────
const TAB_META = [
  { id: "document", label: "Documents", icon: FileText, desc: "Fix .docx & .pdf" },
  { id: "video", label: "Video", icon: Video, desc: "Timecoded transcripts" },
  { id: "canvas", label: "Canvas", icon: Code2, desc: "LMS page fixer" },
  { id: "alttext", label: "Alt Text", icon: ImageIcon, desc: "Image descriptions" },
];

export default function ToolsPage() {
  const [, params] = useRoute("/tools/:tab");
  const initialTab = params?.tab || "document";

  return (
    <div className="min-h-screen bg-background" data-testid="tools-page">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/">
            <span className="text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Home</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Accessibility Tools</span>
        </div>

        {/* Page heading */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Accessibility <span className="text-[#4338ca]">Tools</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Upload, paste, or drop — AI handles the accessibility fixes.</p>
        </div>

        {/* Tab interface */}
        <Tabs defaultValue={initialTab} className="space-y-4" data-testid="tool-tabs">
          <TabsList className="grid grid-cols-4 w-full h-auto p-1 gap-1">
            {TAB_META.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex flex-col gap-0.5 py-2 px-1 h-auto text-xs" data-testid={`tab-${tab.id}`}>
                <tab.icon className="w-4 h-4" aria-hidden="true" />
                <span className="font-semibold">{tab.label}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{tab.desc}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <TabsContent value="document" tabIndex={-1}><DocumentTab /></TabsContent>
            <TabsContent value="video" tabIndex={-1}><VideoTab /></TabsContent>
            <TabsContent value="canvas" tabIndex={-1}><CanvasTab /></TabsContent>
            <TabsContent value="alttext" tabIndex={-1}><AltTextTab /></TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-4">
          <Shield className="w-3.5 h-3.5 text-[#4338ca]" aria-hidden="true" />
          WCAG 2.1 AA Compliant — All processing is AI-powered
        </div>
      </div>
    </div>
  );
}
