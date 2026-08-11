import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/clerk-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import iconDocument from "@/assets/icon-document.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Video, Code2, ImageIcon, Upload, CheckCircle2, AlertCircle,
  Copy, Download, Zap, Shield, Eye, ChevronRight, X, Loader2, ArrowLeft, RotateCcw, AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";

// ── Shared helpers ───────────────────────────────────────────────────────────

// Safely parses a fetch Response as JSON. If the server (or a proxy in front of it,
// e.g. on a timeout) returns HTML/plain text instead of JSON, this throws a clear,
// human-readable error instead of letting `resp.json()` throw a cryptic
// "Unexpected token '<' ... is not valid JSON" error.
async function parseApiResponse(resp: Response): Promise<any> {
  const raw = await resp.text();
  try {
    return JSON.parse(raw);
  } catch {
    if (!resp.ok) {
      throw new Error(
        resp.status === 413
          ? "That file is too large or took too long to process. Try a smaller file or fewer pages."
          : "Something went wrong on our end processing that file. Please try again in a moment."
      );
    }
    throw new Error("Received an unexpected response. Please try again in a moment.");
  }
}

function FileDropZone({ accept, onFile, label, sublabel, icon: Icon, iconImg, testId, resetKey }: {
  accept: string; onFile: (f: File) => void; label: string; sublabel: string; icon: any; iconImg?: string; testId: string; resetKey?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [resetKey]);

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
          {iconImg ? (
            <img src={iconImg} alt="" aria-hidden="true" className="w-20 h-20 object-contain" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[#0f766e]/10 flex items-center justify-center">
              <Icon className="w-10 h-10 text-[#0f766e]" />
            </div>
          )}
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
  if (t?.includes("error") || t?.includes("missing")) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold uppercase">Error</span>;
  if (t?.includes("warn") || t?.includes("contrast")) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase">Warning</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold uppercase">Info</span>;
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
    <div className="space-y-3 p-4 rounded-xl bg-[#3a485b]/5 border border-[#0f766e]/20">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-[#0f766e] animate-spin shrink-0" />
        <span className="text-sm text-[#0f766e] font-medium">{defaultSteps[stepIndex]}</span>
      </div>
      <div className="relative w-full h-2 bg-[#0f766e]/15 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-[#0f766e] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
    </div>
  );
}

function StartOverButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} data-testid="btn-start-over">
      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Start Over
    </Button>
  );
}

// Sends a failed job's details (+ the file the user was working with, if any) to support
// via the /api/report-error endpoint. Used by the "Report this issue" button in ErrorAlert
// so a real, reproducible bug report reaches us automatically instead of relying on a
// screenshot with no context.
async function reportErrorToSupport(opts: { tool: string; errorMessage: string; errorCode?: string; userEmail?: string; file?: File | null; htmlFallback?: string }) {
  const fd = new FormData();
  fd.append("tool", opts.tool);
  fd.append("errorMessage", opts.errorMessage);
  if (opts.errorCode) fd.append("errorCode", opts.errorCode);
  if (opts.userEmail) fd.append("userEmail", opts.userEmail);
  if (opts.file) {
    fd.append("file", opts.file);
  } else if (opts.htmlFallback) {
    // Not an actual file upload -- either pasted Canvas HTML or an image URL the user
    // typed in. Attach it as plain text so support can still see exactly what was submitted.
    fd.append("file", new Blob([opts.htmlFallback], { type: "text/plain" }), "submitted-content.txt");
  }
  const resp = await fetch("/api/report-error", { method: "POST", body: fd });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Couldn't send the report.");
  return data;
}

function ErrorAlert({ message, actionLabel, onAction, reportContext, showCreditNote }: { message: string; actionLabel?: string; onAction?: () => void; reportContext?: { tool: string; errorCode?: string; userEmail?: string; file?: File | null; htmlFallback?: string }; showCreditNote?: boolean }) {
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const { toast } = useToast();

  const handleReport = async () => {
    if (!reportContext) return;
    setReportState("sending");
    try {
      await reportErrorToSupport({ ...reportContext, errorMessage: message });
      setReportState("sent");
    } catch (e: any) {
      setReportState("failed");
      toast({ title: "Couldn't send report", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {showCreditNote && (
          <p className="mt-1 text-xs text-destructive/80">Your credits were not charged for this attempt.</p>
        )}
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {actionLabel && onAction && (
            <button onClick={onAction} className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 hover:no-underline">
              {actionLabel}
            </button>
          )}
          {reportContext && reportState !== "sent" && (
            <button
              onClick={handleReport}
              disabled={reportState === "sending"}
              className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-60"
              data-testid="btn-report-error"
            >
              {reportState === "sending" ? "Sending report…" : reportState === "failed" ? "Try reporting again" : "Report this issue"}
            </button>
          )}
          {reportState === "sent" && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />Report sent — thank you
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document Tab ─────────────────────────────────────────────────────────────
// ── Remedy Docs Tab ──────────────────────────────────────────────────────────
// Merges the old "Document Fixer" (fast text pipeline) and "Complex PDF" (Claude
// Vision per-page pipeline) into a single upload. The backend (/api/remedy-docs/fix)
// auto-detects which pipeline to run and tells us via the X-Remedy-Docs-Route
// response header; the two pipelines still return different response shapes
// (JSON with rawText/HTML for the fast path, a raw PDF binary for the vision path)
// so this component branches on Content-Type to render the correct result UI --
// each branch reuses the exact, unchanged result-handling logic from the two
// original tabs (docx-building for fast, blob-download for vision).
type DocsOutputMode = "auto" | "pdf" | "docx";

function RemedyDocsTab() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fastResult, setFastResult] = useState<any>(null);
  const [visionResult, setVisionResult] = useState<{ blob: Blob; filename: string; pages: number; fixes: string[] } | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [outputMode, setOutputMode] = useState<DocsOutputMode>("auto");
  const { toast } = useToast();
  const { user: docsUser } = useUser();

  const startOver = () => { setFile(null); setFastResult(null); setVisionResult(null); setError(""); setErrorCode(""); setResetKey((k) => k + 1); };

  const run = async () => {
    if (!file) { toast({ title: "No file", variant: "destructive" }); return; }
    setLoading(true); setError(""); setErrorCode(""); setFastResult(null); setVisionResult(null);
    let chargedJobId: number | null = null;
    try {
      const fd = new FormData(); fd.append("file", file);
      if (docsUser?.id) fd.append("clerkUserId", docsUser.id);
      // Only pass an explicit mode when the user picked "Keep as PDF" or
      // "Convert to Word" -- "auto" is omitted so the server's existing
      // fast-vs-vision auto-detection is unchanged for users who don't choose.
      if (outputMode === "pdf" || outputMode === "docx") fd.append("mode", outputMode);
      const resp = await fetch("/api/remedy-docs/fix", { method: "POST", body: fd });
      const contentType = resp.headers.get("Content-Type") || "";

      if (contentType.includes("application/pdf")) {
        // ── Vision pipeline result: raw PDF binary ──────────────────────────
        if (!resp.ok) {
          const errData = await parseApiResponse(resp).catch((e) => ({ error: e.message }));
          throw new Error(errData.error || `Server error ${resp.status}`);
        }
        const blob = await resp.blob();
        const pages = parseInt(resp.headers.get("X-Total-Pages") || "0", 10);
        let fixes: string[] = [];
        try { const raw = resp.headers.get("X-Fixes-Made") || ""; fixes = raw ? JSON.parse(atob(raw)) : []; } catch { fixes = []; }
        const baseName = file.name.replace(/\.pdf$/i, "");
        setVisionResult({ blob, filename: `${baseName}-accessible.pdf`, pages, fixes });
        setLoading(false);
        return;
      }

      // ── Fast pipeline result: JSON ───────────────────────────────────────
      let data: any;
      try {
        data = await parseApiResponse(resp);
      } catch (parseErr: any) {
        if (resp.ok && docsUser?.id) {
          try {
            await fetch("/api/document/refund", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inputName: file.name, clerkUserId: docsUser.id }),
            });
            throw new Error(parseErr.message + " Your credits for this attempt have been refunded.");
          } catch (refundErr: any) {
            throw refundErr;
          }
        }
        throw parseErr;
      }
      if (!resp.ok) { setErrorCode(data.code || ""); throw new Error(data.error); }
      chargedJobId = data.jobId ?? null;

      if (outputMode === "pdf") {
        // ── "Keep as PDF" on the fast (text-extraction) path: the server already
        // built fully structured, WCAG-tagged HTML for this document -- send it
        // to the standalone tagging endpoint instead of building a .docx.
        const baseNamePdf = file.name.replace(/\.pdf$/i, "").replace(/\.docx$/i, "");
        const pdfResp = await fetch("/api/remedy-docs/fix-as-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredHtml: data.structuredHtml || data.htmlContent || "",
            title: baseNamePdf,
            filename: baseNamePdf,
          }),
        });
        if (!pdfResp.ok) {
          const errData = await parseApiResponse(pdfResp).catch((e) => ({ error: e.message }));
          throw new Error(errData.error || `Server error ${pdfResp.status}`);
        }
        const pdfBlob = await pdfResp.blob();
        setFastResult({ fixesMade: data.fixesMade || [], issues: data.issues || [], blob: pdfBlob, filename: `${baseNamePdf}-accessible.pdf` });
        setLoading(false);
        return;
      }

      const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, LevelFormat,
              Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = await import("docx");
      const fixesMade: string[] = data.fixesMade || [];
      const issues: any[] = data.issues || [];
      const rawText: string = data.rawText || "";
      const baseName = file.name.replace(/\.pdf$/i, "").replace(/\.docx$/i, "");
      const filename = baseName + "-accessible.docx";

      const html: string = data.structuredHtml || data.htmlContent || "";
      const parser = new DOMParser();
      const parsed2 = parser.parseFromString(`<body>${html}</body>`, "text/html");

      const docChildren: any[] = [];

      const cleanText = (raw: string) => raw.replace(/^\*{2,3}\s*/, "").trim();

      const buildTable = (tableNode: Element) => {
        const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "B0B0B0" };
        const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
        const rows = Array.from(tableNode.querySelectorAll("tr"));
        if (rows.length === 0) return;
        const maxCols = rows.reduce((m: number, r: Element) => Math.max(m, r.querySelectorAll("td,th").length), 0);
        if (maxCols === 0) return;
        const tableWidth = 9360;
        const colWidth = Math.floor(tableWidth / maxCols);
        const docxRows = rows.map((row: Element) => {
          const cells = Array.from(row.querySelectorAll("td,th"));
          const isHeader = cells.some((c: Element) => c.tagName.toLowerCase() === "th");
          const docxCells = cells.map((cell: Element) => {
            const cellText = (cell.textContent || "").trim();
            return new TableCell({
              borders: allBorders,
              width: { size: colWidth, type: WidthType.DXA },
              shading: isHeader ? { fill: "F5F5F5", type: ShadingType.CLEAR } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: isHeader })] })],
            });
          });
          while (docxCells.length < maxCols) {
            docxCells.push(new TableCell({
              borders: allBorders,
              width: { size: colWidth, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
            }));
          }
          return new TableRow({ children: docxCells });
        });
        docChildren.push(new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: Array(maxCols).fill(colWidth),
          rows: docxRows,
        }));
        docChildren.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 100 } }));
      };

      const processNode = (node: Element) => {
        const tag = node.tagName?.toLowerCase();
        const text = cleanText((node.textContent || "").trim());
        if (!text && tag !== "br" && tag !== "table") return;

        if (tag === "h1") {
          docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text })] }));
        } else if (tag === "h2") {
          docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text })] }));
        } else if (tag === "h3") {
          docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text })] }));
        } else if (tag === "h4" || tag === "h5" || tag === "h6") {
          docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_4, children: [new TextRun({ text })] }));
        } else if (tag === "li") {
          const parentTag = node.parentElement?.tagName?.toLowerCase();
          if (parentTag === "ol") {
            docChildren.push(new Paragraph({ numbering: { reference: "steps", level: 0 }, children: [new TextRun({ text })] }));
          } else {
            docChildren.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text })] }));
          }
        } else if (tag === "p") {
          if (text) docChildren.push(new Paragraph({ children: [new TextRun({ text })], spacing: { after: 100 } }));
        } else if (tag === "table") {
          buildTable(node);
        } else if (tag === "div" || tag === "article" || tag === "header" || tag === "section") {
          const elementChildren = Array.from(node.children).filter((c: Element) => (c as Element).tagName?.toLowerCase() !== "br");
          if (elementChildren.length > 0) {
            Array.from(node.children).forEach(child => processNode(child as Element));
          } else if (text) {
            const innerHTML = node.innerHTML || "";
            const lines = innerHTML.split(/<br\s*\/?>/i).map((l: string) => cleanText(l.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())).filter((l: string) => l.length > 0);
            lines.forEach((line: string) => docChildren.push(new Paragraph({ children: [new TextRun({ text: line })], spacing: { after: 60 } })));
          }
        } else if (tag === "body" || tag === "ul" || tag === "ol") {
          Array.from(node.children).forEach(child => processNode(child as Element));
        } else if (text) {
          docChildren.push(new Paragraph({ children: [new TextRun({ text })], spacing: { after: 80 } }));
        }
      };

      if (html && parsed2.body.children.length > 0) {
        Array.from(parsed2.body.children).forEach(child => processNode(child as Element));
      } else {
        rawText.split("\n").forEach((line: string) => {
          const t = cleanText(line.trim());
          if (t) docChildren.push(new Paragraph({ children: [new TextRun({ text: t })], spacing: { after: 80 } }));
        });
      }

      if (docChildren.length === 0) {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: rawText })] }));
      }

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
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, font: "Calibri", color: "000000" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Calibri", color: "000000" }, paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 1 } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, font: "Calibri", color: "000000" }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
            { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, italics: true, font: "Calibri", color: "222222" }, paragraph: { spacing: { before: 140, after: 60 }, outlineLevel: 3 } },
          ],
        },
        sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: docChildren }],
      });

      const blob = await Packer.toBlob(doc);
      setFastResult({ fixesMade, issues, blob, filename });
    } catch (e: any) {
      setError(e.message);
      if (chargedJobId && docsUser?.id) {
        try {
          await fetch("/api/document/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: chargedJobId, clerkUserId: docsUser.id }),
          });
          setError(e.message + " Your credits for this attempt have been refunded.");
        } catch {
          // Refund call itself failed silently — surface the original error only;
          // this is logged server-side and can be reconciled manually if needed.
        }
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropZone accept=".docx,.pdf" onFile={setFile} label="Upload Document" sublabel=".docx and .pdf files" icon={FileText} iconImg={iconDocument} testId="doc-upload" resetKey={resetKey} />
      <div className="text-xs text-muted-foreground space-y-0.5 px-1">
        <p>✓ Word (.docx) and PDF files supported — including scanned pages, images, tables, and multi-column layouts</p>
        <p>✓ Documents up to 50 pages</p>
      </div>
      <p className="text-xs text-muted-foreground px-1">
        <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-[#0f766e]" />
        Remedy Docs gets you most of the way to compliant — always give the result a quick manual check before publishing.{" "}
        <Link href="/kb/articles/how-to-check-your-output-is-accessible" className="text-[#0f766e] font-medium underline underline-offset-2">
          Learn how →
        </Link>
      </p>

      <fieldset className="space-y-2.5 p-3 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/5" data-testid="doc-output-mode">
        <legend className="text-sm font-semibold text-foreground px-1">Please select an output <span className="text-[#0f766e]">*</span></legend>
        <div className="space-y-2" role="radiogroup" aria-label="Output format">
          {([
            { value: "auto", label: "Auto-Detect", Icon: Zap },
            { value: "pdf", label: "PDF", Icon: FileText },
            { value: "docx", label: "Word", Icon: FileText },
          ] as { value: DocsOutputMode; label: string; Icon: typeof Zap }[]).map(({ value, label, Icon }) => (
            <label
              key={value}
              htmlFor={`mode-${value}`}
              data-testid={`mode-${value}`}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                outputMode === value
                  ? "border-[#0f766e] bg-white dark:bg-background ring-1 ring-[#0f766e]"
                  : "border-border bg-white/60 dark:bg-background/60 hover:border-[#0f766e]/50"
              }`}
            >
              <input
                type="radio"
                id={`mode-${value}`}
                name="doc-output-mode"
                value={value}
                checked={outputMode === value}
                onChange={() => setOutputMode(value)}
                className="w-4 h-4 shrink-0 accent-[#0f766e]"
              />
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${outputMode === value ? "text-[#0f766e]" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <Button className="w-full bg-[#0f766e] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || !file} data-testid="btn-fix-doc">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><Zap className="w-4 h-4 mr-2" />Fix Accessibility</>}
      </Button>
      {loading && <LoadingState text="Analyzing document…" steps={["Reading your document…", "Detecting tables, images, and layout…", "Applying WCAG 2.1 fixes…", "Generating accessible version…"]} />}
      {error && <ErrorAlert message={error} showCreditNote reportContext={{ tool: "Remedy Docs", errorCode, userEmail: docsUser?.primaryEmailAddress?.emailAddress, file }} />}

      {fastResult && (
        <div className="space-y-4" data-testid="doc-result">
          <div className="flex items-center justify-end"><StartOverButton onClick={startOver} /></div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">What was fixed</span></div>
            {fastResult.fixesMade?.length > 0 ? (
              <ul className="space-y-1">
                {fastResult.fixesMade.slice(0, 8).map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />{s.trim()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Accessibility improvements applied.</p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold text-red-800 dark:text-red-300 text-sm">This is a starting point, not a finished accessible document</span>
            </div>
            <p className="text-xs text-red-700/90 dark:text-red-400/90 leading-relaxed">
              No automated tool — including this one — can guarantee full WCAG 2.1 AA compliance. Review this file yourself before publishing or distributing it, especially images, tables, and reading order.{" "}
              <Link href="/kb/articles/how-to-check-your-output-is-accessible" className="font-semibold underline underline-offset-2">
                See exactly how to check it in 10 minutes →
              </Link>
            </p>
          </div>
          {fastResult.blob && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Download this now.</span> We don't store finished documents, so once you leave this page it's gone for good — you'd need to re-upload and spend credits again to get it back.
                </p>
              </div>
              <Button className="w-full bg-amber-500 text-white hover:bg-amber-600 font-semibold" onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(fastResult.blob);
                a.download = fastResult.filename;
                a.click();
              }}>
                <Download className="w-4 h-4 mr-2" />Download {fastResult.filename}
              </Button>
            </>
          )}
        </div>
      )}

      {visionResult && (
        <div className="space-y-4" data-testid="doc-result">
          <div className="flex items-center justify-end"><StartOverButton onClick={startOver} /></div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                {visionResult.pages > 0 ? `${visionResult.pages}-page` : ""} PDF ready
              </span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold text-red-800 dark:text-red-300 text-sm">This is a starting point, not a finished accessible document</span>
            </div>
            <p className="text-xs text-red-700/90 dark:text-red-400/90 leading-relaxed">
              No automated tool — including this one — can guarantee full WCAG 2.1 AA compliance. Review this file yourself before publishing or distributing it, especially diagrams, equations, and tables.{" "}
              <Link href="/kb/articles/how-to-check-your-output-is-accessible" className="font-semibold underline underline-offset-2">
                See exactly how to check it in 10 minutes →
              </Link>
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Download this now.</span> We don't store finished documents, so once you leave this page it's gone for good — you'd need to re-upload and spend credits again to get it back.
            </p>
          </div>
          <Button
            className="w-full bg-amber-500 text-white hover:bg-amber-600 font-semibold"
            onClick={() => {
              const url = URL.createObjectURL(visionResult.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = visionResult.filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />Download {visionResult.filename}
          </Button>
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
  const [resetKey, setResetKey] = useState(0);
  const { toast } = useToast();
  const { user: videoUser } = useUser();

  const [errorCode, setErrorCode] = useState("");
  const startOver = () => { setFile(null); setResult(null); setError(""); setErrorCode(""); setResetKey((k) => k + 1); };

  const run = async () => {
    if (!file) { toast({ title: "No file selected", variant: "destructive" }); return; }
    setLoading(true); setError(""); setErrorCode(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      if (videoUser?.id) fd.append("clerkUserId", videoUser.id);
      const resp = await fetch("/api/video/transcribe", { method: "POST", body: fd });
      const data = await parseApiResponse(resp);
      if (!resp.ok) { setErrorCode(data.code || ""); throw new Error(data.error); }
      setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropZone accept=".mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.m4a" onFile={setFile} label="Upload Video or Audio" sublabel="MP4, MOV, AVI, WebM, MP3, WAV, M4A" icon={Video} iconImg={iconVideo} testId="video-upload" resetKey={resetKey} />

      <Button className="w-full bg-[#0f766e] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || !file} data-testid="btn-transcribe">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transcribing…</> : <><Zap className="w-4 h-4 mr-2" />Generate Timecoded Transcript</>}
      </Button>
      {loading && <LoadingState text="Transcribing…" steps={["Uploading file…", "Extracting audio track…", "Running AI transcription…", "Generating timecoded transcript…"]} />}
      {error && <ErrorAlert message={error} showCreditNote reportContext={{ tool: "Remedy Video", errorCode, userEmail: videoUser?.primaryEmailAddress?.emailAddress, file }} />}
      {result && (
        <div className="space-y-4" data-testid="video-result">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Transcribed: {result.filename}</span>
              {result.language && <Badge variant="secondary">{result.language?.toUpperCase()}</Badge>}
            </div>
            <StartOverButton onClick={startOver} />
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
                <Button size="sm" variant="outline" onClick={async () => {
                  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
                  const baseName = result.filename?.replace(/\.[^.]+$/, "") || "transcript";
                  const content = view === "timecoded" ? result.timecodedTranscript : result.plainText;
                  const lines = (content || "").split("\n").filter((l: string) => l.trim());
                  const children = [
                    new Paragraph({ text: baseName + " — Transcript", heading: HeadingLevel.HEADING_1 }),
                    ...lines.map((line: string) => new Paragraph({
                      children: [new TextRun({ text: line, font: "Calibri", size: 24 })],
                      spacing: { after: 80 },
                    }))
                  ];
                  const doc = new Document({ sections: [{ children }] });
                  const blob = await Packer.toBlob(doc);
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = baseName + "-transcript.docx"; a.click();
                }}>
                  <Download className="w-3.5 h-3.5 mr-1" />Download
                </Button>
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
  const { user: canvasUser } = useUser();
  const [errorCode, setErrorCode] = useState("");

  const run = async () => {
    if (!html.trim()) { toast({ title: "No HTML", variant: "destructive" }); return; }
    setLoading(true); setError(""); setErrorCode(""); setResult(null);
    try {
      const resp = await fetch("/api/canvas/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, clerkUserId: canvasUser?.id }) });
      const data = await parseApiResponse(resp);
      if (!resp.ok) { setErrorCode(data.code || ""); throw new Error(data.error); }
      setResult(data);
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
          {(html || result) && <Button variant="ghost" size="sm" onClick={() => { setHtml(""); setResult(null); setError(""); }}><X className="w-3.5 h-3.5 mr-1" />Clear</Button>}
        </div>
      </div>
      <Button className="w-full bg-[#0f766e] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || !html.trim()} data-testid="btn-fix-canvas">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Making it accessible…</> : <><Zap className="w-4 h-4 mr-2" />Fix Canvas Accessibility</>}
      </Button>
      {loading && <LoadingState text="Fixing Canvas HTML…" steps={["Parsing your HTML…", "Checking color contrast…", "Fixing heading structure…", "Adding ARIA labels…", "Finalizing accessible HTML…"]} />}
      {error && <ErrorAlert message={error} showCreditNote reportContext={{ tool: "Remedy HTML (Canvas)", errorCode, userEmail: canvasUser?.primaryEmailAddress?.emailAddress, htmlFallback: html }} />}
      {result && (
        <div className="space-y-4" data-testid="canvas-result">
          <div className="flex items-center justify-end"><StartOverButton onClick={() => { setHtml(""); setResult(null); setError(""); }} /></div>
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
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#0f766e] shrink-0" />
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
  const [resetKey, setResetKey] = useState(0);
  const { toast } = useToast();
  const { user: altTextUser } = useUser();
  const [errorCode, setErrorCode] = useState("");

  const handleFile = (f: File) => { setFile(f); setImageUrl(""); setPreviewUrl(URL.createObjectURL(f)); };

  const startOver = () => { setFile(null); setImageUrl(""); setContext(""); setPreviewUrl(null); setResult(null); setError(""); setErrorCode(""); setResetKey((k) => k + 1); };

  const run = async () => {
    if (!file && !imageUrl.trim()) { toast({ title: "No image", variant: "destructive" }); return; }
    setLoading(true); setError(""); setErrorCode(""); setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      if (imageUrl) fd.append("imageUrl", imageUrl);
      fd.append("context", context);
      if (altTextUser?.id) fd.append("clerkUserId", altTextUser.id);
      const resp = await fetch("/api/alttext/generate", { method: "POST", body: fd });
      const data = await parseApiResponse(resp);
      if (!resp.ok) { setErrorCode(data.code || ""); throw new Error(data.error); }
      setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <FileDropZone accept="image/*" onFile={handleFile} label="Upload Image" sublabel="PNG, JPG, GIF, WebP — or paste a URL below" icon={ImageIcon} iconImg={iconAlttext} testId="img-upload" resetKey={resetKey} />
      {previewUrl && <div className="rounded-xl overflow-hidden border max-h-48"><img src={previewUrl} alt="Preview of uploaded image" className="w-full h-full object-contain bg-muted" /></div>}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="img-url">Or enter image URL</label>
        <input id="img-url" type="url" placeholder="https://example.com/image.png" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e]" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setFile(null); setPreviewUrl(null); }} data-testid="input-img-url" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="alt-context">Context <span className="text-muted-foreground font-normal">(optional — describe the page this image is for)</span></label>
        <Textarea id="alt-context" placeholder="e.g. This is a chart showing student enrollment trends…" className="text-sm min-h-[80px] resize-y" value={context} onChange={(e) => setContext(e.target.value)} data-testid="input-context" />
      </div>
      <Button className="w-full bg-[#0f766e] text-white hover:brightness-110 font-semibold" onClick={run} disabled={loading || (!file && !imageUrl.trim())} data-testid="btn-gen-alt">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><Eye className="w-4 h-4 mr-2" />Generate Alt Text</>}
      </Button>
      {error && <ErrorAlert message={error} showCreditNote reportContext={{ tool: "Remedy Image (Alt Text)", errorCode, userEmail: altTextUser?.primaryEmailAddress?.emailAddress, file, htmlFallback: !file && imageUrl ? `Image URL: ${imageUrl}` : undefined }} />}
      {result && (
        <div className="space-y-4" data-testid="alt-result">
          <div className="flex items-center justify-end"><StartOverButton onClick={startOver} /></div>
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
              {result.reasoning && <div className="p-3 rounded-lg bg-[#3a485b]/5 border border-[#0f766e]/20 text-sm text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{result.reasoning}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── TOOLS PAGE SHELL ─────────────────────────────────────────────────────────
// One shared teal accent marks which tool is active — the active tab gets a
// teal border, inactive tabs stay faded/muted. Labels and titles stay black.
const ACCENT = "#0f766e";
const ACCENT_SOFT_HOVER = "#0f766e1f";
const TAB_META = [
  {
    id: "document", label: "Remedy\nDocs", icon: iconDocument, beta: false, badge: ".docx & .pdf",
    title: "Remedy Docs", blurb: "Upload any Word doc or PDF. Remedy508 automatically detects images, tables, and multi-column layouts and remediates the whole document — no need to pick a tool.",
  },
  {
    id: "video", label: "Remedy\nVideo", icon: iconVideo, beta: false, badge: "MP4, MOV, MP3",
    title: "Remedy Video", blurb: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.",
  },
  {
    id: "canvas", label: "Remedy\nHTML", icon: iconCanvas, beta: true, badge: "Canvas LMS",
    title: "Remedy HTML", blurb: "Paste your Canvas page HTML — Remedy508 fixes heading hierarchy, color contrast, missing alt text, and table issues.",
  },
  {
    id: "alttext", label: "Remedy\nImage", icon: iconAlttext, beta: false, badge: "Images & charts",
    title: "Remedy Image", blurb: "Upload or link an image. Remedy508 generates concise, WCAG-compliant alt text — with long descriptions for complex charts.",
  },
] as const;

export default function ToolsPage() {
  useDocumentTitle("Accessibility Tools | Remedy Docs, Image, HTML & Video | Remedy508");
  const [, params] = useRoute("/tools/:tab");
  const initialTab = params?.tab || "document";
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [, navigate] = useLocation();

  // Active tab is tracked in state (not just Tabs' internal defaultValue) so the
  // tab strip and its content panel can share one color per tool. Keep the URL
  // in sync on change so /tools/:tab deep links and the back button still work.
  const [activeTab, setActiveTabState] = useState(initialTab);
  useEffect(() => { setActiveTabState(initialTab); }, [initialTab]);
  const setActiveTab = useCallback((id: string) => {
    setActiveTabState(id);
    window.history.pushState({}, "", `/tools/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  // Wait for Clerk to load before checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f766e]" />
      </div>
    );
  }

  // Not signed in — send to signup
  if (!isSignedIn) {
    navigate("/signup");
    return null;
  }

  // Signed in but not subscribed — send to pricing
  const subscribed = (user?.publicMetadata as any)?.subscribed === true;
  // Allow admin (amandathecarpenter@gmail.com) to bypass
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "amandathecarpenter@gmail.com";
  if (!subscribed && !isAdmin) {
    navigate("/pricing");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="tools-page">
      <SiteHeader />

      <main id="main-content">
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
          <h1 className="text-2xl font-bold text-[#3a485b]">
            Accessibility <span className="text-[#0f766e]">Tools</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Upload, paste, or drop — Remedy508 handles the accessibility fixes.</p>
        </div>

        {/* Tab interface — the active tool's color carries through the tab
            itself, the panel border, and the heading, so there's one clear
            signal for "which tool am I on" instead of a separate description
            block above a disconnected tab strip. */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0" data-testid="tool-tabs">
          <TabsList className="grid grid-cols-4 w-full h-auto p-1 gap-1 bg-gray-100">
            {TAB_META.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex flex-col items-center justify-start gap-1.5 py-3 px-1 h-full min-h-[112px] rounded-lg border-2 transition-colors ${isActive ? "border-transparent shadow-sm" : "border-transparent opacity-50"}`}
                  style={isActive ? { backgroundColor: "#fff", borderColor: ACCENT } : undefined}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = ACCENT_SOFT_HOVER; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = ""; }}
                  data-testid={`tab-${tab.id}`}
                >
                  <img src={tab.icon} alt="" aria-hidden="true" className="w-16 h-16 object-contain shrink-0" />
                  <span className="font-bold text-base text-center leading-tight whitespace-pre-line w-full text-black">{tab.label}</span>
                  {tab.beta && <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">BETA</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TAB_META.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} tabIndex={-1} className="mt-4">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                {/* Tool identity: title + description live right where the tool is used,
                    instead of in a separate block above the tabs. */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-lg text-black">{tab.title}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tab.badge}</span>
                  {tab.beta && <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">BETA</span>}
                </div>
                <p className="text-sm text-gray-500 leading-snug mb-4">{tab.blurb}</p>
                <div className="border-t border-gray-100 pt-4">
                  {tab.id === "document" && <RemedyDocsTab />}
                  {tab.id === "video" && <VideoTab />}
                  {tab.id === "canvas" && <CanvasTab />}
                  {tab.id === "alttext" && <AltTextTab />}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 py-4 text-center">
          <Shield className="w-3.5 h-3.5 text-[#0f766e] shrink-0" aria-hidden="true" />
          Designed to support WCAG 2.1 AA accessibility. For best results, complete a final accessibility review before publishing.
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
