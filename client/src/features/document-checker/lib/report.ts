import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import logoUrl from '@/assets/logo.png';
import regularFontUrl from '@/assets/fonts/DejaVuSans.ttf?url';
import boldFontUrl from '@/assets/fonts/DejaVuSans-Bold.ttf?url';
import { countByStatus, scoreBand, STATUS_LABEL, type Report } from './types';

export const DISCLAIMER =
  'Automated testing cannot confirm full conformance with WCAG, Section 508, or PDF/UA. These checks cover machine-detectable properties only; manual review with assistive technology is still necessary.';

const COLORS = {
  ink: '#121721',
  slate: '#3a485b',
  muted: '#566373',
  teal: '#0f766e',
  tealDark: '#0f766e',
  paleTeal: '#edf9f7',
  line: '#dfe3e8',
  critical: '#a52718',
  warning: '#925908',
  passed: '#146b42',
  review: '#404d5f',
  white: '#ffffff',
};

type StructElement = PDFKit.PDFStructureElement;

type SemanticType = 'H1' | 'H2' | 'H3' | 'H4' | 'P';

function safeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function withSeparatingSpace(value: string): string {
  const cleaned = safeText(value);
  return cleaned.endsWith(' ') ? cleaned : `${cleaned} `;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load report asset: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export async function buildReportPdf(report: Report): Promise<Uint8Array> {
  const [regularFont, boldFont, logo] = await Promise.all([
    fetchBytes(regularFontUrl),
    fetchBytes(boldFontUrl),
    fetchBytes(logoUrl).catch(() => null),
  ]);

  const title = 'Remedy508 Document Accessibility Check Results';
  const doc = new PDFDocument({
    autoFirstPage: true,
    size: 'LETTER',
    margins: { top: 52, right: 52, bottom: 58, left: 52 },
    bufferPages: true,
    pdfVersion: '1.7',
    subset: 'PDF/UA',
    tagged: true,
    lang: 'en-US',
    displayTitle: true,
    info: {
      Title: title,
      Author: 'Remedy508',
      Subject: 'Automated document accessibility check results',
      Keywords: 'accessibility, WCAG, Section 508, PDF/UA, document checker',
      Creator: 'Remedy508 Accessibility Checker',
      Producer: 'Remedy508',
      CreationDate: new Date(),
    },
  } as never);

  const accessibleDoc = doc;

  doc.registerFont('ReportBody', regularFont);
  doc.registerFont('ReportBold', boldFont);
  doc.font('ReportBody').fontSize(10).fillColor(COLORS.ink);

  const root = accessibleDoc.struct('Document', {
    title: 'Remedy508 Accessibility Check Report',
    lang: 'en-US',
  });
  accessibleDoc.addStructure(root);

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (height: number) => {
    if (doc.y + height > pageBottom()) doc.addPage();
  };

  const artifact = (draw: () => void, type: 'Layout' | 'Pagination' = 'Layout') => {
    accessibleDoc.markContent('Artifact', { type });
    draw();
    accessibleDoc.endMarkedContent();
  };

  const addText = (
    parent: StructElement,
    type: SemanticType,
    value: string,
    options: {
      font?: 'ReportBody' | 'ReportBold';
      size?: number;
      color?: string;
      gapAfter?: number;
      indent?: number;
      lineGap?: number;
      title?: string;
    } = {},
  ) => {
    const text = withSeparatingSpace(value);
    const font = options.font ?? (type.startsWith('H') ? 'ReportBold' : 'ReportBody');
    const size =
      options.size ??
      ({ H1: 24, H2: 16, H3: 12.5, H4: 10.5, P: 9.5 } satisfies Record<SemanticType, number>)[type];
    const estimatedHeight = size * (type === 'P' ? 2.8 : 2);
    ensureSpace(estimatedHeight);

    const element = accessibleDoc.struct(
      type,
      type.startsWith('H') ? { title: options.title ?? safeText(value) } : undefined,
    );
    parent.add(element);
    const content = accessibleDoc.markStructureContent(type);
    element.add(content);
    doc
      .font(font)
      .fontSize(size)
      .fillColor(options.color ?? (type.startsWith('H') ? COLORS.slate : COLORS.ink))
      .text(text, {
        indent: options.indent ?? 0,
        lineGap: options.lineGap ?? 2,
        paragraphGap: options.gapAfter ?? (type === 'P' ? 7 : 8),
      });
    accessibleDoc.endMarkedContent();
    element.end();
  };

  const addList = (parent: StructElement, items: string[], color = COLORS.ink) => {
    if (!items.length) return;
    ensureSpace(Math.min(80, items.length * 18 + 10));
    const list = accessibleDoc.struct('L');
    parent.add(list);
    doc
      .font('ReportBody')
      .fontSize(9.5)
      .fillColor(color)
      .list(items.map(withSeparatingSpace), {
        structParent: list,
        bulletRadius: 2,
        indent: 14,
        textIndent: 8,
        lineGap: 2,
      } as never);
    list.end();
    doc.moveDown(0.45);
  };

  const addRule = () => {
    artifact(() => {
      doc
        .strokeColor(COLORS.line)
        .lineWidth(0.8)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    });
    doc.moveDown(0.8);
  };

  if (logo) {
    artifact(() => {
      doc.image(logo.buffer, doc.page.margins.left, doc.y, { fit: [165, 42] });
    });
    doc.moveDown(3.2);
  } else {
    addText(root, 'P', 'Remedy508', {
      font: 'ReportBold',
      size: 18,
      color: COLORS.tealDark,
      gapAfter: 14,
    });
  }

  addText(root, 'H1', 'Accessibility Check Report');
  addText(root, 'P', `${report.fileName} | ${report.kind} | ${report.fileSizeLabel}`, {
    color: COLORS.muted,
    gapAfter: 1,
  });
  addText(root, 'P', `Generated ${report.generatedAt}`, {
    size: 8.5,
    color: COLORS.muted,
    gapAfter: 14,
  });

  const scoreSection = accessibleDoc.struct('Sect', { title: 'Automated findings score' });
  root.add(scoreSection);
  artifact(() => {
    const top = doc.y - 6;
    doc
      .roundedRect(doc.page.margins.left, top, doc.page.width - 104, 78, 8)
      .fillAndStroke(COLORS.paleTeal, COLORS.line);
  });
  doc.x = doc.page.margins.left + 16;
  doc.y += 9;
  addText(scoreSection, 'H2', 'Automated Findings Score', { size: 12, gapAfter: 2 });
  addText(
    scoreSection,
    'P',
    `${report.score} out of 100. ${scoreBand(report.score)}. Manual-review items are not deducted. This is not a compliance score.`,
    { font: 'ReportBold', size: 13.5, color: COLORS.tealDark, gapAfter: 12 },
  );
  scoreSection.end();
  doc.x = doc.page.margins.left;
  doc.moveDown(1.1);

  const counts = countByStatus(report.findings);
  addText(root, 'H2', 'Findings at a Glance');
  addList(root, [
    `Critical: ${counts.critical}`,
    `Warnings: ${counts.warning}`,
    `Needs review: ${counts.review}`,
    `Passed: ${counts.passed}`,
  ]);

  addText(root, 'H2', 'Document Properties');
  addList(root, report.facts.map((fact) => `${fact.label}: ${fact.value}`));

  addText(root, 'H2', 'Findings');
  for (const finding of report.findings) {
    ensureSpace(125);
    const findingSection = accessibleDoc.struct('Sect', { title: safeText(finding.title) });
    root.add(findingSection);
    addText(findingSection, 'H3', finding.title);
    addText(
      findingSection,
      'P',
      `${STATUS_LABEL[finding.status]}. ${finding.category}. ${finding.summary}`,
      {
        font: 'ReportBold',
        color: COLORS[finding.status],
        gapAfter: 6,
      },
    );
    addText(findingSection, 'H4', 'Why This Matters', { gapAfter: 3 });
    addText(findingSection, 'P', finding.why);
    addText(findingSection, 'H4', 'Recommended Next Step', { gapAfter: 3 });
    addText(findingSection, 'P', finding.fix);

    if (finding.details?.length) {
      addText(findingSection, 'H4', 'Observations', { gapAfter: 3 });
      addList(findingSection, finding.details);
    }
    if (finding.locations?.length) {
      addText(findingSection, 'H4', 'Locations', { gapAfter: 3 });
      addList(findingSection, finding.locations);
    }
    if (finding.refs?.length) {
      addText(findingSection, 'P', `Related criteria: ${finding.refs.join(' | ')}`, {
        size: 8.5,
        color: COLORS.muted,
      });
    }
    findingSection.end();
    addRule();
  }

  if (report.parseNotes?.length) {
    addText(root, 'H2', 'Scan Notes');
    addList(root, report.parseNotes);
  }

  addText(root, 'H2', 'Important');
  addText(root, 'P', DISCLAIMER, { color: COLORS.muted, gapAfter: 14 });

  const ctaSection = accessibleDoc.struct('Sect', { title: 'Remediation assistance' });
  root.add(ctaSection);
  addText(ctaSection, 'H2', 'Ready for Remediation Assistance?');
  addText(
    ctaSection,
    'P',
    'Get automated document remediation assistance for structure, reading order, alternative text, and form labels with Remedy508.',
  );
  const linkParagraph = accessibleDoc.struct('P');
  ctaSection.add(linkParagraph);
  linkParagraph.add(
    accessibleDoc.struct('Link', { title: 'Visit Remedy508.com' }, () => {
      doc
        .font('ReportBold')
        .fontSize(10.5)
        .fillColor(COLORS.tealDark)
        .text('remedy508.com ', {
          link: 'https://remedy508.com',
          underline: true,
        });
    }),
  );
  linkParagraph.end();
  ctaSection.end();
  root.end();

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    artifact(() => {
      const footerY = doc.page.height - 34;
      doc
        .strokeColor(COLORS.line)
        .lineWidth(0.75)
        .moveTo(doc.page.margins.left, footerY - 8)
        .lineTo(doc.page.width - doc.page.margins.right, footerY - 8)
        .stroke()
        .font('ReportBody')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text('Remedy508 Accessibility Checker', doc.page.margins.left, footerY, {
          lineBreak: false,
        })
        .text(`Page ${index + 1} of ${range.count}`, doc.page.width - 120, footerY, {
          width: 68,
          align: 'right',
          lineBreak: false,
        });
    }, 'Pagination');
  }

  const chunks: Uint8Array[] = [];
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(mergeChunks(chunks)));
    doc.on('error', reject);
  });
  doc.end();
  return completed;
}

export async function downloadReport(report: Report): Promise<void> {
  const bytes = await buildReportPdf(report);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const base = report.fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-');
  anchor.href = url;
  anchor.download = `remedy508-accessibility-check-${base || 'report'}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
