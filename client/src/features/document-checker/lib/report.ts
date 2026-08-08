import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import logoUrl from '@/assets/logo.png';
import { countByStatus, scoreBand, STATUS_LABEL, type Report } from './types';

export const DISCLAIMER =
  'Automated testing cannot confirm full conformance with WCAG, Section 508, or PDF/UA. These checks cover machine-detectable properties only; manual review with assistive technology is still necessary.';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = 55;

const COLORS = {
  ink: rgb(0.07, 0.09, 0.13),
  slate: rgb(0.23, 0.28, 0.36),
  muted: rgb(0.34, 0.39, 0.46),
  teal: rgb(0.05, 0.58, 0.53),
  tealDark: rgb(0.06, 0.46, 0.43),
  paleTeal: rgb(0.93, 0.98, 0.97),
  paleGray: rgb(0.96, 0.97, 0.98),
  line: rgb(0.87, 0.89, 0.91),
  white: rgb(1, 1, 1),
  critical: rgb(0.71, 0.14, 0.09),
  warning: rgb(0.58, 0.35, 0.04),
  passed: rgb(0.08, 0.42, 0.26),
  review: rgb(0.25, 0.3, 0.37),
};

function safeText(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/•/g, '-')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = safeText(text).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }

  return lines;
}

export async function buildReportPdf(report: Report): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Remedy508 Accessibility Check Report - ${safeText(report.fileName)}`);
  pdf.setAuthor('Remedy508');
  pdf.setSubject('Automated document accessibility check results');
  pdf.setKeywords(['accessibility', 'WCAG', 'Section 508', 'document checker']);
  pdf.setCreator('Remedy508 Accessibility Checker');
  pdf.setProducer('Remedy508');
  pdf.setCreationDate(new Date());

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (height: number) => {
    if (y - height < FOOTER_TOP + 20) addPage();
  };

  const drawLines = (
    value: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      indent?: number;
      lineHeight?: number;
      gapAfter?: number;
    } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const color = options.color ?? COLORS.ink;
    const indent = options.indent ?? 0;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;
    const lineHeight = options.lineHeight ?? size * 1.4;
    const lines = wrapText(value, font, size, maxWidth);

    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 0;
  };

  const drawHeading = (value: string, size = 17) => {
    ensureSpace(size + 18);
    drawLines(value, { font: bold, size, color: COLORS.slate, lineHeight: size * 1.2, gapAfter: 8 });
  };

  const drawLabel = (value: string) => {
    drawLines(value.toUpperCase(), {
      font: bold,
      size: 8,
      color: COLORS.muted,
      lineHeight: 10,
      gapAfter: 2,
    });
  };

  try {
    const logoBytes = await fetch(logoUrl).then((response) => response.arrayBuffer());
    const logo = await pdf.embedPng(logoBytes);
    const scaled = logo.scale(0.42);
    const width = Math.min(175, scaled.width);
    const height = (scaled.height / scaled.width) * width;
    page.drawImage(logo, { x: MARGIN, y: y - height, width, height });
    y -= height + 24;
  } catch {
    drawLines('Remedy508', { font: bold, size: 22, color: COLORS.tealDark, gapAfter: 18 });
  }

  drawLines('Accessibility Check Report', {
    font: bold,
    size: 25,
    color: COLORS.slate,
    lineHeight: 30,
    gapAfter: 6,
  });
  drawLines(`${report.fileName} | ${report.kind} | ${report.fileSizeLabel}`, {
    size: 10,
    color: COLORS.muted,
    gapAfter: 2,
  });
  drawLines(`Generated ${report.generatedAt}`, { size: 9, color: COLORS.muted, gapAfter: 18 });

  ensureSpace(102);
  page.drawRectangle({
    x: MARGIN,
    y: y - 92,
    width: CONTENT_WIDTH,
    height: 92,
    color: COLORS.paleTeal,
    borderColor: COLORS.line,
    borderWidth: 1,
  });
  const scoreText = String(report.score);
  const scoreX = MARGIN + 18;
  const scoreWidth = bold.widthOfTextAtSize(scoreText, 36);
  page.drawText(scoreText, {
    x: scoreX,
    y: y - 52,
    size: 36,
    font: bold,
    color: COLORS.tealDark,
  });
  page.drawText('/100', {
    x: scoreX + scoreWidth + 5,
    y: y - 50,
    size: 12,
    font: bold,
    color: COLORS.muted,
  });
  page.drawText('AUTOMATED FINDINGS SCORE', {
    x: MARGIN + 118,
    y: y - 28,
    size: 9,
    font: bold,
    color: COLORS.slate,
  });
  const scoreSummary = wrapText(
    `${scoreBand(report.score)}. Manual-review items are not deducted. This is not a compliance score.`,
    regular,
    10,
    CONTENT_WIDTH - 145,
  );
  scoreSummary.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN + 118,
      y: y - 48 - index * 14,
      size: 10,
      font: regular,
      color: COLORS.muted,
    });
  });
  y -= 112;

  const counts = countByStatus(report.findings);
  drawHeading('Findings at a glance');
  const countItems = [
    ['Critical', counts.critical, COLORS.critical],
    ['Warning', counts.warning, COLORS.warning],
    ['Needs review', counts.review, COLORS.review],
    ['Passed', counts.passed, COLORS.passed],
  ] as const;
  const cellWidth = CONTENT_WIDTH / countItems.length;
  ensureSpace(58);
  countItems.forEach(([label, value, color], index) => {
    const x = MARGIN + cellWidth * index;
    page.drawRectangle({
      x,
      y: y - 50,
      width: cellWidth,
      height: 50,
      color: COLORS.white,
      borderColor: COLORS.line,
      borderWidth: 1,
    });
    page.drawText(String(value), { x: x + 12, y: y - 24, size: 17, font: bold, color });
    page.drawText(label, { x: x + 12, y: y - 40, size: 8.5, font: bold, color: COLORS.muted });
  });
  y -= 72;

  drawHeading('Document properties');
  for (const fact of report.facts) {
    ensureSpace(32);
    drawLabel(fact.label);
    drawLines(fact.value, { size: 10.5, gapAfter: 8 });
  }

  drawHeading('Findings');
  for (const finding of report.findings) {
    ensureSpace(90);
    const accent = COLORS[finding.status];
    page.drawRectangle({
      x: MARGIN,
      y: y - 3,
      width: 4,
      height: 20,
      color: accent,
    });
    drawLines(finding.title, {
      font: bold,
      size: 13,
      color: COLORS.slate,
      indent: 12,
      maxWidth: CONTENT_WIDTH - 118,
      lineHeight: 16,
    });
    drawLines(STATUS_LABEL[finding.status], {
      font: bold,
      size: 8,
      color: accent,
      indent: 12,
      lineHeight: 10,
      gapAfter: 3,
    });
    drawLines(finding.category, { size: 8.5, color: COLORS.muted, indent: 12, gapAfter: 5 });
    drawLines(finding.summary, { font: bold, size: 10.5, indent: 12, gapAfter: 7 });

    drawLabel('Why this matters');
    drawLines(finding.why, { size: 9.5, gapAfter: 7 });
    drawLabel('How to fix it');
    drawLines(finding.fix, { size: 9.5, gapAfter: 7 });

    if (finding.details?.length) {
      drawLabel('Observations');
      for (const detail of finding.details) {
        drawLines(`- ${detail}`, { size: 9, indent: 8, gapAfter: 2 });
      }
      y -= 4;
    }
    if (finding.locations?.length) {
      drawLabel('Where');
      for (const location of finding.locations) {
        drawLines(`- ${location}`, { size: 9, indent: 8, gapAfter: 2 });
      }
      y -= 4;
    }
    if (finding.refs?.length) {
      drawLines(`Related criteria: ${finding.refs.join(' | ')}`, {
        size: 8.5,
        color: COLORS.muted,
        gapAfter: 6,
      });
    }

    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.75,
      color: COLORS.line,
    });
    y -= 16;
  }

  if (report.parseNotes?.length) {
    drawHeading('Scan notes');
    for (const note of report.parseNotes) {
      drawLines(`- ${note}`, { size: 9.5, indent: 8, gapAfter: 3 });
    }
    y -= 6;
  }

  drawHeading('Important');
  drawLines(DISCLAIMER, { size: 9.5, color: COLORS.muted, gapAfter: 16 });

  ensureSpace(78);
  page.drawRectangle({
    x: MARGIN,
    y: y - 64,
    width: CONTENT_WIDTH,
    height: 64,
    color: COLORS.paleTeal,
    borderColor: COLORS.teal,
    borderWidth: 1,
  });
  page.drawText('Get automated document remediation assistance with Remedy508.', {
    x: MARGIN + 16,
    y: y - 27,
    size: 10.5,
    font: bold,
    color: COLORS.slate,
  });
  page.drawText('remedy508.com', {
    x: MARGIN + 16,
    y: y - 47,
    size: 11,
    font: bold,
    color: COLORS.tealDark,
  });

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: MARGIN, y: 38 },
      end: { x: PAGE_WIDTH - MARGIN, y: 38 },
      thickness: 0.75,
      color: COLORS.line,
    });
    currentPage.drawText('Remedy508 Accessibility Checker', {
      x: MARGIN,
      y: 22,
      size: 8,
      font: regular,
      color: COLORS.muted,
    });
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    currentPage.drawText(pageNumber, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageNumber, 8),
      y: 22,
      size: 8,
      font: regular,
      color: COLORS.muted,
    });
  });

  return pdf.save();
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
