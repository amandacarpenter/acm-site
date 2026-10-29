import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText } from "lucide-react";
import "../../client/src/index.css";
import LargeDocumentTest from "../../client/src/components/LargeDocumentTest";
import DocumentSizeChoice, { type DocumentSize } from "../../client/src/components/DocumentSizeChoice";
import logo from "../../client/src/assets/logo.png";
import docsIcon from "../../client/src/assets/icon-document.png";

function Preview() {
  const [size, setSize] = useState<DocumentSize>("large");
  const [opened, setOpened] = useState(true);
  const [active, setActive] = useState(false);
  return <div className="large-docs">
    <header className="ld-header"><img src={logo} alt="Remedy508"/><span className="ld-badge">PRIVATE PREVIEW</span></header>
    <main className="ld-main">
      <div className="ld-title"><img src={docsIcon} alt=""/><div><h1>Remedy Docs</h1><p>One upload. One finished document.</p></div></div>
      <p className="ld-intro">Choose the size of your document to get started.</p>
      <aside className="ld-note">Preview of the matching output selector. This styling update is not live yet. Standard processing is shown for comparison only.</aside>
      <section className="ld-card">
        <DocumentSizeChoice value={size} disabled={active} onChange={value => { setSize(value); if(value === "large") setOpened(true); }}/>
        <div hidden={size !== "standard"}>
          <div className="ld-upload"><strong>Upload Document</strong><span>.docx and .pdf files · Up to 50 pages</span></div>
          <fieldset disabled className="my-6 space-y-2.5 p-3 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/5">
            <legend className="text-sm font-semibold text-foreground px-1">Please select an output <span className="text-[#0f766e]">*</span></legend>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs" role="radiogroup" aria-label="Output format">
              {["PDF", "Word"].map((label, i) => <label key={label} className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2 rounded-lg border ${i === 0 ? "border-[#0f766e] bg-white ring-1 ring-[#0f766e]" : "border-border bg-white/60"}`}>
                <input type="radio" name="standard-preview-output" checked={i === 0} readOnly className="w-4 h-4 shrink-0 accent-[#0f766e]" />
                <div className="flex items-center gap-1.5"><FileText aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${i === 0 ? "text-[#0f766e]" : "text-muted-foreground"}`} /><span className="text-sm font-semibold text-foreground">{label}</span></div>
              </label>)}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed"><strong className="font-semibold text-foreground">Not sure which output to choose?</strong> If your document's images are purely decorative (backgrounds, borders, logos with no real context), Word usually gives the cleanest accessible text. Choose PDF if any image conveys information a reader needs.</p>
          </fieldset>
          <p className="ld-intro" style={{fontSize:".875rem"}}>Your existing standard Remedy Docs flow stays as it is. Choose Large document above to open the working test and its saved results.</p>
          <button className="ld-primary" disabled>Standard processing is disabled in this preview</button>
        </div>
        {opened && <div hidden={size !== "large"}>
          <p className="ld-intro" style={{fontSize:".875rem"}}>Live-site rate: 1 credit per source page, with enough credits required for the whole document before starting. This private preview does not use your Remedy508 Credits.</p>
          <LargeDocumentTest embedded apiBase={import.meta.env.VITE_LARGE_DOCS_API || ""} onActiveChange={setActive}/>
        </div>}
      </section>
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
