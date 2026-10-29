import { useEffect, useRef, useState } from "react";
import { FileText, Upload, Download, X, Pause, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import docsIcon from "@/assets/icon-document.png";
import type { LargeDocumentJob } from "@shared/largeDocuments";
import "./large-document-test.css";

type Props = { apiBase?: string; getToken?: () => Promise<string | null>; embedded?: boolean; onActiveChange?: (active: boolean) => void };
export default function LargeDocumentTest({ apiBase = "", getToken, embedded = false, onActiveChange }: Props) {
  const [config, setConfig] = useState<any>();
  const [file, setFile] = useState<File>();
  const [mode, setMode] = useState<"pdf" | "docx">("pdf");
  const [job, setJob] = useState<LargeDocumentJob>();
  const [jobs, setJobs] = useState<LargeDocumentJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [timeAcknowledged, setTimeAcknowledged] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = Boolean(job && ["queued", "processing"].includes(job.state));
  useEffect(() => { onActiveChange?.(active || busy); }, [active, busy, onActiveChange]);
  async function request(endpoint: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    const token = await getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(apiBase + "/api/large-docs" + endpoint, { ...options, headers, signal: AbortSignal.timeout(45000) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status}).`);
    }
    return response;
  }
  async function refresh() {
    const data = await (await request("/jobs")).json(); setJobs(data.jobs);
    return data.jobs as LargeDocumentJob[];
  }
  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const data = await (await request("/config")).json();
        const history = await refresh();
        if (!gone) { setConfig(data); setJob(history[0]?.state === "ready" ? undefined : history[0]); }
      } catch (e: any) { if (!gone) setError(e.message); }
    })();
    return () => { gone = true; };
  }, [apiBase]);
  useEffect(() => {
    if (!active || !job) return;
    let gone = false, polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const data = await (await request("/jobs/" + job.id)).json();
        if (!gone) { setJob(data.job); setError(""); }
        if (!["queued", "processing"].includes(data.job.state)) await refresh();
      } catch { if (!gone) setError("Connection interrupted. Your test is saved; check again without uploading twice."); }
      finally { polling = false; }
    }, 2000);
    return () => { gone = true; clearInterval(timer); };
  }, [job?.id, active]);
  function select(value?: File) {
    setError("");
    if (!value) return;
    if (!/\.pdf$/i.test(value.name) || value.size > 25 * 1024 * 1024) {
      setError("Please choose a PDF no larger than 25 MB."); return;
    }
    setFile(value);
    setTimeAcknowledged(false);
  }
  async function run() {
    if (!file || !timeAcknowledged) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("mode", mode);
      form.append("longProcessingAcknowledged", "true");
      const data = await (await request("/jobs", { method: "POST", body: form })).json();
      setJob(data.job); await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function action(name: string) {
    if (!job) return;
    setBusy(true); setError("");
    try {
      const data = await (await request(`/jobs/${job.id}/${name}`, { method: "POST" })).json();
      setJob(data.job);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!job) return;
    setBusy(true); setError("");
    try {
      const blob = await (await request(`/jobs/${job.id}/result`)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = job.filename.replace(/\.pdf$/i, "") + (config.workflowTest ? "-WORKFLOW-TEST." : "-accessible-test.") + job.mode;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!job) return;
    setBusy(true);
    try {
      await request(`/jobs/${job.id}`, { method: "DELETE" });
      setJob(undefined); setRemoveConfirm(false); setFile(undefined); await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className={`large-docs ${embedded ? "ld-embedded" : ""}`}>
    {!embedded && <header className="ld-header"><img src={logo} alt="Remedy508" /><span className="ld-badge">PRIVATE TEST VERSION</span></header>}
    <div className="ld-main">
      {!embedded && <><div className="ld-title"><img src={docsIcon} alt="" /><div><h1>Remedy Docs</h1><p>One upload. One finished document.</p></div></div>
      <p className="ld-intro">Upload a PDF up to 400 pages. Choose your output, and let Remedy Docs handle the rest.</p></>}
      {!embedded && <aside className="ld-note">Separate test environment. Your live site, accounts and Remedy508 Credits are unchanged.
        {config?.workflowTest && <strong> Workflow testing only: AI remediation is disabled and downloads are not accessible deliverables.</strong>}</aside>
      }
      {embedded && config?.workflowTest && <aside className="ld-note"><strong>Workflow testing only: AI remediation is disabled and downloads are not accessible deliverables.</strong></aside>}
      {error && <div className="ld-error" role="alert"><AlertCircle size={20}/><span>{error}</span></div>}
      {!job && <section className="ld-card" aria-label="Upload and output">
        <aside className="ld-time-notice" aria-label="Large document processing time">
          <h2>Large documents take longer</h2>
          <p>Allow extra time, especially for hundreds of pages or complex layouts. We process the document in sections and combine everything into one PDF or Word file.</p>
          <p>Your progress is saved. Return here to check it instead of uploading the file again.</p>
        </aside>
        <label className={`ld-upload ${dragging ? "ld-dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) select(e.dataTransfer.files[0]); }}>
          <input ref={input} type="file" accept=".pdf,application/pdf" aria-label="Upload a PDF" disabled={busy || !config}
            onChange={e => select(e.target.files?.[0])} />
          <Upload size={30}/><strong>{file ? "Choose a different PDF" : "Choose a PDF or drop it here"}</strong>
          <span>Up to 400 pages · 25 MB maximum</span>
        </label>
        {file && <div className="ld-file"><FileText size={22}/><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span>
          <button type="button" className="ld-icon-button" aria-label="Remove file" disabled={busy} onClick={() => { setFile(undefined); if (input.current) input.current.value = ""; }}><X size={20}/></button></div>}
        <div className="ld-output"><h2>Select an output</h2>
          <div role="group" aria-label="Output format" className="ld-options">
            <button type="button" aria-pressed={mode === "pdf"} disabled={busy} onClick={() => setMode("pdf")}>PDF <small>One complete PDF</small></button>
            <button type="button" aria-pressed={mode === "docx"} disabled={busy} onClick={() => setMode("docx")}>Word <small>One editable document</small></button>
          </div>
          <p>Not sure? Choose PDF for a ready-to-share reading copy, or Word if you need to make edits.</p>
        </div>
        <label className="ld-time-consent">
          <input type="checkbox" checked={timeAcknowledged} disabled={busy}
            onChange={e => setTimeAcknowledged(e.target.checked)} />
          <span>I understand that large documents take longer to process.</span>
        </label>
        <button className="ld-primary" disabled={!file || busy || !config || !timeAcknowledged} onClick={run}>
          {busy ? "Starting your test…" : config?.workflowTest ? "Run workflow test" : "Make accessible"}
        </button>
      </section>}
      {job && <section className="ld-card ld-result" aria-label="Document status">
        <div className="ld-file"><FileText size={25}/><span>{job.filename}<small>{job.totalPages} source pages · {job.mode === "pdf" ? "PDF" : "Word"} output</small></span></div>
        <div className="ld-progress-heading"><h2>{job.state === "ready" ? "Your document is ready" : job.stage}</h2><strong>{job.progress}%</strong></div>
        <progress max={100} value={job.progress} aria-label="Document processing progress"/>
        <div className="ld-status" aria-live="polite">
          {job.state === "ready" ? <p><CheckCircle2 size={19}/> One complete file, with the content in source-page order.</p>
            : <p>Progress is saved. You can return to this test page without starting over.</p>}
          {job.error && <p className="ld-failure">{job.error}</p>}
        </div>
        <div className="ld-actions">
          {active && <button className="ld-secondary" disabled={busy || job.stage.startsWith("Pausing")} onClick={() => action("pause")}><Pause size={17}/> Pause</button>}
          {["paused", "failed", "interrupted"].includes(job.state) && <button className="ld-primary" disabled={busy} onClick={() => action("resume")}><RotateCcw size={18}/> Resume saved progress</button>}
          {job.state === "ready" && <button className="ld-primary" disabled={busy} onClick={download}><Download size={18}/> Download {job.mode === "pdf" ? "PDF" : "Word document"}</button>}
          {!active && <button className="ld-secondary" disabled={busy} onClick={() => { setJob(undefined); setFile(undefined); setError(""); setRemoveConfirm(false); refresh().catch(e => setError(e.message)); }}>Start another test</button>}
        </div>
        {!active && <div className="ld-delete">{removeConfirm ? <>
          <p>Remove this test and its uploaded file, saved progress and download?</p>
          <button disabled={busy} onClick={remove}>Remove test files</button><button onClick={() => setRemoveConfirm(false)}>Keep files</button>
        </> : <button onClick={() => setRemoveConfirm(true)}>Remove test files</button>}</div>}
      </section>}
      {jobs.length > 0 && <details className="ld-history"><summary>Recent tests</summary>{jobs.map(j =>
        <button key={j.id} onClick={() => { setJob(j); setFile(undefined); setError(""); setRemoveConfirm(false); }}><span>{j.filename}</span><small>{j.mode.toUpperCase()} · {j.state}</small></button>)}</details>}
      <footer className="ld-footer"><p>Always review alternative text, reading order, headings and tables before sharing. A test output is not an accessibility certification.</p>
        <p>Test files are retained for 24 hours after processing. The original layout and page count may change.</p></footer>
    </div>
  </div>;
}
