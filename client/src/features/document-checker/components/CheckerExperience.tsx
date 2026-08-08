import { useCallback, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Analyzing } from "./Analyzing";
import { Results } from "./Results";
import { Uploader } from "./Uploader";
import {
  analyzeFile,
  type StageId,
  type ValidationError,
} from "../lib/analyze";
import type { Report } from "../lib/types";
import { countByStatus } from "../lib/types";
import "../document-checker.css";

type View = "idle" | "analyzing" | "results";

interface CheckerExperienceProps {
  compact?: boolean;
  mainId: string;
}

function fileTypeFromName(fileName: string): "PDF" | "DOCX" | "PPTX" | "UNKNOWN" {
  const extension = fileName.split(".").pop()?.toUpperCase();
  return extension === "PDF" || extension === "DOCX" || extension === "PPTX" ? extension : "UNKNOWN";
}

function logCheckerUsage(payload: {
  fileName: string;
  fileType: "PDF" | "DOCX" | "PPTX" | "UNKNOWN";
  status: "completed" | "failed";
  score?: number;
  criticalCount?: number;
  warningCount?: number;
}) {
  void apiRequest("POST", "/api/checker-usage", payload).catch(() => {
    // Usage reporting must never interrupt a visitor's accessibility check.
  });
}

export function CheckerExperience({ compact = false, mainId }: CheckerExperienceProps) {
  const [view, setView] = useState<View>("idle");
  const [error, setError] = useState<ValidationError | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [stage, setStage] = useState<StageId>("read");
  const [stageDetail, setStageDetail] = useState<string | undefined>();
  const [analyzingName, setAnalyzingName] = useState("");
  const cancelled = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const ExperienceRoot = compact ? "div" : "main";

  const focusMain = useCallback(() => {
    mainRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
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
        const counts = countByStatus(result.findings);
        logCheckerUsage({
          fileName: file.name,
          fileType: result.kind,
          status: "completed",
          score: result.score,
          criticalCount: counts.critical,
          warningCount: counts.warning,
        });
        setReport(result);
        setView("results");
        focusMain();
      } catch (err) {
        if (cancelled.current) return;
        logCheckerUsage({
          fileName: file.name,
          fileType: fileTypeFromName(file.name),
          status: "failed",
        });
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

  const reset = useCallback(() => {
    cancelled.current = true;
    setReport(null);
    setError(null);
    setView("idle");
    focusMain();
  }, [focusMain]);

  return (
    <div className={`document-checker-page${compact ? " document-checker-compact" : ""}`}>
      <ExperienceRoot
        id={mainId}
        ref={mainRef}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        {view === "idle" && (
          <Uploader
            onFile={handleFile}
            error={error}
            setError={setError}
            compact={compact}
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
      </ExperienceRoot>
    </div>
  );
}
