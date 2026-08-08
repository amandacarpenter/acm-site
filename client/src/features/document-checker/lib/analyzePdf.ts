import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Fact, Finding } from './types';
import { isGenericLinkText, isPlaceholderTitle, looksLikeRawUrl, truncate } from './ooxml';
import { inspectPdfTables } from './pdfStructure';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfResult {
  findings: Finding[];
  facts: Fact[];
  parseNotes: string[];
}

const MAX_PAGES_SCANNED = 80;

export async function analyzePdf(file: File, onPage?: (n: number, total: number) => void): Promise<PdfResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  // PDF.js transfers its buffer to the worker, so preserve a separate copy for
  // low-level tag-tree checks.
  const structureData = data.slice();
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      /password/i.test(message)
        ? 'This PDF is password protected, so it cannot be inspected in the browser.'
        : 'This PDF could not be opened. It may be damaged or use an unsupported encryption method.',
    );
  }

  const findings: Finding[] = [];
  const parseNotes: string[] = [];
  const tableStructure = await inspectPdfTables(structureData);
  if (tableStructure.parseError) {
    parseNotes.push('Detailed PDF table attributes could not be read; table findings are limited.');
  }
  const pageCount = pdf.numPages;
  const pagesToScan = Math.min(pageCount, MAX_PAGES_SCANNED);
  if (pageCount > pagesToScan) {
    parseNotes.push(
      `This document has ${pageCount} pages; page-level checks were run on the first ${pagesToScan} pages to keep the scan responsive.`,
    );
  }

  let info: Record<string, unknown> = {};
  try {
    const meta = await pdf.getMetadata();
    info = (meta.info ?? {}) as Record<string, unknown>;
  } catch {
    parseNotes.push('Document metadata could not be read.');
  }

  let marked: boolean | null = null;
  try {
    const markInfo = await pdf.getMarkInfo();
    marked = markInfo ? Boolean(markInfo.Marked) : false;
  } catch {
    marked = null;
  }

  let outlineCount = 0;
  try {
    const outline = await pdf.getOutline();
    outlineCount = outline ? outline.length : 0;
  } catch {
    parseNotes.push('Bookmarks (document outline) could not be read.');
  }

  let permissions: number[] | null = null;
  try {
    permissions = await pdf.getPermissions();
  } catch {
    permissions = null;
  }

  // Page-level pass
  const emptyTextPages: string[] = [];
  const lowTextPages: string[] = [];
  const imageOnlyPages: string[] = [];
  const badLinkTexts: string[] = [];
  const fieldsMissingLabel: string[] = [];
  let totalChars = 0;
  let linkAnnotations = 0;
  let formFields = 0;
  let imageOperators = 0;

  for (let i = 1; i <= pagesToScan; i += 1) {
    onPage?.(i, pagesToScan);
    const page = await pdf.getPage(i);
    const label = `Page ${i}`;

    let text = '';
    const items: { str: string; x: number; y: number; w: number; h: number }[] = [];
    try {
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if ('str' in item) {
          const t = item as { str: string; transform: number[]; width?: number; height?: number };
          text += t.str;
          items.push({
            str: t.str,
            x: t.transform[4],
            y: t.transform[5],
            w: t.width ?? 0,
            h: t.height ?? 0,
          });
        }
      }
    } catch {
      parseNotes.push(`Text extraction failed on page ${i}.`);
    }
    const chars = text.replace(/\s+/g, '').length;
    totalChars += chars;

    let pageHasImage = false;
    try {
      const ops = await page.getOperatorList();
      const paint = new Set([
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintImageMaskXObject,
      ]);
      for (const fn of ops.fnArray) {
        if (paint.has(fn)) {
          pageHasImage = true;
          imageOperators += 1;
        }
      }
    } catch {
      /* operator list is optional */
    }

    if (chars === 0) {
      emptyTextPages.push(label);
      if (pageHasImage) imageOnlyPages.push(label);
    } else if (chars < 40 && pageHasImage) {
      lowTextPages.push(label);
    }

    try {
      const annots = await page.getAnnotations();
      for (const a of annots as Record<string, unknown>[]) {
        const subtype = a.subtype as string | undefined;
        if (subtype === 'Link') {
          linkAnnotations += 1;
          const url = (a.url as string) || '';
          const rect = a.rect as number[] | undefined;
          const alt = ((a.contents as string) || (a.alternativeText as string) || '').trim();
          const under = rect ? textUnderRect(items, rect) : '';
          const visible = under || alt;
          if (!visible) {
            badLinkTexts.push(`${label} · ${truncate(url || 'link with no readable text', 40)}`);
          } else if (isGenericLinkText(visible) || looksLikeRawUrl(visible)) {
            badLinkTexts.push(`${label} · ${truncate(visible, 40)}`);
          }
        }
        if (subtype === 'Widget' && a.fieldType) {
          formFields += 1;
          const tu = ((a.alternativeText as string) || '').trim();
          if (!tu) fieldsMissingLabel.push(`${label} · ${truncate((a.fieldName as string) || 'unnamed field', 32)}`);
        }
      }
    } catch {
      parseNotes.push(`Annotations could not be read on page ${i}.`);
    }
    page.cleanup();
  }

  /* ---------- 1. Tag structure ---------- */
  findings.push({
    id: 'pdf-tags',
    title: 'Tagged PDF structure',
    status: marked === false ? 'critical' : 'review',
    category: 'Structure',
    summary:
      marked === true
        ? 'The document is flagged as tagged. Tag quality and reading order still need a manual check.'
        : marked === false
          ? 'No tag structure marker was found — the PDF appears to be untagged.'
          : 'The tag marker could not be read from this file.',
    why: 'Tags are what turn a PDF into something a screen reader can navigate: headings, lists, tables, and reading order all come from the tag tree. An untagged PDF is read as one undifferentiated block, if at all.',
    fix:
      marked === true
        ? 'Open the tag tree in Acrobat (View → Show/Hide → Navigation Panes → Tags) or a remediation tool and confirm headings, lists, tables, and figures are tagged correctly and in the right order.'
        : 'Re-export the PDF from the source file with “Document structure tags for accessibility” enabled, or add tags with a remediation tool. Exporting by printing to PDF always discards tags.',
    details: [
      'This accessibility check inspects table roles and selected cell attributes in the tag tree. It does not validate the complete PDF/UA specification, visual reading order, or assistive-technology behavior.',
    ],
    refs: ['WCAG 1.3.1 Info and Relationships', 'PDF/UA-1'],
  });

  /* ---------- 2. Reading order ---------- */
  findings.push({
    id: 'pdf-reading-order',
    title: 'Reading order',
    status: 'review',
    category: 'Structure',
    summary: 'Reading order cannot be verified by this automated check.',
    why: 'Multi-column layouts, sidebars, and captions frequently read back in the wrong order even when the file is tagged.',
    fix: 'Read the document with a screen reader, or use the reading-order tool in a PDF editor, and confirm the sequence matches the visual layout.',
    refs: ['WCAG 1.3.2 Meaningful Sequence'],
  });

  /* ---------- 3. Table structure ---------- */
  const malformedTableStructure =
    tableStructure.nestedCellCount > 0 ||
    tableStructure.invalidChildCount > 0 ||
    tableStructure.emptyTableCount > 0;
  findings.push({
    id: 'pdf-table-structure',
    title: 'Basic table nesting',
    status:
      tableStructure.parseError || tableStructure.tableCount === 0
        ? 'review'
        : malformedTableStructure
          ? 'critical'
          : 'passed',
    category: 'Tables',
    summary: tableStructure.parseError
      ? 'Detailed table structure could not be parsed from this PDF.'
      : tableStructure.tableCount === 0
        ? 'No tagged table structures were detected. Confirm visually that the document contains no data tables.'
        : malformedTableStructure
          ? `${tableStructure.tableCount} tables were detected, with ${tableStructure.nestedCellCount} nested cells, ${tableStructure.invalidChildCount} invalid child roles, and ${tableStructure.emptyTableCount} empty table structures.`
          : `${tableStructure.tableCount} tagged tables use valid basic nesting for ${tableStructure.rowCount} rows and ${tableStructure.headerCellCount + tableStructure.dataCellCount} cells.`,
    why: 'Screen readers rely on Table, TR, TH, and TD tags being nested correctly. This check only evaluates containment; it does not prove that header cells exist or that headers are associated correctly.',
    fix:
      malformedTableStructure
        ? 'Open the Tags pane in Acrobat or a remediation tool. Ensure each Table contains row groups or TR rows, each TR contains only TH or TD cells, and no TH or TD is nested inside another cell. Remove empty table tags.'
        : tableStructure.tableCount === 0
          ? 'If the document contains visual data tables, tag each one as Table → TR → TH/TD. If there are no data tables, no action is needed.'
          : 'No basic nesting errors were detected. Review the separate header-association and grid-regularity findings before treating the tables as accessible.',
    details: [
      `Tables: ${tableStructure.tableCount}; rows: ${tableStructure.rowCount}; header cells: ${tableStructure.headerCellCount}; data cells: ${tableStructure.dataCellCount}.`,
      `Nested cells: ${tableStructure.nestedCellCount}; invalid children: ${tableStructure.invalidChildCount}; empty table structures: ${tableStructure.emptyTableCount}.`,
      'A pass here does not confirm header cells, Scope or Headers associations, reading order, or table-grid regularity.',
    ],
    refs: ['WCAG 1.3.1 Info and Relationships', 'PDF/UA-1'],
  });

  /* ---------- 4. Table headers ---------- */
  const missingHeaders =
    tableStructure.tableCount > 0 &&
    (tableStructure.headerCellCount === 0 ||
      tableStructure.missingHeaderAssociationCount > 0 ||
      tableStructure.invalidScopeCount > 0);
  findings.push({
    id: 'pdf-table-headers',
    title: 'Table header associations',
    status: tableStructure.parseError
      ? 'review'
      : tableStructure.tableCount === 0
        ? 'review'
        : missingHeaders
          ? 'critical'
          : 'review',
    category: 'Tables',
    summary: tableStructure.parseError
      ? 'Header-cell attributes could not be read from this PDF.'
      : tableStructure.tableCount === 0
        ? 'No tagged tables were detected, so no header associations were evaluated.'
        : tableStructure.headerCellCount === 0
          ? `${tableStructure.tableCount} tables were detected, but none contain TH header cells.`
          : tableStructure.missingHeaderAssociationCount > 0 || tableStructure.invalidScopeCount > 0
            ? `${tableStructure.missingHeaderAssociationCount} of ${tableStructure.headerCellCount} header cells have no valid Scope or Headers association.`
            : `${tableStructure.headerCellCount} header cells include explicit Scope or Headers attributes; complex tables still need manual verification.`,
    why: 'Without row or column header associations, a screen reader user cannot tell which heading applies to a data cell when navigating a table.',
    fix:
      missingHeaders
        ? 'In Acrobat’s Table Editor or a remediation tool, mark header cells as TH and assign Scope = Row or Column for simple tables. For merged or multi-level headers, give headers unique IDs and associate data cells with the appropriate Headers entries.'
        : tableStructure.tableCount === 0
          ? 'No action needed unless the document visually contains tables.'
          : 'Verify merged cells and multi-level headers manually. Simple tables should use TH cells with Row or Column scope; complex tables should use explicit ID/Headers associations.',
    details: [
      `Row scope: ${tableStructure.rowScopeCount}; column scope: ${tableStructure.columnScopeCount}; both scope: ${tableStructure.bothScopeCount}; invalid scope: ${tableStructure.invalidScopeCount}.`,
      `Header cells using Headers: ${tableStructure.headerCellsWithHeaders}; data cells using Headers: ${tableStructure.dataCellsWithHeaders}.`,
    ],
    refs: ['WCAG 1.3.1 Info and Relationships', 'PDF/UA-1'],
  });

  /* ---------- 5. Table regularity ---------- */
  findings.push({
    id: 'pdf-table-regularity',
    title: 'Table grid regularity',
    status: 'review',
    category: 'Tables',
    summary:
      tableStructure.tableCount === 0
        ? 'No tagged tables were detected, so table-grid regularity was not evaluated.'
        : `Column consistency, merged cells, RowSpan, and ColSpan were not fully evaluated for the ${tableStructure.tableCount} tagged tables.`,
    why: 'A table can have correctly nested tags but still expose an irregular or misleading row-and-column grid to assistive technology.',
    fix:
      tableStructure.tableCount === 0
        ? 'If the document visually contains tables, tag them before evaluating their row-and-column grid.'
        : 'Use Acrobat’s Table Editor or another PDF accessibility tool to verify that each row resolves to the expected number of columns and that merged cells use accurate RowSpan and ColSpan values.',
    details: ['Not evaluated by this browser-based checker. This result is not equivalent to Acrobat’s Table Regularity check.'],
    refs: ['WCAG 1.3.1 Info and Relationships', 'PDF/UA-1'],
  });

  /* ---------- 6. Extractable text ---------- */
  const scannedLikely = imageOnlyPages.length > 0 && imageOnlyPages.length >= pagesToScan * 0.5;
  findings.push({
    id: 'pdf-text-layer',
    title: 'Selectable text layer',
    status: totalChars === 0 ? 'critical' : scannedLikely ? 'critical' : emptyTextPages.length > 0 ? 'warning' : 'passed',
    category: 'Text',
    summary:
      totalChars === 0
        ? 'No selectable text was found — this document is almost certainly a scan or an image export.'
        : scannedLikely
          ? `${imageOnlyPages.length} of ${pagesToScan} scanned pages contain images but no text.`
          : emptyTextPages.length > 0
            ? `${emptyTextPages.length} of ${pagesToScan} scanned pages contain no extractable text.`
            : `Selectable text was extracted from all ${pagesToScan} scanned pages (${totalChars.toLocaleString()} characters).`,
    why: 'If the words are pixels rather than characters, screen readers, braille displays, search, and text reflow all fail completely.',
    fix:
      totalChars === 0 || emptyTextPages.length > 0
        ? 'Run OCR on the document, then proofread the recognised text — OCR output frequently needs correction. Where possible, re-export from the original source file instead of scanning.'
        : 'No action needed.',
    locations: emptyTextPages.slice(0, 14),
    details: [`Image drawing operations observed: ${imageOperators}.`],
    refs: ['WCAG 1.1.1 Non-text Content', 'WCAG 1.4.5 Images of Text'],
  });

  /* ---------- 6. Title metadata ---------- */
  const title = typeof info.Title === 'string' ? info.Title.trim() : '';
  const weakTitle = title !== '' && isPlaceholderTitle(title);
  findings.push({
    id: 'pdf-title',
    title: 'Document title in metadata',
    status: title && !weakTitle ? 'passed' : 'warning',
    category: 'Metadata',
    summary: weakTitle
      ? `The title “${truncate(title, 50)}” looks like an export placeholder rather than a real title.`
      : title
        ? `A title is set: “${truncate(title, 70)}”.`
        : 'No document title is set in the PDF metadata.',
    why: 'Assistive technology and browser tabs announce the title. Without it, users hear the file name, which is often a string of numbers.',
    fix:
      title && !weakTitle
        ? 'Confirm the viewer is set to display the document title rather than the file name (Acrobat: File → Properties → Initial View → Show: Document Title).'
        : 'Set a descriptive title in the source document properties before exporting, or add it in a PDF editor under File → Properties → Description. Set the Initial View to show the document title.',
    refs: ['WCAG 2.4.2 Page Titled'],
  });

  /* ---------- 7. Language ---------- */
  const lang = typeof info.Language === 'string' ? info.Language.trim() : '';
  findings.push({
    id: 'pdf-language',
    title: 'Document language',
    status: lang ? 'passed' : 'warning',
    category: 'Language',
    summary: lang ? `Language is declared as “${lang}”.` : 'No document language is declared in the catalog.',
    why: 'The declared language tells a screen reader which pronunciation rules and voice to use for the whole document.',
    fix: lang
      ? 'No action needed. Mark any passages in another language individually.'
      : 'Set the document language in a PDF editor (Acrobat: File → Properties → Advanced → Reading Options → Language), or set it in the source file before export.',
    refs: ['WCAG 3.1.1 Language of Page'],
  });

  /* ---------- 8. Links ---------- */
  findings.push({
    id: 'pdf-links',
    title: 'Link annotations have readable text',
    status: linkAnnotations === 0 ? 'passed' : badLinkTexts.length > 0 ? 'warning' : 'passed',
    category: 'Links',
    summary:
      linkAnnotations === 0
        ? 'No link annotations were found in the scanned pages.'
        : badLinkTexts.length > 0
          ? `${badLinkTexts.length} of ${linkAnnotations} links have generic, missing, or raw-URL text.`
          : `All ${linkAnnotations} link annotation${linkAnnotations === 1 ? ' sits' : 's sit'} on readable text.`,
    why: 'A link announced as “https://example.com/x?id=8842…” or “click here” gives no clue where it goes when links are read out of context.',
    fix:
      badLinkTexts.length > 0
        ? 'Give each link meaningful visible text, and add an alternate description to the link annotation where the visible text cannot change.'
        : 'No action needed.',
    locations: badLinkTexts.slice(0, 12),
    details: ['Link text is inferred from text near the annotation rectangle, so treat these results as indicative.'],
    refs: ['WCAG 2.4.4 Link Purpose (In Context)'],
  });

  /* ---------- 9. Form fields ---------- */
  findings.push({
    id: 'pdf-forms',
    title: 'Form fields have accessible labels',
    status: formFields === 0 ? 'passed' : fieldsMissingLabel.length > 0 ? 'critical' : 'review',
    category: 'Forms',
    summary:
      formFields === 0
        ? 'No interactive form fields were found in the scanned pages.'
        : fieldsMissingLabel.length > 0
          ? `${fieldsMissingLabel.length} of ${formFields} form fields have no tooltip description.`
          : `All ${formFields} form field${formFields === 1 ? ' has' : 's have'} a tooltip. Label wording still needs a manual check.`,
    why: 'A form field without a description is announced only as “edit text”, so the person filling it in has no idea what to type.',
    fix:
      formFields === 0
        ? 'No action needed.'
        : 'In Acrobat, open Prepare Form, then set the Tooltip for each field to the visible label text. Check the tab order matches the visual order.',
    locations: fieldsMissingLabel.slice(0, 12),
    refs: ['WCAG 1.3.1 Info and Relationships', 'WCAG 3.3.2 Labels or Instructions'],
  });

  /* ---------- 10. Bookmarks ---------- */
  findings.push({
    id: 'pdf-bookmarks',
    title: 'Bookmarks for long documents',
    status: pageCount >= 20 && outlineCount === 0 ? 'warning' : 'passed',
    category: 'Navigation',
    summary:
      outlineCount > 0
        ? `${outlineCount} top-level bookmark${outlineCount === 1 ? '' : 's'} found.`
        : pageCount >= 20
          ? `No bookmarks were found in a ${pageCount}-page document.`
          : 'No bookmarks found; this document is short enough that bookmarks are optional.',
    why: 'Bookmarks give keyboard and screen reader users a way to jump between sections without paging through the whole file.',
    fix:
      pageCount >= 20 && outlineCount === 0
        ? 'Generate bookmarks from the source document’s headings on export, or add them in a PDF editor.'
        : 'No action needed.',
    refs: ['WCAG 2.4.5 Multiple Ways'],
  });

  /* ---------- 11. Permissions ---------- */
  const copyBlocked =
    permissions !== null && !permissions.includes(pdfjsLib.PermissionFlag.COPY) &&
    !permissions.includes(pdfjsLib.PermissionFlag.COPY_FOR_ACCESSIBILITY);
  findings.push({
    id: 'pdf-permissions',
    title: 'Security settings allow assistive technology',
    status: copyBlocked ? 'critical' : permissions === null ? 'passed' : 'passed',
    category: 'Security',
    summary: copyBlocked
      ? 'Content extraction is restricted, which can block screen readers.'
      : permissions === null
        ? 'No permission restrictions were detected.'
        : 'Content extraction for accessibility is permitted.',
    why: 'Some PDF security settings prevent text extraction outright, which stops assistive technology from reading the document.',
    fix: copyBlocked
      ? 'Re-save the document with content copying for accessibility enabled, or remove the restriction entirely.'
      : 'No action needed.',
    refs: ['WCAG 1.3.1 Info and Relationships'],
  });

  /* ---------- 12. Headings / semantics ---------- */
  findings.push({
    id: 'pdf-headings',
    title: 'Heading structure',
    status: 'review',
    category: 'Structure',
    summary: 'Heading levels cannot be read reliably from the browser.',
    why: 'Headings in a PDF live in the tag tree. Visually large, bold text is not a heading unless it is tagged as one.',
    fix: 'Check the tag tree for H1–H6 tags in a logical order, or re-export from a source document that uses real heading styles.',
    refs: ['WCAG 1.3.1 Info and Relationships', 'WCAG 2.4.6 Headings and Labels'],
  });

  /* ---------- 13. Contrast ---------- */
  findings.push({
    id: 'pdf-contrast',
    title: 'Colour contrast and use of colour',
    status: 'review',
    category: 'Visual design',
    summary: 'Contrast ratios are not measured by this automated check.',
    why: 'Low-contrast body text and colour-coded tables exclude people with low vision or colour vision deficiency.',
    fix: 'Sample the text and background colours and confirm 4.5:1 for body text, 3:1 for large text. Add a second cue anywhere colour carries meaning.',
    refs: ['WCAG 1.4.3 Contrast (Minimum)', 'WCAG 1.4.1 Use of Color'],
  });

  const facts: Fact[] = [
    { label: 'Format', value: 'Portable Document Format (.pdf)' },
    { label: 'Pages', value: String(pageCount) },
    { label: 'Pages scanned', value: String(pagesToScan) },
    { label: 'Tag marker', value: marked === true ? 'Present' : marked === false ? 'Absent' : 'Unknown' },
    { label: 'Tables', value: String(tableStructure.tableCount) },
    { label: 'Table rows', value: String(tableStructure.rowCount) },
    { label: 'Header cells', value: String(tableStructure.headerCellCount) },
    { label: 'Data cells', value: String(tableStructure.dataCellCount) },
    { label: 'Characters', value: totalChars.toLocaleString() },
    { label: 'Links', value: String(linkAnnotations) },
    { label: 'Form fields', value: String(formFields) },
    { label: 'Bookmarks', value: String(outlineCount) },
  ];
  if (typeof info.Producer === 'string' && info.Producer.trim()) {
    facts.push({ label: 'Producer', value: truncate(info.Producer.trim(), 34) });
  }
  if (lowTextPages.length > 0) {
    parseNotes.push(`Pages with very little text but visible images: ${lowTextPages.slice(0, 8).join(', ')}.`);
  }

  await pdf.destroy();
  return { findings, facts, parseNotes };
}

/** Rough association of text items with a link rectangle. */
function textUnderRect(
  items: { str: string; x: number; y: number; w: number; h: number }[],
  rect: number[],
): string {
  const [x1, y1, x2, y2] = [
    Math.min(rect[0], rect[2]),
    Math.min(rect[1], rect[3]),
    Math.max(rect[0], rect[2]),
    Math.max(rect[1], rect[3]),
  ];
  const pad = 3;
  return items
    .filter((it) => {
      if (!it.str.trim()) return false;
      const insideY = it.y >= y1 - pad && it.y <= y2 + pad;
      const startsInside = it.x >= x1 - pad && it.x <= x2 + pad;
      // An item that runs far past the annotation is body text the link merely overlaps.
      const endsInside = it.w > 0 ? it.x + it.w <= x2 + pad + 4 : true;
      return insideY && startsInside && endsInside;
    })
    .map((it) => it.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
