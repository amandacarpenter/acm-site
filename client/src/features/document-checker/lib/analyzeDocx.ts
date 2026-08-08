import type { Fact, Finding } from './types';
import {
  attrLocal,
  coreLanguage,
  coreTitle,
  isGenericLinkText,
  isPlaceholderTitle,
  isWeakAltText,
  localTags,
  looksLikeRawUrl,
  openZip,
  readXml,
  textOf,
  truncate,
} from './ooxml';

interface DocxResult {
  findings: Finding[];
  facts: Fact[];
  parseNotes: string[];
}

export async function analyzeDocx(file: File): Promise<DocxResult> {
  const zip = await openZip(file);
  const doc = await readXml(zip, 'word/document.xml');
  if (!doc) {
    throw new Error(
      'This file could not be read as a Word (.docx) package. It may be an older .doc file, password protected, or damaged.',
    );
  }
  const core = await readXml(zip, 'docProps/core.xml');
  const app = await readXml(zip, 'docProps/app.xml');
  const styles = await readXml(zip, 'word/styles.xml');
  const settings = await readXml(zip, 'word/settings.xml');

  const findings: Finding[] = [];
  const parseNotes: string[] = [];

  const paragraphs = localTags(doc, 'p');
  const paraText = paragraphs.map((p) => textOf(p));
  const bodyText = paraText.join('\n').trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  /* ---------- 1. Document title metadata ---------- */
  const rawTitle = coreTitle(core);
  const title = rawTitle && !isPlaceholderTitle(rawTitle) ? rawTitle : null;
  findings.push(
    title
      ? {
          id: 'docx-title',
          title: 'Document title in file properties',
          status: 'passed',
          category: 'Metadata',
          summary: `A title is set: “${truncate(title, 70)}”.`,
          why: 'Screen readers and document managers announce the title property. Without it, people hear the file name instead, which is often meaningless.',
          fix: 'No action needed. Keep the title in sync with the visible heading if the document is edited.',
          refs: ['WCAG 2.4.2 Page Titled'],
        }
      : {
          id: 'docx-title',
          title: 'Document title in file properties',
          status: 'warning',
          category: 'Metadata',
          summary: rawTitle
            ? `The title “${truncate(rawTitle, 50)}” looks like a placeholder rather than a real title.`
            : 'No title is set in the document properties.',
          why: 'The title property is what assistive technology announces when the document opens, and it carries over when the file is exported to PDF.',
          fix: 'In Word, go to File → Info → Properties and add a descriptive Title. Match it to the document’s main heading.',
          refs: ['WCAG 2.4.2 Page Titled'],
        },
  );

  /* ---------- 2. Language ---------- */
  const langVals = new Set<string>();
  for (const source of [styles, settings, doc]) {
    if (!source) continue;
    for (const el of localTags(source, 'lang')) {
      const v = attrLocal(el, 'val') || attrLocal(el, 'bidi') || attrLocal(el, 'eastAsia');
      if (v) langVals.add(v);
    }
    for (const el of localTags(source, 'themeFontLang')) {
      const v = attrLocal(el, 'val');
      if (v) langVals.add(v);
    }
  }
  const coreLang = coreLanguage(core);
  if (coreLang) langVals.add(coreLang);
  const langs = Array.from(langVals);
  findings.push(
    langs.length > 0
      ? {
          id: 'docx-language',
          title: 'Document language is declared',
          status: 'passed',
          category: 'Language',
          summary: `Language metadata found: ${langs.join(', ')}.`,
          why: 'Screen readers switch pronunciation rules based on the declared language. An undeclared or wrong language makes speech output hard to follow.',
          fix: 'No action needed. If parts of the document are in another language, mark those passages separately in Word (Review → Language).',
          refs: ['WCAG 3.1.1 Language of Page'],
          details:
            langs.length > 1
              ? [`More than one language value is present, which is expected in multilingual documents.`]
              : undefined,
        }
      : {
          id: 'docx-language',
          title: 'Document language is declared',
          status: 'warning',
          category: 'Language',
          summary: 'No language metadata was detected in this package.',
          why: 'Without a declared language, screen readers fall back to the user’s default voice, which can render the text unintelligible.',
          fix: 'In Word, select all content, then Review → Language → Set Proofing Language and confirm the correct language. Re-save the file.',
          refs: ['WCAG 3.1.1 Language of Page'],
        },
  );

  /* ---------- 3. Headings ---------- */
  const headingLevels: number[] = [];
  for (const p of paragraphs) {
    const style = localTags(p, 'pStyle')[0];
    const val = style ? attrLocal(style, 'val') : null;
    if (!val) continue;
    const m = /^heading\s*([1-9])$/i.exec(val.replace(/([a-z])([0-9])/i, '$1 $2'));
    if (m) headingLevels.push(Number(m[1]));
  }
  const hasHeadings = headingLevels.length > 0;
  if (!hasHeadings) {
    findings.push({
      id: 'docx-headings',
      title: 'Real heading styles are used',
      status: wordCount > 150 ? 'critical' : 'warning',
      category: 'Structure',
      summary: 'No paragraphs use built-in Heading styles.',
      why: 'Screen reader users navigate long documents by jumping between headings. Text that only looks like a heading (bold, larger font) is invisible to that navigation.',
      fix: 'Apply Word’s built-in Heading 1–3 styles to your section titles instead of manual bold or font-size changes. Start with a single Heading 1 for the document title.',
      refs: ['WCAG 1.3.1 Info and Relationships', 'WCAG 2.4.6 Headings and Labels'],
      details: [`Body text detected: about ${wordCount} words across ${paragraphs.length} paragraphs.`],
    });
  } else {
    const skips: string[] = [];
    let prev = 0;
    headingLevels.forEach((lvl, i) => {
      if (prev && lvl > prev + 1) skips.push(`Heading ${prev} → Heading ${lvl} (heading #${i + 1})`);
      prev = lvl;
    });
    const startsAtOne = headingLevels[0] === 1;
    findings.push({
      id: 'docx-headings',
      title: 'Real heading styles are used',
      status: skips.length > 0 || !startsAtOne ? 'warning' : 'passed',
      category: 'Structure',
      summary:
        skips.length > 0 || !startsAtOne
          ? `${headingLevels.length} headings found, but the outline has gaps.`
          : `${headingLevels.length} headings found with a consistent outline.`,
      why: 'A predictable heading outline lets assistive technology users build a mental model of the document and skip to the section they need.',
      fix:
        skips.length > 0 || !startsAtOne
          ? 'Start the document with Heading 1 and avoid skipping levels — a Heading 3 should follow a Heading 2, not a Heading 1.'
          : 'No action needed. Keep using built-in heading styles as the document grows.',
      details: [
        `Levels in document order: ${headingLevels.join(', ')}.`,
        ...(startsAtOne ? [] : ['The first heading is not a Heading 1.']),
        ...skips.map((s) => `Skipped level: ${s}.`),
      ],
      refs: ['WCAG 1.3.1 Info and Relationships'],
    });
  }

  /* ---------- 4. Image alternative text ---------- */
  const docPr = localTags(doc, 'docPr');
  const vmlShapes = localTags(doc, 'shape').filter((s) => localTags(s, 'imagedata').length > 0);
  const imageCount = docPr.length + vmlShapes.length;
  const missingAlt: string[] = [];
  const decorative: string[] = [];
  docPr.forEach((el, i) => {
    const descr = (attrLocal(el, 'descr') || '').trim();
    const t = (attrLocal(el, 'title') || '').trim();
    const name = attrLocal(el, 'name') || `Image ${i + 1}`;
    if (!descr && !t) missingAlt.push(name);
    else if (isWeakAltText(descr || t)) decorative.push(`${name} — “${truncate(descr || t, 32)}”`);
  });
  vmlShapes.forEach((el, i) => {
    const alt = (el.getAttribute('alt') || '').trim();
    if (!alt) missingAlt.push(`Legacy shape ${i + 1}`);
  });
  if (imageCount === 0) {
    findings.push({
      id: 'docx-alt-text',
      title: 'Images have alternative text',
      status: 'passed',
      category: 'Alternative text',
      summary: 'No inline images or shapes were found in the document body.',
      why: 'Every meaningful image needs a text alternative so that people who cannot see it still receive the information.',
      fix: 'No action needed. If you add images later, right-click → View Alt Text and describe the purpose of the image.',
      refs: ['WCAG 1.1.1 Non-text Content'],
    });
  } else {
    findings.push({
      id: 'docx-alt-text',
      title: 'Images have alternative text',
      status: missingAlt.length > 0 ? 'critical' : decorative.length > 0 ? 'warning' : 'passed',
      category: 'Alternative text',
      summary:
        missingAlt.length > 0
          ? `${missingAlt.length} of ${imageCount} image${imageCount === 1 ? '' : 's'} or shapes have no alt text.`
          : decorative.length > 0
            ? `All ${imageCount} image${imageCount === 1 ? '' : 's'} have alt text, but some descriptions look like placeholders.`
            : `All ${imageCount} image${imageCount === 1 ? '' : 's'} or shape${imageCount === 1 ? '' : 's'} carr${imageCount === 1 ? 'ies' : 'y'} a text description.`,
      why: 'Assistive technology reads the alt text in place of the image. Missing or placeholder text such as “image1” leaves the reader with no information.',
      fix:
        missingAlt.length > 0 || decorative.length > 0
          ? 'In Word, right-click each image → View Alt Text and write a short description of what the image conveys. Mark purely decorative images as decorative so they are skipped.'
          : 'No action needed. Review the descriptions occasionally to make sure they still match the content.',
      locations: [...missingAlt, ...decorative].slice(0, 12),
      details: [
        `Images and shapes detected: ${imageCount}.`,
        ...(decorative.length > 0
          ? [`Descriptions that look auto-generated: ${decorative.slice(0, 6).join(', ')}.`]
          : []),
        'Alt text quality (is the description accurate and useful?) still needs a human check.',
      ],
      refs: ['WCAG 1.1.1 Non-text Content'],
    });
  }

  /* ---------- 5. Link text ---------- */
  const links = localTags(doc, 'hyperlink');
  const badLinks: string[] = [];
  links.forEach((l) => {
    const t = textOf(l);
    if (!t) badLinks.push('(empty link text)');
    else if (isGenericLinkText(t) || looksLikeRawUrl(t)) badLinks.push(truncate(t, 48));
  });
  findings.push({
    id: 'docx-links',
    title: 'Link text is descriptive',
    status: links.length === 0 ? 'passed' : badLinks.length > 0 ? 'warning' : 'passed',
    category: 'Links',
    summary:
      links.length === 0
        ? 'No hyperlinks were found in the document body.'
        : badLinks.length > 0
          ? `${badLinks.length} of ${links.length} links use generic text or a bare URL.`
          : `All ${links.length} link${links.length === 1 ? '' : 's'} use descriptive text.`,
    why: 'Screen reader users often pull up a list of links out of context. “Click here” or a long raw URL tells them nothing about the destination.',
    fix:
      badLinks.length > 0
        ? 'Rewrite link text so it describes the destination, for example “Read the 2025 accessibility policy” instead of “click here”.'
        : 'No action needed.',
    locations: badLinks.slice(0, 10),
    refs: ['WCAG 2.4.4 Link Purpose (In Context)'],
  });

  /* ---------- 6. Tables ---------- */
  const tables = localTags(doc, 'tbl');
  const tablesWithoutHeaderRepeat: number[] = [];
  tables.forEach((t, i) => {
    const firstRow = localTags(t, 'tr')[0];
    const marked = firstRow ? localTags(firstRow, 'tblHeader').length > 0 : false;
    if (!marked) tablesWithoutHeaderRepeat.push(i + 1);
  });
  findings.push({
    id: 'docx-tables',
    title: 'Tables declare a header row',
    status:
      tables.length === 0 ? 'passed' : tablesWithoutHeaderRepeat.length > 0 ? 'warning' : 'review',
    category: 'Tables',
    summary:
      tables.length === 0
        ? 'No tables were found in the document body.'
        : tablesWithoutHeaderRepeat.length > 0
          ? `${tablesWithoutHeaderRepeat.length} of ${tables.length} table${tables.length === 1 ? '' : 's'} do not mark a repeating header row.`
          : `All ${tables.length} tables mark a header row. Header scope still needs a manual check.`,
    why: 'Header rows let a screen reader announce the column name with each cell. Without them, a data table becomes a stream of unlabelled values.',
    fix:
      tables.length === 0
        ? 'No action needed.'
        : 'Select the first row of each data table, open Table Properties → Row, and enable “Repeat as header row at the top of each page”. Avoid merged cells and nested tables where possible.',
    locations: tablesWithoutHeaderRepeat.map((n) => `Table ${n}`),
    details: [
      'This tool cannot tell a layout table from a data table, and cannot verify cell scope. Confirm both manually.',
    ],
    refs: ['WCAG 1.3.1 Info and Relationships'],
  });

  /* ---------- 7. Lists ---------- */
  const realListParas = paragraphs.filter((p) => localTags(p, 'numPr').length > 0).length;
  const manualBullets = paraText.filter((t) => /^([-*•·o]\s+|\d+[.)]\s+)/.test(t)).length;
  findings.push({
    id: 'docx-lists',
    title: 'Lists use real list formatting',
    status: manualBullets > 0 ? 'warning' : 'passed',
    category: 'Structure',
    summary:
      manualBullets > 0
        ? `${manualBullets} paragraphs look like manually typed bullets or numbers.`
        : realListParas > 0
          ? `${realListParas} paragraphs use Word’s list formatting.`
          : 'No manually typed list markers were detected.',
    why: 'Real lists are announced as “list of N items”, so listeners know how much content follows. Typed dashes and numbers are read as ordinary sentences.',
    fix:
      manualBullets > 0
        ? 'Replace typed markers with the Bullets or Numbering commands in Word so the list structure is stored in the file.'
        : 'No action needed.',
    details: [`Paragraphs with real list numbering: ${realListParas}.`],
    refs: ['WCAG 1.3.1 Info and Relationships'],
  });

  /* ---------- 8. Extractable text ---------- */
  findings.push({
    id: 'docx-text',
    title: 'Document contains real text',
    status: wordCount > 0 ? 'passed' : 'critical',
    category: 'Text',
    summary:
      wordCount > 0
        ? `About ${wordCount.toLocaleString()} words of selectable text were extracted.`
        : 'No selectable text was found in the document body.',
    why: 'Text has to exist as characters, not pixels, for a screen reader, braille display, or translation tool to reach it.',
    fix:
      wordCount > 0
        ? 'No action needed.'
        : 'If the content is a scanned or pasted image, replace it with real text, or add a full text alternative.',
    refs: ['WCAG 1.1.1 Non-text Content'],
  });

  /* ---------- 9. Manual-only checks ---------- */
  findings.push(
    {
      id: 'docx-reading-order',
      title: 'Reading order and meaningful sequence',
      status: 'review',
      category: 'Structure',
      summary: 'Reading order cannot be confirmed from the file alone.',
      why: 'Floating text boxes, columns, and anchored shapes can read back in an order that does not match what a sighted reader sees.',
      fix: 'Read the document with a screen reader, or tab through it, and confirm the sequence matches the visual layout. Avoid floating text boxes for essential content.',
      refs: ['WCAG 1.3.2 Meaningful Sequence'],
    },
    {
      id: 'docx-contrast',
      title: 'Colour contrast and use of colour',
      status: 'review',
      category: 'Visual design',
      summary: 'Contrast ratios are not measured by this automated check.',
      why: 'Low-contrast text is hard to read for people with low vision, and information conveyed by colour alone is lost for people who cannot distinguish it.',
      fix: 'Check body text against its background at 4.5:1 (3:1 for large text) with a contrast checker, and make sure colour is never the only cue.',
      refs: ['WCAG 1.4.3 Contrast (Minimum)', 'WCAG 1.4.1 Use of Color'],
    },
  );

  /* ---------- facts ---------- */
  const pagesRaw = app ? localTags(app, 'Pages')[0]?.textContent : null;
  const facts: Fact[] = [
    { label: 'Format', value: 'Word document (.docx)' },
    { label: 'Words', value: wordCount.toLocaleString() },
    { label: 'Paragraphs', value: String(paragraphs.length) },
    { label: 'Headings', value: String(headingLevels.length) },
    { label: 'Images', value: String(imageCount) },
    { label: 'Tables', value: String(tables.length) },
    { label: 'Links', value: String(links.length) },
  ];
  if (pagesRaw) facts.splice(1, 0, { label: 'Pages (last save)', value: pagesRaw });
  if (!app) parseNotes.push('Extended properties (docProps/app.xml) were not present, so the page count is unknown.');

  return { findings, facts, parseNotes };
}
