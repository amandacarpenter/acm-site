export type Severity = 'problem' | 'review';

export interface Flag {
  severity: Severity;
  message: string;
  kind?: string;
}

/** One stop in the simulated reading order. */
export interface SimItem {
  n: number;
  kind: string;
  role: string;
  page: number;
  rects: number[][];
  display: string;
  speech: string;
  cell?: string;
  level?: number;
  links?: number;
  flags?: Flag[];
}

export interface SimIssue extends Flag {
  item: number;
}

export interface SimCounts {
  pages: number;
  headings: number;
  graphics: number;
  missingAlt: number;
  tables: number;
  lists: number;
  links: number;
  fields?: number;
}

export interface SimModel {
  format: 'pdf' | 'docx';
  name: string;
  items: SimItem[];
  issues: SimIssue[];
  title: string;
  displayTitle: boolean;
  lang: string;
  tagged: boolean;
  counts: SimCounts;
  /** pdf.js document (PDF only). */
  pdf?: any;
  /** Simple HTML view of the Word file (Word only). */
  html?: string;
  /** Object URLs for images in the Word view; revoke when done. */
  blobUrls?: string[];
}

export interface SimValidationError {
  title: string;
  message: string;
}
