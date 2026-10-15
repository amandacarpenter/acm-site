import { buildPdfModel, pdfjsLib } from './readPdf';
import { buildDocxModel } from './readDocx';
import type { SimModel, SimValidationError } from './types';

export const SIM_MAX_BYTES = 50 * 1024 * 1024;
export const SIM_ACCEPT = '.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const SIM_STAGES = [
  { id: 'read', label: 'Reading the file in your browser' },
  { id: 'open', label: 'Opening the document' },
  { id: 'order', label: 'Building the screen reader reading order' },
  { id: 'flags', label: 'Flagging what a screen reader would miss' },
] as const;

export type SimStageId = (typeof SIM_STAGES)[number]['id'];

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function formatOf(file: File): 'pdf' | 'docx' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || file.type === DOCX_MIME) return 'docx';
  return null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateSimFile(file: File): SimValidationError | null {
  if (!formatOf(file)) {
    return {
      title: 'Unsupported file type',
      message: /\.doc$/i.test(file.name)
        ? `“${file.name}” is an older .doc file. In Word, choose File, then Save As, and pick Word Document (.docx).`
        : `“${file.name}” is not a supported format. Choose a PDF (.pdf) or Word document (.docx).`,
    };
  }
  if (file.size === 0) {
    return { title: 'Empty file', message: `“${file.name}” is 0 bytes, so there is nothing to read. Try re-exporting the document.` };
  }
  if (file.size > SIM_MAX_BYTES) {
    return {
      title: 'File is too large',
      message: `“${file.name}” is ${formatBytes(file.size)}. The simulator accepts files up to 50 MB.`,
    };
  }
  return null;
}

const tick = () => new Promise((r) => setTimeout(r, 120));

/** Open a PDF or Word file locally and build its simulated reading order. Nothing is uploaded. */
export async function loadSimDocument(file: File, onStage: (s: SimStageId) => void): Promise<SimModel> {
  onStage('read');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formatOf(file);
  await tick();
  onStage('open');
  if (format === 'docx') {
    try {
      await tick();
      onStage('order');
      const model = (await buildDocxModel(bytes, file.name)) as SimModel;
      onStage('flags');
      await tick();
      return model;
    } catch (err: any) {
      throw new Error(
        err && err.code === 'encrypted'
          ? 'This Word file is password protected. Remove the password and try again.'
          : 'This file could not be opened as a Word document. It may be damaged or saved in another format.',
      );
    }
  }
  let pdf: any;
  try {
    pdf = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch (err: any) {
    throw new Error(
      err && err.name === 'PasswordException'
        ? 'This PDF is password protected. Remove the password and try again.'
        : 'This PDF could not be opened. It may be damaged or use an unsupported encryption method.',
    );
  }
  onStage('order');
  const model = (await buildPdfModel(pdf, file.name)) as SimModel;
  onStage('flags');
  await tick();
  return model;
}

export function releaseSimModel(model: SimModel | null) {
  if (!model) return;
  model.blobUrls?.forEach((u) => URL.revokeObjectURL(u));
  if (model.pdf) {
    try {
      void model.pdf.destroy();
    } catch {
      /* already closed */
    }
  }
}
