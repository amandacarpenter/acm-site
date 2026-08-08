export type Status = 'critical' | 'warning' | 'passed' | 'review';

export type FileKind = 'PDF' | 'DOCX' | 'PPTX';

export interface Finding {
  /** stable id, used for test ids and report anchors */
  id: string;
  title: string;
  status: Status;
  /** short grouping label, e.g. "Structure", "Alternative text" */
  category: string;
  /** one-line plain-language result */
  summary: string;
  /** why this matters for people using assistive technology */
  why: string;
  /** practical remediation steps */
  fix: string;
  /** optional supporting observations */
  details?: string[];
  /** affected pages/slides/objects when known */
  locations?: string[];
  /** related standard references (informational only) */
  refs?: string[];
}

export interface Fact {
  label: string;
  value: string;
}

export interface Report {
  fileName: string;
  fileSizeLabel: string;
  kind: FileKind;
  generatedAt: string;
  score: number;
  facts: Fact[];
  findings: Finding[];
  /** anything the parser could not read */
  parseNotes?: string[];
}

export const STATUS_LABEL: Record<Status, string> = {
  critical: 'Critical',
  warning: 'Warning',
  passed: 'Passed',
  review: 'Needs review',
};

export const STATUS_ORDER: Status[] = ['critical', 'warning', 'review', 'passed'];

export function countByStatus(findings: Finding[]): Record<Status, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.status] += 1;
      return acc;
    },
    { critical: 0, warning: 0, passed: 0, review: 0 } as Record<Status, number>,
  );
}

/**
 * Automated findings score. Deliberately NOT a compliance score:
 * it only reflects confirmed machine-detectable findings in this tool.
 * Manual-review items are excluded because an unresolved check is not a
 * confirmed failure.
 */
export function computeScore(findings: Finding[]): number {
  const counts = countByStatus(findings);
  const penalty = counts.critical * 17 + counts.warning * 7;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function scoreBand(score: number): string {
  if (score >= 85) return 'Strong automated accessibility result';
  if (score >= 65) return 'A few accessibility improvements identified';
  if (score >= 40) return 'Additional accessibility improvements identified';
  return 'Automated remediation assistance recommended';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
