import { useCallback, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Analyzing } from "@/features/document-checker/components/Analyzing";
import { Results } from "@/features/document-checker/components/Results";
import { Uploader } from "@/features/document-checker/components/Uploader";
import {
  analyzeFile,
  type StageId,
  type ValidationError,
} from "@/features/document-checker/lib/analyze";
import { buildSampleReport } from "@/features/document-checker/lib/sample";
import type { Report } from "@/features/document-checker/lib/types";
import "@/features/document-checker/document-checker.css";

type View = "idle" | "analyzing" | "results";

export default function DocumentChecker() {
  useDocumentTitle("Remedy508 Accessibility Checker | Free Document Check");

  const [view, setView] = useState<View>("idle");
  const [error, setError] = useState<ValidationError | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [stage, setStage] = useState<StageId>("read");
  const [stageDetail, setStageDetail] = useState<string | undefined>();
  const [analyzingName, setAnalyzingName] = useState("");
  const cancelled = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  const focusMain = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    mainRef.current?.focus();
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      cancelled.current = false;
      setError(null);
      setAnalyzingName(file.name);
      setStage("read");
      setStageDetail(undefined);
      setView("analyzing");

      try {
        const result = await analyzeFile(file, (nextStage, detail) => {
          setStage(nextStage);
          setStageDetail(detail);
        });
        if (cancelled.current) return;
        setReport(result);
        setView("results");
        focusMain();
      } catch (err) {
        if (cancelled.current) return;
        setError({
          title: "This document could not be checked",
          message:
            err instanceof Error
              ? err.message
              : "An unexpected error stopped the scan. Try another file.",
        });
        setView("idle");
      }
    },
    [focusMain],
  );

  const handleSample = useCallback(() => {
    setError(null);
    setReport(buildSampleReport());
    setView("results");
    focusMain();
  }, [focusMain]);

  const reset = useCallback(() => {
    cancelled.current = true;
    setReport(null);
    setError(null);
    setView("idle");
    focusMain();
  }, [focusMain]);

  return (
    <>
      <a
        href="#document-checker-main"
        className="fixed left-3 top-[-80px] z-[100] rounded-lg bg-[#0f766e] px-4 py-3 font-semibold text-white focus:top-3"
      >
        Skip to document checker
      </a>
      <SiteHeader />
      <div className="document-checker-page">
        <main
          id="document-checker-main"
          ref={mainRef}
          tabIndex={-1}
          style={{ outline: "none" }}
        >
          {view === "idle" && (
            <Uploader
              onFile={handleFile}
              onSample={handleSample}
              error={error}
              setError={setError}
            />
          )}

          {view === "analyzing" && (
            <Analyzing
              fileName={analyzingName}
              stage={stage}
              detail={stageDetail}
              onCancel={reset}
            />
          )}

          {view === "results" && report && (
            <Results report={report} onReset={reset} />
          )}

          {view === "results" && !report && (
            <div className="wrap" style={{ padding: "60px 24px" }}>
              <p className="alert">
                <TriangleAlert size={18} aria-hidden="true" />
                No report is available. Start a new check.
              </p>
            </div>
          )}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
