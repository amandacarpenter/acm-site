import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import LargeDocumentTest from "../../client/src/components/LargeDocumentTest";
import DocumentSizeChoice, { type DocumentSize } from "../../client/src/components/DocumentSizeChoice";
import logo from "../../client/src/assets/logo.png";
import docsIcon from "../../client/src/assets/icon-document.png";

function Preview() {
  const [size, setSize] = useState<DocumentSize>("standard");
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState(false);
  return <div className="large-docs">
    <header className="ld-header"><img src={logo} alt="Remedy508"/><span className="ld-badge">PRIVATE PREVIEW</span></header>
    <main className="ld-main">
      <div className="ld-title"><img src={docsIcon} alt=""/><div><h1>Remedy Docs</h1><p>One upload. One finished document.</p></div></div>
      <p className="ld-intro">Choose the size of your document to get started.</p>
      <aside className="ld-note">Preview of the new document-size choice. The live site is unchanged. Large-document processing works here; standard processing is shown for context only.</aside>
      <section className="ld-card">
        <DocumentSizeChoice value={size} disabled={active} onChange={value => { setSize(value); if(value === "large") setOpened(true); }}/>
        <div hidden={size !== "standard"}>
          <div className="ld-upload"><strong>Upload Document</strong><span>.docx and .pdf files · Up to 50 pages</span></div>
          <div className="ld-output"><h2>Please select an output</h2><div className="ld-options">
            <button disabled aria-pressed="true">PDF</button><button disabled>Word</button>
          </div></div>
          <p className="ld-intro" style={{fontSize:".875rem"}}>Your existing standard Remedy Docs flow stays as it is. Choose Large document above to open the working test and its saved results.</p>
          <button className="ld-primary" disabled>Standard processing is disabled in this preview</button>
        </div>
        {opened && <div hidden={size !== "large"}><LargeDocumentTest embedded apiBase={import.meta.env.VITE_LARGE_DOCS_API || ""} onActiveChange={setActive}/></div>}
      </section>
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
