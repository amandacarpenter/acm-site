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

interface PptxResult {
  findings: Finding[];
  facts: Fact[];
  parseNotes: string[];
}

function slideNumber(path: string): number {
  const m = /slide(\d+)\.xml$/.exec(path);
  return m ? Number(m[1]) : 0;
}

export async function analyzePptx(file: File): Promise<PptxResult> {
  const zip = await openZip(file);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  if (slidePaths.length === 0) {
    throw new Error(
      'No slides could be read from this file. It may be an older .ppt file, password protected, or damaged.',
    );
  }

  const core = await readXml(zip, 'docProps/core.xml');
  const findings: Finding[] = [];
  const parseNotes: string[] = [];

  const slides: Document[] = [];
  for (const p of slidePaths) {
    const d = await readXml(zip, p);
    if (d) slides.push(d);
    else parseNotes.push(`Slide XML at ${p} could not be parsed and was skipped.`);
  }

  const noTitle: string[] = [];
  const titles: string[] = [];
  const missingAlt: string[] = [];
  const placeholderAlt: string[] = [];
  const badLinks: string[] = [];
  const tablesOn: string[] = [];
  const emptyTextSlides: string[] = [];
  const langs = new Set<string>();
  let imageCount = 0;
  let linkCount = 0;
  let charCount = 0;

  slides.forEach((sl, idx) => {
    const label = `Slide ${idx + 1}`;

    // Title placeholder
    let title = '';
    for (const sp of localTags(sl, 'sp')) {
      const ph = localTags(sp, 'ph')[0];
      const type = ph ? attrLocal(ph, 'type') : null;
      if (type === 'title' || type === 'ctrTitle') {
        title = textOf(sp);
        break;
      }
    }
    if (title) titles.push(title);
    else noTitle.push(label);

    // Alt text on pictures and graphic frames
    for (const pic of localTags(sl, 'pic')) {
      imageCount += 1;
      const cNvPr = localTags(pic, 'cNvPr')[0];
      const descr = (cNvPr ? attrLocal(cNvPr, 'descr') || '' : '').trim();
      const name = (cNvPr ? attrLocal(cNvPr, 'name') || 'Picture' : 'Picture').trim();
      const decorative = cNvPr ? localTags(cNvPr, 'decorative').length > 0 : false;
      if (!descr && !decorative) missingAlt.push(`${label} · ${truncate(name, 28)}`);
      else if (descr && isWeakAltText(descr))
        placeholderAlt.push(`${label} · “${truncate(descr, 28)}”`);
    }

    // Links
    for (const hl of localTags(sl, 'hlinkClick')) {
      const rid = attrLocal(hl, 'id');
      if (!rid) continue;
      linkCount += 1;
      const shape = hl.closest ? hl.closest('*') : null;
      // Find the nearest ancestor shape to read its text
      let node: Element | null = hl;
      let text = '';
      while (node) {
        if (node.localName === 'sp' || node.localName === 'pic') {
          text = textOf(node);
          break;
        }
        node = node.parentElement;
      }
      void shape;
      if (!text) badLinks.push(`${label} · (no visible link text)`);
      else if (isGenericLinkText(text) || looksLikeRawUrl(text))
        badLinks.push(`${label} · ${truncate(text, 36)}`);
    }

    // Tables
    if (localTags(sl, 'tbl').length > 0) tablesOn.push(label);

    // Language
    for (const rPr of localTags(sl, 'rPr')) {
      const l = attrLocal(rPr, 'lang');
      if (l) langs.add(l);
    }

    const slideText = localTags(sl, 't')
      .map((t) => t.textContent ?? '')
      .join(' ')
      .trim();
    charCount += slideText.length;
    if (!slideText) emptyTextSlides.push(label);
  });

  const coreLang = coreLanguage(core);
  if (coreLang) langs.add(coreLang);

  /* ---------- 1. Slide titles ---------- */
  findings.push({
    id: 'pptx-slide-titles',
    title: 'Every slide has a title',
    status: noTitle.length > 0 ? 'critical' : 'passed',
    category: 'Structure',
    summary:
      noTitle.length > 0
        ? `${noTitle.length} of ${slides.length} slides have no text in a title placeholder.`
        : `All ${slides.length} slides use a title placeholder.`,
    why: 'Slide titles are the primary way screen reader users move through a deck and understand where they are. A untitled slide is announced only by number.',
    fix:
      noTitle.length > 0
        ? 'Use Home → Layout to apply a layout with a title placeholder, then type the title. If the title should not be visible, keep the placeholder and move it off-slide or set it to hidden rather than deleting it.'
        : 'No action needed.',
    locations: noTitle.slice(0, 14),
    refs: ['WCAG 2.4.6 Headings and Labels', 'WCAG 1.3.1 Info and Relationships'],
  });

  /* ---------- 2. Duplicate titles ---------- */
  const seen = new Map<string, number>();
  titles.forEach((t) => seen.set(t.toLowerCase(), (seen.get(t.toLowerCase()) ?? 0) + 1));
  const dupes = Array.from(seen.entries()).filter(([, n]) => n > 1);
  findings.push({
    id: 'pptx-unique-titles',
    title: 'Slide titles are distinguishable',
    status: dupes.length > 0 ? 'warning' : 'passed',
    category: 'Structure',
    summary:
      dupes.length > 0
        ? `${dupes.length} title${dupes.length === 1 ? ' is' : 's are'} repeated on multiple slides.`
        : 'No repeated slide titles were detected.',
    why: 'When several slides share a title, a listener scanning the outline cannot tell them apart or find their place again.',
    fix:
      dupes.length > 0
        ? 'Make repeated titles unique, for example “Results (1 of 3)”, or fold the slides into one.'
        : 'No action needed.',
    locations: dupes.slice(0, 8).map(([t, n]) => `${truncate(t, 40)} ×${n}`),
    refs: ['WCAG 2.4.6 Headings and Labels'],
  });

  /* ---------- 3. Alt text ---------- */
  findings.push({
    id: 'pptx-alt-text',
    title: 'Images have alternative text',
    status: imageCount === 0 ? 'passed' : missingAlt.length > 0 ? 'critical' : placeholderAlt.length > 0 ? 'warning' : 'passed',
    category: 'Alternative text',
    summary:
      imageCount === 0
        ? 'No pictures were found on the slides.'
        : missingAlt.length > 0
          ? `${missingAlt.length} of ${imageCount} picture${imageCount === 1 ? '' : 's'} have no alt text and are not marked decorative.`
          : placeholderAlt.length > 0
            ? `All ${imageCount} picture${imageCount === 1 ? '' : 's'} have alt text, but some look like placeholders.`
            : `All ${imageCount} picture${imageCount === 1 ? ' carries' : 's carry'} a description or ${imageCount === 1 ? 'is' : 'are'} marked decorative.`,
    why: 'A picture without a text alternative is silence for someone using a screen reader — any information it carries is simply lost.',
    fix:
      missingAlt.length > 0 || placeholderAlt.length > 0
        ? 'Right-click each picture → View Alt Text, then describe what it communicates in one sentence. Tick “Mark as decorative” for purely visual elements.'
        : 'No action needed.',
    locations: [...missingAlt, ...placeholderAlt].slice(0, 14),
    details: ['Charts, SmartArt, and grouped shapes are not covered by this check and should be reviewed manually.'],
    refs: ['WCAG 1.1.1 Non-text Content'],
  });

  /* ---------- 4. Reading order ---------- */
  findings.push({
    id: 'pptx-reading-order',
    title: 'Slide reading order',
    status: 'review',
    category: 'Structure',
    summary: 'Reading order is stored as shape order and needs a human check.',
    why: 'Screen readers follow the selection-pane order, not the visual arrangement. Shapes added late often read last even when they appear first.',
    fix: 'On each slide, open Home → Arrange → Selection Pane and drag shapes into the order they should be read (bottom of the list is read first in older versions — verify with a screen reader).',
    refs: ['WCAG 1.3.2 Meaningful Sequence'],
  });

  /* ---------- 5. Language ---------- */
  const langList = Array.from(langs);
  findings.push({
    id: 'pptx-language',
    title: 'Language is declared on slide text',
    status: langList.length > 0 ? 'passed' : 'warning',
    category: 'Language',
    summary:
      langList.length > 0
        ? `Language metadata found: ${langList.slice(0, 6).join(', ')}.`
        : 'No language metadata was found on slide text runs.',
    why: 'The declared language controls screen reader pronunciation. An unset or incorrect value can make speech output unintelligible.',
    fix:
      langList.length > 0
        ? 'No action needed. Confirm the value matches the language actually used.'
        : 'Select all slide text, then Review → Language → Set Proofing Language, and re-save.',
    refs: ['WCAG 3.1.1 Language of Page'],
  });

  /* ---------- 6. Links ---------- */
  findings.push({
    id: 'pptx-links',
    title: 'Link text is descriptive',
    status: linkCount === 0 ? 'passed' : badLinks.length > 0 ? 'warning' : 'passed',
    category: 'Links',
    summary:
      linkCount === 0
        ? 'No hyperlinks were found on the slides.'
        : badLinks.length > 0
          ? `${badLinks.length} of ${linkCount} links use generic text or a bare URL.`
          : `All ${linkCount} link${linkCount === 1 ? '' : 's'} use descriptive text.`,
    why: 'Links are often read out of context in a list. Generic wording gives the listener no way to choose.',
    fix:
      badLinks.length > 0
        ? 'Edit each hyperlink and set the display text to describe the destination.'
        : 'No action needed.',
    locations: badLinks.slice(0, 10),
    refs: ['WCAG 2.4.4 Link Purpose (In Context)'],
  });

  /* ---------- 7. Tables ---------- */
  findings.push({
    id: 'pptx-tables',
    title: 'Table structure',
    status: tablesOn.length > 0 ? 'review' : 'passed',
    category: 'Tables',
    summary:
      tablesOn.length > 0
        ? `Tables found on ${tablesOn.length} slide${tablesOn.length === 1 ? '' : 's'}; header semantics need a manual check.`
        : 'No tables were found on the slides.',
    why: 'PowerPoint tables carry very little structural information, so a screen reader may not associate values with their column headers.',
    fix:
      tablesOn.length > 0
        ? 'Keep tables simple and rectangular, enable the Header Row option in Table Design, and consider providing the same data as text or a linked accessible spreadsheet.'
        : 'No action needed.',
    locations: tablesOn.slice(0, 12),
    refs: ['WCAG 1.3.1 Info and Relationships'],
  });

  /* ---------- 8. Text content ---------- */
  findings.push({
    id: 'pptx-text',
    title: 'Slides contain real text',
    status: emptyTextSlides.length === slides.length ? 'critical' : emptyTextSlides.length > 0 ? 'warning' : 'passed',
    category: 'Text',
    summary:
      emptyTextSlides.length === 0
        ? `Selectable text was extracted from all ${slides.length} slides.`
        : `${emptyTextSlides.length} slide${emptyTextSlides.length === 1 ? '' : 's'} contain no extractable text.`,
    why: 'Slides built entirely from images of text cannot be read aloud, enlarged cleanly, or translated.',
    fix:
      emptyTextSlides.length > 0
        ? 'Replace pictures of text with real text boxes, or give the image a full text alternative that carries the same information.'
        : 'No action needed.',
    locations: emptyTextSlides.slice(0, 12),
    details: [`Total characters extracted: ${charCount.toLocaleString()}.`],
    refs: ['WCAG 1.1.1 Non-text Content'],
  });

  /* ---------- 9. Deck title metadata ---------- */
  const rawDeckTitle = coreTitle(core);
  const deckTitle = rawDeckTitle && !isPlaceholderTitle(rawDeckTitle) ? rawDeckTitle : null;
  findings.push({
    id: 'pptx-title-meta',
    title: 'Presentation title in file properties',
    status: deckTitle ? 'passed' : 'warning',
    category: 'Metadata',
    summary: deckTitle
      ? `A title is set: “${truncate(deckTitle, 70)}”.`
      : rawDeckTitle
        ? `The title “${truncate(rawDeckTitle, 50)}” looks like a placeholder rather than a real title.`
        : 'No title is set in the file properties.',
    why: 'The title property identifies the deck to assistive technology and carries over when the file is exported to PDF.',
    fix: deckTitle
      ? 'No action needed.'
      : 'In PowerPoint, go to File → Info → Properties and add a descriptive Title.',
    refs: ['WCAG 2.4.2 Page Titled'],
  });

  /* ---------- 10. Contrast ---------- */
  findings.push({
    id: 'pptx-contrast',
    title: 'Colour contrast and use of colour',
    status: 'review',
    category: 'Visual design',
    summary: 'Contrast ratios are not measured by this preflight.',
    why: 'Slide templates often place light text on busy photographs, which is unreadable for people with low vision and in bright rooms.',
    fix: 'Check text against its background at 4.5:1 (3:1 for text 18pt and larger) and avoid conveying meaning with colour alone.',
    refs: ['WCAG 1.4.3 Contrast (Minimum)', 'WCAG 1.4.1 Use of Color'],
  });

  const facts: Fact[] = [
    { label: 'Format', value: 'PowerPoint deck (.pptx)' },
    { label: 'Slides', value: String(slides.length) },
    { label: 'Titled slides', value: `${slides.length - noTitle.length} of ${slides.length}` },
    { label: 'Pictures', value: String(imageCount) },
    { label: 'Links', value: String(linkCount) },
    { label: 'Slides with tables', value: String(tablesOn.length) },
  ];

  return { findings, facts, parseNotes };
}
