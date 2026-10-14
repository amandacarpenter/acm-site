/* PDF reader for the Free Screen Reader Simulation.
 * Walks the PDF tag tree (via pdf.js) and builds the spoken reading order. */
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };

const TRANSPARENT = new Set(['Document', 'DocumentFragment', 'Part', 'Art', 'Sect', 'Div', 'NonStruct', 'Private', 'Span', 'Quote', 'Code', 'Em', 'Strong', 'Sub', 'Reference', 'BibEntry', 'Annot', 'Ruby', 'RB', 'RT', 'RP', 'Warichu', 'WT', 'WP', 'Index', 'Aside', 'Title', 'FENote', 'Root', 'StructTreeRoot']);
const BLOCK = new Set(['P', 'H', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'L', 'Table', 'Figure', 'Formula', 'Form', 'BlockQuote', 'Caption', 'TOC', 'TOCI', 'Note', 'Lbl', 'LBody', 'LI', 'TR', 'TH', 'TD', 'THead', 'TBody', 'TFoot']);
const BULLET_RE = /^[\u2022\u25CF\u25E6\u25AA\u25AB\u25A0\u25A1\u2023\u2043\u2219\u00B7\u2013\u2014\-\*\u27A2\u2794\u2713\u2714\uF0B7\uF0A7\uF076\uF0D8\uF0FC\u006F]$/;
const FAKE_BULLET_RE = /^\s*[\u2022\u25CF\u25E6\u25AA\u25A0\u2023\u2219\uF0B7\uF0A7]\s+/;

function clean(s: any) { return (s || '').replace(/[\uF0B7\uF0A7\uF076\uF0D8]/g, '•').replace(/[\u00AD\u200B\uFEFF]/g, '').replace(/\s+/g, ' ').trim(); }

async function pageText(page: any) {
  // Map marked-content ids to text and rectangles
  const tc = await page.getTextContent({ includeMarkedContent: true });
  const map = new Map<any, any>();
  const stack: any[] = [];
  const plain: any[] = [];
  for (const it of tc.items) {
    if (it.type === 'beginMarkedContentProps' || it.type === 'beginMarkedContent') {
      stack.push(it.type === 'beginMarkedContentProps' && it.id ? it.id : (it.tag === 'Artifact' ? '#artifact' : null));
      continue;
    }
    if (it.type === 'endMarkedContent') { stack.pop(); continue; }
    if (typeof it.str !== 'string') continue;
    let id = null;
    for (let i = stack.length - 1; i >= 0; i--) { if (stack[i]) { id = stack[i]; break; } }
    const rect = it.str.trim() ? toRect(it) : null;
    plain.push({ str: it.str, eol: it.hasEOL, rect, artifact: id === '#artifact', y: it.transform[5] });
    if (!id || id === '#artifact') continue;
    let e: any = map.get(id);
    if (!e) { e = { text: '', rects: [] }; map.set(id, e); }
    e.text += it.str + (it.hasEOL ? ' ' : '');
    if (rect) e.rects.push(rect);
  }
  return { map, plain };
}

function toRect(it: any) {
  const [a, b, , d, x, y] = it.transform;
  const h = Math.hypot(b, d) || it.height || 10;
  const w = it.width || Math.abs(a) * it.str.length * 0.5;
  return [x, y - h * 0.22, x + w, y + h * 0.9];
}

async function getAnnots(page: any) {
  const out = new Map<any, any>();
  try {
    for (const a of await page.getAnnotations()) out.set(a.id, a);
  } catch (_) {}
  return out;
}

export async function buildPdfModel(pdf: any, name: any) {
  const items: any[] = [];
  const issues: any[] = [];
  let meta: any = {};
  try { meta = await pdf.getMetadata(); } catch (_) {}
  const info = meta.info || {};
  let mdTitle = '';
  try { mdTitle = meta.metadata ? (meta.metadata.get('dc:title') || '') : ''; } catch (_) {}
  const title = clean(mdTitle || info.Title || '');
  let markInfo = null; try { markInfo = await pdf.getMarkInfo(); } catch (_) {}
  let vp = null; try { vp = await pdf.getViewerPreferences(); } catch (_) {}
  const displayTitle = vp && (vp.DisplayDocTitle === true || (vp.get && vp.get('DisplayDocTitle') === true));
  const lang = clean(info.Language || '') || '';

  const add = (o: any) => { o.n = items.length; items.push(o); return o; };
  const flag = (item: any, severity: any, message: any, kind: any) => {
    const iss: any = { severity, message, kind, item: item ? item.n : 0 };
    if (item) (item.flags ||= []).push(iss);
    issues.push(iss);
    return iss;
  };

  // Document start
  const titleShown = title && displayTitle;
  const docItem: any = add({
    kind: 'doc', role: 'Document', page: 1, rects: [],
    display: titleShown ? title : (title || name),
    speech: `${titleShown ? title : (title || name)}, document`,
  });

  // Gather structure across pages
  const pages: any[] = [];
  let tagged = false;
  let textChars = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const [tree, text, annots] = await Promise.all([page.getStructTree().catch(() => null), pageText(page), getAnnots(page)]);
    const hasTree = !!(tree && tree.children && tree.children.length);
    if (hasTree) tagged = true;
    textChars += text.plain.reduce((n: any, t: any) => n + t.str.trim().length, 0);
    pages.push({ p, page, tree: hasTree ? tree : null, text, annots });
  }
  const isTagged = tagged && !(markInfo && markInfo.get && markInfo.get('Marked') === false);

  // Document-level checks
  if (!title) flag(docItem, 'problem', 'No document title. Screen readers announce the file name instead.', 'title');
  else if (!displayTitle) flag(docItem, 'review', 'The title is set but the PDF is set to show the file name in the title bar. Turn on "Show document title."', 'title');
  if (!lang) flag(docItem, 'problem', 'No document language. Screen readers may use the wrong voice or pronunciation.', 'lang');

  const ctx: any = { lastHeading: 0, headingCount: 0, listDepth: 0, add, flag, lang };

  if (isTagged) {
    for (const pg of pages) {
      if (!pg.tree) {
        const hasText = pg.text.plain.some((t: any) => t.str.trim() && !t.artifact);
        if (hasText) {
          const it: any = add({ kind: 'para', role: 'Untagged', page: pg.p, rects: pg.text.plain.filter((t: any) => t.rect).map((t: any) => t.rect), display: `Page ${pg.p} content`, speech: plainParagraphs(pg.text.plain).map((x: any) => x.text).join(' ') });
          flag(it, 'problem', `Page ${pg.p} has content that is not tagged. A screen reader may skip it or read it out of order.`, 'untagged');
        }
        continue;
      }
      walkChildren(pg.tree, pg, ctx);
    }
    if (ctx.headingCount === 0 && items.length > 6) {
      flag(docItem, 'problem', 'No headings found. Screen reader users cannot jump between sections.', 'heading');
    }
  } else {
    flag(docItem, 'problem', 'This PDF has no tags. Screen readers have to guess the reading order and cannot find headings, lists, tables, or image descriptions.', 'untagged');
    for (const pg of pages) {
      const paras = plainParagraphs(pg.text.plain);
      for (const para of paras) {
        add({ kind: 'para', role: 'Text', page: pg.p, rects: para.rects, display: para.text, speech: para.text });
      }
    }
  }

  if (textChars === 0) {
    flag(docItem, 'problem', 'No readable text was found. This may be a scanned image. Run OCR (text recognition) before tagging.', 'scan');
    add({ kind: 'para', role: 'Blank', page: 1, rects: [], display: 'Blank', speech: 'blank' });
  }

  add({ kind: 'end', role: 'End', page: pdf.numPages, rects: [], display: 'End of document', speech: 'End of document' });

  const counts = {
    pages: pdf.numPages,
    headings: items.filter((i: any) => i.kind === 'heading').length,
    graphics: items.filter((i: any) => i.kind === 'graphic').length,
    missingAlt: issues.filter((i: any) => i.kind === 'alt').length,
    tables: items.filter((i: any) => i.kind === 'table').length,
    lists: items.filter((i: any) => i.kind === 'list').length,
    links: items.reduce((n: any, i: any) => n + (i.links || 0), 0),
    fields: items.filter((i: any) => i.kind === 'field').length,
  };
  return { format: "pdf", pdf, items, issues, title, displayTitle, lang, tagged: isTagged, counts, name };
}

function plainParagraphs(plain: any) {
  // Untagged text: group into lines in content-stream order (roughly what a screen reader falls back to)
  const out: any = [];
  let cur: any = { text: '', rects: [] };
  let lastY: any = null;
  const push = () => { const t = clean(cur.text); if (t) out.push({ text: t, rects: cur.rects }); cur = { text: '', rects: [] }; };
  for (const t of plain) {
    if (t.artifact) continue;
    if (lastY !== null && t.str.trim() && Math.abs(t.y - lastY) > 2) push();
    cur.text += t.str;
    if (t.rect) cur.rects.push(t.rect);
    if (t.str.trim()) lastY = t.y;
    if (t.eol) cur.text += ' ';
  }
  push();
  return out;
}

function roleOf(node: any) { return node && node.role ? node.role : null; }

function walkChildren(node: any, pg: any, ctx: any) {
  for (const c of node.children || []) walk(c, pg, ctx);
}

/* Collect inline text for a node. Block-level descendants are returned separately in order. */
function collectInline(node: any, pg: any, out: any) {
  // out: { text, rects, links, segments: [] }
  if (!node) return;
  if (node.type === 'content') {
    const e: any = pg.text.map.get(node.id);
    if (e) { out.text += e.text; out.disp = (out.disp || '') + e.text; out.rects.push(...e.rects); }
    return;
  }
  if (node.type === 'annotation' || node.type === 'object') return;
  const r = roleOf(node);
  if (node.alt && r !== 'Figure' && r !== 'Formula') {
    out.text += ` ${node.alt} `; out.disp = (out.disp || '') + ` ${node.alt} `;
    return;
  }
  if (r === 'Link') {
    const sub: any = { text: '', rects: [], links: 0 };
    for (const c of node.children || []) collectInline(c, pg, sub);
    let url = '';
    for (const c of node.children || []) {
      if (c.type === 'annotation') {
        const id = String(c.id || '').replace('pdfjs_internal_id_', '');
        const a = pg.annots.get(id);
        if (a && a.url) url = a.url;
      }
    }
    const t = clean(sub.text);
    out.text += ` link, ${t || url || 'unlabeled'}, `;
    out.disp = (out.disp || '') + ` ${t || url || '[link with no text]'} `;
    out.rects.push(...sub.rects);
    out.links = (out.links || 0) + 1;
    if (!t) (out.emptyLinks ||= []).push(url);
    return;
  }
  for (const c of node.children || []) collectInline(c, pg, out);
}

function isBlock(node: any) {
  const r = roleOf(node);
  return r && BLOCK.has(r);
}

const blockMemo = new WeakMap<any, boolean>();
function hasBlockChild(node: any) {
  // True when any descendant is a block-level element (so the node must be walked, not flattened)
  if (!node || !node.children) return false;
  if (blockMemo.has(node)) return blockMemo.get(node);
  const r = node.children.some((c: any) => (isBlock(c) && roleOf(c) !== 'Lbl' && roleOf(c) !== 'LBody') || (roleOf(c) && hasBlockChild(c)));
  blockMemo.set(node, r);
  return r;
}

function emitParagraph(seg: any, pg: any, ctx: any, role: any = 'P') {
  const text = clean(seg.text.replace(/\s+,/g, ','));
  if (!text) return null;
  const disp = clean(seg.disp || seg.text);
  const roleName = (role === 'P' ? 'Text' : role) + (seg.links ? ' · link' : '');
  const item: any = ctx.add({ kind: 'para', role: roleName, page: pg.p, rects: seg.rects, display: disp, speech: text, links: seg.links || 0 });
  if (seg.emptyLinks) for (const u of seg.emptyLinks) ctx.flag(item, 'problem', `A link has no text${u ? ` (${u})` : ''}. Screen readers announce only "link".`, 'link');
  if (FAKE_BULLET_RE.test(text) && ctx.listDepth === 0) ctx.flag(item, 'review', 'This looks like a bulleted item but is not tagged as a list. Screen readers will not announce it as a list.', 'list');
  return item;
}

/* Walk a block that may mix inline content and nested blocks (for example P containing Figure). */
function walkMixed(node: any, pg: any, ctx: any, role?: any) {
  let seg: any = { text: '', rects: [], links: 0 };
  const flush = () => { emitParagraph(seg, pg, ctx, role); seg = { text: '', rects: [], links: 0 }; };
  for (const c of node.children || []) {
    if (isBlock(c)) { flush(); walk(c, pg, ctx); }
    else if (roleOf(c) && roleOf(c) !== 'Link' && hasBlockChild(c)) { flush(); walkMixed(c, pg, ctx, role); }
    else collectInline(c, pg, seg);
  }
  flush();
}

function walk(node: any, pg: any, ctx: any) {
  if (!node) return;
  if (node.type === 'content') {
    const seg: any = { text: '', rects: [] };
    collectInline(node, pg, seg);
    emitParagraph(seg, pg, ctx);
    return;
  }
  if (node.type) return;
  const r = roleOf(node);

  if (/^H[1-6]?$/.test(r)) return emitHeading(node, pg, ctx, r);
  if (r === 'Figure' || r === 'Formula') return emitGraphic(node, pg, ctx, r);
  if (r === 'L' || r === 'TOC') return emitList(node, pg, ctx, r);
  if (r === 'Table') return emitTable(node, pg, ctx);
  if (r === 'Form') {
    const seg: any = { text: '', rects: [] }; collectInline(node, pg, seg);
    let a = null;
    for (const c of node.children || []) {
      if (c.type === 'annotation') a = pg.annots.get(String(c.id || '').replace('pdfjs_internal_id_', '')) || a;
    }
    const label = clean(node.alt || (a && a.alternativeText) || seg.text);
    let type = 'form field';
    if (a) {
      if (a.fieldType === 'Tx') type = a.multiLine ? 'multi-line edit' : 'edit';
      else if (a.fieldType === 'Btn') type = a.checkBox ? 'check box' : a.radioButton ? 'radio button' : 'button';
      else if (a.fieldType === 'Ch') type = a.combo ? 'combo box' : 'list box';
      else if (a.fieldType === 'Sig') type = 'signature field';
    }
    let state = '';
    if (a && a.fieldType === 'Btn' && (a.checkBox || a.radioButton)) state = a.fieldValue && a.fieldValue !== 'Off' ? ', checked' : ', not checked';
    else if (a && a.fieldType === 'Tx') state = a.fieldValue ? `, ${a.fieldValue}` : ', blank';
    const rects = seg.rects.length ? seg.rects : (a && a.rect ? [a.rect] : []);
    const it: any = ctx.add({ kind: 'field', role: 'Form field', page: pg.p, rects, display: label ? `${label} (${type})` : `(no label) ${type}`, speech: `${label ? label + ', ' : ''}${type}${state}` });
    if (!label) ctx.flag(it, 'problem', `${/^[aeiou]/.test(type) ? 'An' : 'A'} ${type} has no label. Screen readers announce only "${type}." Add a tooltip to the field.`, 'form');
    return;
  }
  if (r === 'Link') {
    const seg: any = { text: '', rects: [], links: 0 }; collectInline(node, pg, seg); emitParagraph(seg, pg, ctx); return;
  }
  if (r === 'BlockQuote') { ctx.add({ kind: 'marker', role: 'Block quote', page: pg.p, rects: [], display: 'Block quote', speech: 'block quote' }); walkMixed(node, pg, ctx); ctx.add({ kind: 'marker', role: 'Block quote', page: pg.p, rects: [], display: 'Out of block quote', speech: 'out of block quote' }); return; }
  if (r === 'Caption') return walkMixed(node, pg, ctx, 'Caption');
  if (r === 'Note') {
    const seg: any = { text: '', rects: [], links: 0 };
    for (const c of node.children || []) {
      const cr = roleOf(c);
      if (cr === 'Table' || cr === 'Figure' || cr === 'L') { emitParagraph(seg, pg, ctx, 'Note'); seg.text = ''; seg.disp = ''; seg.rects = []; seg.links = 0; walk(c, pg, ctx); }
      else collectInline(c, pg, seg);
    }
    emitParagraph(seg, pg, ctx, 'Note');
    return;
  }
  if (r === 'P' || r === 'TOCI' || r === 'LBody' || r === 'Lbl') return walkMixed(node, pg, ctx);
  // Transparent or unknown (custom roles not mapped): read through
  walkMixed(node, pg, ctx);
}

function emitHeading(node: any, pg: any, ctx: any, r: any) {
  const seg: any = { text: '', rects: [], links: 0 };
  collectInline(node, pg, seg);
  // Headings may contain figures; announce figures after
  const text = clean(seg.text);
  const htext = clean(seg.disp || seg.text);
  const level = r === 'H' ? 0 : Number(r.slice(1));
  const speech = level ? `heading level ${level}, ${text || 'blank'}` : `heading, ${text || 'blank'}`;
  const item: any = ctx.add({ kind: 'heading', role: level ? `Heading ${level}` : 'Heading', level: level || 1, page: pg.p, rects: seg.rects, display: htext || '(empty heading)', speech, links: seg.links || 0 });
  ctx.headingCount++;
  if (!text) ctx.flag(item, 'problem', 'Empty heading. Screen readers announce "heading, blank."', 'heading');
  if (level) {
    if (ctx.lastHeading === 0 && level > 2) ctx.flag(item, 'review', `The first heading is level ${level}. Most documents start with a level 1 heading.`, 'heading');
    else if (ctx.lastHeading && level > ctx.lastHeading + 1) ctx.flag(item, 'problem', `Heading level skipped: jumps from level ${ctx.lastHeading} to level ${level}.`, 'heading');
    ctx.lastHeading = level;
  }
  for (const c of node.children || []) if (roleOf(c) === 'Figure') emitGraphic(c, pg, ctx, 'Figure');
}

function emitGraphic(node: any, pg: any, ctx: any, r: any) {
  const seg: any = { text: '', rects: [] };
  for (const c of node.children || []) collectInline(c, pg, seg);
  const alt = node.alt !== undefined && node.alt !== null ? clean(node.alt) : null;
  const inner = clean(seg.text);
  const word = r === 'Formula' ? 'formula' : 'graphic';
  let speech, display;
  if (alt) { speech = `${word}, ${alt}`; display = alt; }
  else if (inner) { speech = `${word}, ${inner}`; display = inner; }
  else { speech = `unlabeled ${word}`; display = `(no alternative text)`; }
  const item: any = ctx.add({ kind: 'graphic', role: r === 'Formula' ? 'Formula' : 'Graphic', page: pg.p, rects: seg.rects, display, speech });
  if (!alt) ctx.flag(item, 'problem', inner ? `${r} has no alternative text. The text inside it is read instead. Check that this makes sense.` : `${r} has no alternative text. Add alt text, or mark it as an artifact (decorative).`, 'alt');
  else if (/\.(png|jpe?g|gif|bmp|tiff?)$/i.test(alt) || /^(image|picture|graphic|figure|photo)\s*\d*$/i.test(alt)) ctx.flag(item, 'review', `Alt text "${alt}" looks like a file name or placeholder. Describe what the image shows.`, 'alt');
}

function emitList(node: any, pg: any, ctx: any, r: any) {
  const lis = (node.children || []).filter((c: any) => roleOf(c) === 'LI' || roleOf(c) === 'TOCI');
  ctx.listDepth++;
  const depth = ctx.listDepth;
  const label = r === 'TOC' ? 'table of contents' : 'list';
  const start: any = ctx.add({ kind: 'list', role: depth > 1 ? `List, level ${depth}` : 'List', page: pg.p, rects: [], display: `${r === 'TOC' ? 'Table of contents' : 'List'} with ${lis.length} item${lis.length === 1 ? '' : 's'}`, speech: `${label} with ${lis.length} item${lis.length === 1 ? '' : 's'}${depth > 1 ? `, nesting level ${depth}` : ''}` });
  if (lis.length === 0) ctx.flag(start, 'review', 'List tag with no list items (LI) inside. Screen readers may announce an empty list.', 'list');
  for (const c of node.children || []) {
    const cr = roleOf(c);
    if (cr === 'LI' || cr === 'TOCI') emitListItem(c, pg, ctx);
    else walk(c, pg, ctx);
  }
  ctx.add({ kind: 'marker', role: start.role, page: pg.p, rects: [], display: `Out of ${label}`, speech: `out of ${label}` });
  ctx.listDepth--;
}

function emitListItem(li: any, pg: any, ctx: any) {
  let lbl = '';
  const body: any = { text: '', rects: [], links: 0 };
  const nested: any[] = [];
  const visit = (n: any) => {
    for (const c of n.children || []) {
      const cr = roleOf(c);
      if (cr === 'Lbl') { const s: any = { text: '', rects: [] }; collectInline(c, pg, s); lbl += s.text; body.rects.push(...s.rects); }
      else if (cr === 'L' || cr === 'Table' || cr === 'Figure') nested.push(c);
      else if (cr === 'LBody' || cr === 'P' || (cr && TRANSPARENT.has(cr))) visit(c);
      else collectInline(c, pg, body);
    }
  };
  visit(li);
  lbl = clean(lbl);
  const text = clean(body.text.replace(/\s+,/g, ','));
  const spokenLbl = !lbl ? '' : BULLET_RE.test(lbl) ? 'bullet' : lbl;
  const dtext = clean(body.disp || body.text);
  const display = `${lbl ? (BULLET_RE.test(lbl) ? '•' : lbl) + ' ' : ''}${dtext}`.trim();
  const item: any = ctx.add({ kind: 'listitem', role: 'List item', page: pg.p, rects: body.rects, display: display || '(empty list item)', speech: `${spokenLbl ? spokenLbl + ', ' : ''}${text || 'blank'}`, links: body.links || 0 });
  if (body.emptyLinks) for (const u of body.emptyLinks) ctx.flag(item, 'problem', `A link has no text${u ? ` (${u})` : ''}.`, 'link');
  for (const n of nested) walk(n, pg, ctx);
}

function emitTable(node: any, pg: any, ctx: any) {
  const rows: any[] = [];
  const visit = (n: any) => {
    for (const c of n.children || []) {
      const cr = roleOf(c);
      if (cr === 'TR') rows.push(c);
      else if (cr === 'THead' || cr === 'TBody' || cr === 'TFoot' || (cr && TRANSPARENT.has(cr))) visit(c);
    }
  };
  visit(node);
  const grid = rows.map((tr: any) => (tr.children || []).filter((c: any) => roleOf(c) === 'TH' || roleOf(c) === 'TD'));
  const cols = grid.reduce((m: any, r: any) => Math.max(m, r.length), 0);
  const start: any = ctx.add({ kind: 'table', role: 'Table', page: pg.p, rects: [], display: `Table with ${rows.length} rows and ${cols} columns`, speech: `table with ${rows.length} rows and ${cols} columns` });
  if (!rows.length) { ctx.flag(start, 'problem', 'Table tag with no rows (TR) inside. Screen readers cannot navigate it as a table.', 'table'); }

  const anyTH = grid.some((r: any) => r.some((c: any) => roleOf(c) === 'TH'));
  if (rows.length && !anyTH) ctx.flag(start, 'problem', 'Table has no header cells (TH). Screen readers cannot tell users which column or row a value belongs to.', 'table');

  const colHeaders: any[] = [];
  if (grid[0] && grid[0].length && grid[0].every((c: any) => roleOf(c) === 'TH')) {
    grid[0].forEach((c: any, i: any) => { const s: any = { text: '', rects: [] }; collectInline(c, pg, s); colHeaders[i] = clean(s.text); });
  }
  let firstCellRects: any = null;
  grid.forEach((cells: any, ri: any) => {
    let rowHeader = '';
    if (cells[0] && roleOf(cells[0]) === 'TH' && ri > 0) { const s: any = { text: '', rects: [] }; collectInline(cells[0], pg, s); rowHeader = clean(s.text); }
    cells.forEach((cell: any, ci: any) => {
      const s: any = { text: '', rects: [], links: 0 };
      const nested: any[] = [];
      for (const c of cell.children || []) {
        const cr = roleOf(c);
        if (cr === 'Table' || cr === 'L' || cr === 'Figure') nested.push(c);
        else collectInline(c, pg, s);
      }
      const text = clean(s.text.replace(/\s+,/g, ','));
      const ctext = clean(s.disp || s.text);
      const isTH = roleOf(cell) === 'TH';
      const parts = [];
      if (ci === 0) parts.push(`row ${ri + 1}`);
      if (ri > 0 && rowHeader && ci > 0) parts.push(rowHeader);
      parts.push(`column ${ci + 1}`);
      if (ri > 0 && colHeaders[ci] && !isTH) parts.push(colHeaders[ci]);
      const speech = `${parts.join(', ')}, ${text || 'blank'}`;
      const it: any = ctx.add({ kind: 'cell', role: isTH ? 'Header cell' : 'Cell', page: pg.p, rects: s.rects, display: ctext || '(blank)', speech, cell: `R${ri + 1} C${ci + 1}`, links: s.links || 0 });
      if (!firstCellRects) firstCellRects = s.rects;
      for (const n of nested) walk(n, pg, ctx);
      void it;
    });
  });
  start.rects = firstCellRects || [];
  ctx.add({ kind: 'marker', role: 'Table', page: pg.p, rects: [], display: 'Out of table', speech: 'out of table' });
}

