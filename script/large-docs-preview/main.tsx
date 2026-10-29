import React from "react";
import { createRoot } from "react-dom/client";
import LargeDocumentTest from "../../client/src/components/LargeDocumentTest";
createRoot(document.getElementById("root")!).render(<LargeDocumentTest apiBase={import.meta.env.VITE_LARGE_DOCS_API || ""}/>);
