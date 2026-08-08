import { analyzeDocx } from './analyzeDocx';
import { analyzePptx } from './analyzePptx';
import { analyzePdf } from './analyzePdf';
import { computeScore, formatBytes, type FileKind, type Report } from './types';

export const MAX_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx'] as const;

export const STAGES = [
  { id: 'read', label: 'Reading the file in your browser' },
  { id: 'parse', label: 'Opening the document package' },
  { id: 'structure', label: 'Inspecting structure, text, and images' },
  { id: 'semantics', label: 'Checking links, tables, and metadata' },
  { id: 'compile', label: 'Compiling findings and preflight score' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export function kindFromFile(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'PDF';
  if (name.endsWith('.docx')) return 'DOCX';
  if (name.endsWith('.pptx')) return 'PPTX';
  return null;
}

export interface ValidationError {
  title: string;
  message: string;
}

export function validateFile(file: File): ValidationError | null {
  const kind = kindFromFile(file);
  if (!kind) {
    return {
      title: 'Unsupported file type',
      message: `“${file.name}” is not a supported format. Choose a PDF (.pdf), Word document (.docx), or PowerPoint deck (.pptx). Legacy .doc and .ppt files must be re-saved in the newer format first.`,
    };
  }
  if (file.size === 0) {
    return {
      title: 'Empty file',
      message: `“${file.name}” is 0 bytes, so there is nothing to inspect. Try re-exporting the document.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      title: 'File is too large',
      message: `“${file.name}” is ${formatBytes(file.size)}. The in-browser checker accepts files up to 50 MB.`,
    };
  }
  return null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function analyzeFile(
  file: File,
  onStage: (stage: StageId, detail?: string) => void,
): Promise<Report> {
  const kind = kindFromFile(file);
  if (!kind) throw new Error('Unsupported file type.');

  onStage('read');
  await delay(320);
  onStage('parse');

  let findings, facts, parseNotes: string[];
  if (kind === 'PDF') {
    onStage('structure');
    const res = await analyzePdf(file, (n, total) => {
      onStage('structure', `Page ${n} of ${total}`);
    });
    findings = res.findings;
    facts = res.facts;
    parseNotes = res.parseNotes;
  } else {
    const res = kind === 'DOCX' ? await analyzeDocx(file) : await analyzePptx(file);
    onStage('structure');
    await delay(380);
    findings = res.findings;
    facts = res.facts;
    parseNotes = res.parseNotes;
  }

  onStage('semantics');
  await delay(340);
  onStage('compile');
  await delay(300);

  return {
    fileName: file.name,
    fileSizeLabel: formatBytes(file.size),
    kind,
    generatedAt: new Date().toLocaleString(),
    isSample: false,
    score: computeScore(findings),
    facts,
    findings,
    parseNotes,
  };
}
