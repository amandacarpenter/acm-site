export type LargeDocumentJob = {
  id: string; filename: string; mode: "pdf" | "docx";
  state: "queued" | "processing" | "paused" | "interrupted" | "failed" | "ready";
  totalPages: number; completedPages: number; progress: number; stage: string;
  createdAt: number; expiresAt: number; error?: string;
};
