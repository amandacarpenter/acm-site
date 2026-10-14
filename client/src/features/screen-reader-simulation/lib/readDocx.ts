// Word (.docx) reader for the Free Screen Reader Simulation.
// Builds the same item/issue model the PDF reader produces, plus a simple HTML view of the document.
import JSZip from 'jszip';

const strFromU8 = (u8: Uint8Array) => new TextDecoder('utf-8').decode(u8);

/* Open the package with JSZip and return the parts the reader needs as bytes. */
async function unzipDocx(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  const zip = await JSZip.loadAsync(bytes);
  const out: Record<string, Uint8Array> = {};
  const wanted = Object.keys(zip.files).filter((n: any) => !zip.files[n].dir && /^(word\/|docProps\/|\[Content_Types\]\.xml|EncryptedPackage$)/.test(n));
  await Promise.all(wanted.map(async (n: any) => { out[n] = await zip.files[n].async('uint8array'); }));
  return out;
}

const W_BOOL_OFF = new Set(['0', 'false', 'off', 'none']);
const BULLET_CHARS = /^[\u2022\u25CF\u25E6\u25AA\u25AB\u25A0\u25A1\u2023\u2043\u2219\u00B7\u2013\u2014\-\*\u27A2\u2794\u2713\u2714\uF0B7\uF0A7\uF076\uF0D8\uF0FC\uF06E\uF071\u006F\u00A7]$/;
const FAKE_LIST_RE = /^\s*(?:[\u2022\u25CF\u25E6\u25AA\u25A0\u2023\u2219\u00B7\u2013\-\*\uF0B7\uF0A7]|\d{1,2}[.)])\s+\S/;
const VAGUE_LINK = new Set(['click here', 'here', 'click', 'read more', 'more', 'link', 'this link', 'learn more', 'this']);

function clean(s: any) { return (s || '').replace(/[\uF0B7\uF0A7\uF076\uF0D8]/g, '•').replace(/[\u00AD\u200B\uFEFF]/g, '').replace(/\s+/g, ' ').trim(); }
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s: any) { return String(s).replace(/[&<>"']/g, (c: string) => ESC[c]); }
const kids = (el: any, name?: any): any[] => (el ? Array.from(el.children as ArrayLike<any>).filter((c: any) => !name || c.localName === name) : []);
const kid = (el: any, name: any): any => (el ? Array.from(el.children as ArrayLike<any>).find((c: any) => c.localName === name) || null : null);
const wv = (el: any, a: any = 'val') => (el ? el.getAttribute('w:' + a) : null);
const on = (el: any) => !!el && !W_BOOL_OFF.has(String(wv(el) ?? 'true').toLowerCase());
function desc(el: any, name: any): any { if (!el) return null; const all = el.getElementsByTagName('*'); for (const e of all) if (e.localName === name) return e; return null; }
function descAll(el: any, name: any): any[] { if (!el) return []; return Array.from(el.getElementsByTagName('*') as ArrayLike<any>).filter((e: any) => e.localName === name); }

function parseXml(files: any, path: any) {
  const f = files[path];
  if (!f) return null;
  const doc = new DOMParser().parseFromString(strFromU8(f), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  return doc;
}

function parseRels(files: any, path: any) {
  const map = new Map<any, any>();
  const doc = parseXml(files, path);
  if (!doc) return map;
  for (const r of Array.from(doc.getElementsByTagName('*')).filter((e: any) => e.localName === 'Relationship')) {
    map.set(r.getAttribute('Id'), { target: r.getAttribute('Target') || '', external: r.getAttribute('TargetMode') === 'External' });
  }
  return map;
}

/* ---------- Styles ---------- */
function parseStyles(doc: any) {
  const styles = new Map<any, any>();
  let defaultPara: any = null;
  let lang = '';
  if (!doc) return { styles, defaultPara, lang };
  const root = doc.documentElement;
  const dd = kid(root, 'docDefaults');
  const dLang = desc(kid(dd, 'rPrDefault'), 'lang');
  if (dLang) lang = wv(dLang) || '';
  for (const s of kids(root, 'style')) {
    const id = wv(s, 'styleId');
    const pPr = kid(s, 'pPr');
    const rPr = kid(s, 'rPr');
    const numPr = kid(pPr, 'numPr');
    const st: any = {
      id, type: wv(s, 'type'),
      name: (wv(kid(s, 'name')) || id || '').toLowerCase(),
      basedOn: wv(kid(s, 'basedOn')),
      outline: kid(pPr, 'outlineLvl') ? Number(wv(kid(pPr, 'outlineLvl'))) : null,
      numId: numPr ? wv(kid(numPr, 'numId')) : null,
      ilvl: numPr && kid(numPr, 'ilvl') ? Number(wv(kid(numPr, 'ilvl'))) : null,
      bold: kid(rPr, 'b') ? on(kid(rPr, 'b')) : null,
    };
    styles.set(id, st);
    if (st.type === 'paragraph' && (s.getAttribute('w:default') === '1' || s.getAttribute('w:default') === 'true')) defaultPara = id;
  }
  return { styles, defaultPara, lang };
}

function styleChain(S: any, id: any) {
  const out: any[] = [];
  let cur = id || S.defaultPara;
  const seen = new Set<any>();
  while (cur && S.styles.has(cur) && !seen.has(cur) && out.length < 12) { seen.add(cur); const st = S.styles.get(cur); out.push(st); cur = st.basedOn; }
  return out;
}
function styleHeading(S: any, id: any) {
  for (const st of styleChain(S, id)) {
    const m = /^heading\s*([1-9])$/.exec(st.name);
    if (m) return Number(m[1]);
    if (st.outline !== null && st.outline >= 0 && st.outline <= 8) return st.outline + 1;
  }
  return 0;
}
function styleIsTitle(S: any, id: any) { const c = styleChain(S, id); return c.length && (c[0].name === 'title'); }
function styleNum(S: any, id: any) { for (const st of styleChain(S, id)) if (st.numId !== null) return { numId: st.numId, ilvl: st.ilvl ?? 0 }; return null; }
function styleBold(S: any, id: any) { for (const st of styleChain(S, id)) if (st.bold !== null) return st.bold; return false; }

/* ---------- Numbering ---------- */
function parseNumbering(doc: any) {
  const abs = new Map<any, any>();
  const nums = new Map<any, any>();
  if (!doc) return { abs, nums };
  const root = doc.documentElement;
  for (const a of kids(root, 'abstractNum')) {
    const lvls = new Map<any, any>();
    for (const l of kids(a, 'lvl')) {
      lvls.set(Number(wv(l, 'ilvl')), { fmt: wv(kid(l, 'numFmt')) || 'decimal', text: wv(kid(l, 'lvlText')) ?? '', start: Number(wv(kid(l, 'start')) || 1) });
    }
    abs.set(wv(a, 'abstractNumId'), lvls);
  }
  for (const n of kids(root, 'num')) {
    const overrides = new Map<any, any>();
    for (const o of kids(n, 'lvlOverride')) {
      const so = kid(o, 'startOverride');
      const lvl = kid(o, 'lvl');
      overrides.set(Number(wv(o, 'ilvl')), {
        start: so ? Number(wv(so)) : null,
        lvl: lvl ? { fmt: wv(kid(lvl, 'numFmt')) || 'decimal', text: wv(kid(lvl, 'lvlText')) ?? '', start: Number(wv(kid(lvl, 'start')) || 1) } : null,
      });
    }
    nums.set(wv(n, 'numId'), { abs: wv(kid(n, 'abstractNumId')), overrides });
  }
  return { abs, nums };
}
function numLevel(N: any, numId: any, ilvl: any) {
  const n = N.nums.get(numId);
  if (!n) return null;
  const o = n.overrides.get(ilvl);
  const base = (N.abs.get(n.abs) || new Map()).get(ilvl);
  const lvl = (o && o.lvl) || base;
  if (!lvl) return null;
  return { ...lvl, start: o && o.start !== null && o.start !== undefined ? o.start : lvl.start };
}
function roman(n: any) {
  const t: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s;
}
function letters(n: any) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
function fmtNum(n: any, fmt: any) {
  switch (fmt) {
    case 'lowerLetter': return letters(n);
    case 'upperLetter': return letters(n).toUpperCase();
    case 'lowerRoman': return roman(n);
    case 'upperRoman': return roman(n).toUpperCase();
    case 'decimalZero': return String(n).padStart(2, '0');
    default: return String(n);
  }
}

/* ---------- Main ---------- */
export async function buildDocxModel(bytes: any, name: any) {
  let files: any;
  try {
    files = await unzipDocx(bytes);
  } catch (err) {
    const e: any = new Error('not-docx'); e.code = 'not-docx'; throw e;
  }
  if (files['EncryptedPackage'] || !files['word/document.xml']) {
    const e: any = new Error('not-docx'); e.code = files['EncryptedPackage'] ? 'encrypted' : 'not-docx'; throw e;
  }
  const docXml = parseXml(files, 'word/document.xml');
  if (!docXml) { const e: any = new Error('not-docx'); e.code = 'not-docx'; throw e; }
  const S = parseStyles(parseXml(files, 'word/styles.xml'));
  const N = parseNumbering(parseXml(files, 'word/numbering.xml'));
  const rels = parseRels(files, 'word/_rels/document.xml.rels');
  const core = parseXml(files, 'docProps/core.xml');
  const app = parseXml(files, 'docProps/app.xml');
  const settings = parseXml(files, 'word/settings.xml');

  const title = clean(core ? (desc(core.documentElement, 'title') || {}).textContent : '');
  let lang = S.lang;
  if (!lang && settings) { const tf = desc(settings.documentElement, 'themeFontLang'); if (tf) lang = wv(tf) || ''; }
  if (!lang) { const firstLang = desc(docXml.documentElement, 'lang'); if (firstLang) lang = wv(firstLang) || ''; }
  const appPages = app ? Number((desc(app.documentElement, 'Pages') || {}).textContent || 0) : 0;
  const useLRPB = strFromU8(files['word/document.xml']).includes('lastRenderedPageBreak');

  // Footnotes / endnotes
  const notes: any = { footnote: new Map(), endnote: new Map() };
  for (const [kind, path] of [['footnote', 'word/footnotes.xml'], ['endnote', 'word/endnotes.xml']]) {
    const d = parseXml(files, path);
    if (!d) continue;
    for (const fn of kids(d.documentElement, kind)) {
      const t = wv(fn, 'type');
      if (t && t !== 'normal') continue;
      notes[kind].set(wv(fn, 'id'), fn);
    }
  }

  // Images
  const blobUrls: any[] = [];
  const imgCache = new Map<any, any>();
  const imageUrl = (rid: any) => {
    if (!rid) return '';
    if (imgCache.has(rid)) return imgCache.get(rid);
    const rel = rels.get(rid);
    let url = '';
    if (rel && !rel.external) {
      const path = rel.target.startsWith('/') ? rel.target.slice(1) : 'word/' + rel.target.replace(/^\.\//, '');
      const data = files[path];
      const ext = (path.split('.').pop() || '').toLowerCase();
      const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' } as Record<string, string>)[ext];
      if (data && mime) { url = URL.createObjectURL(new Blob([data], { type: mime })); blobUrls.push(url); }
    }
    imgCache.set(rid, url);
    return url;
  };

  const items: any[] = [];
  const issues: any[] = [];
  const html: any[] = [];
  const add = (o: any) => { o.n = items.length; o.rects = []; items.push(o); return o; };
  const flag = (item: any, severity: any, message: any, kind: any) => {
    const iss: any = { severity, message, kind, item: item ? item.n : 0 };
    if (item) (item.flags ||= []).push(iss);
    issues.push(iss);
    return iss;
  };

  const ctx: any = {
    page: 1, lastHeading: 0, headingCount: 0, list: [], counters: new Map(), blankRun: 0,
    fake: null, fields: [], noteOrder: [], noteNum: { footnote: 0, endnote: 0 }, noteLabel: new Map(),
    links: 0, titleStyleItem: null, inTable: 0,
  };

  const docItem = add({ kind: 'doc', role: 'Document', page: 1, display: title || name, speech: `${title || name}, document` });
  html.push(`<div class="dv-doc" data-n="${docItem.n}">${esc(title || name)}</div>`);
  if (!title) flag(docItem, 'problem', 'No document title. Screen readers announce the file name instead. In Word, add a Title under File, then Info, then Properties.', 'title');
  if (!lang) flag(docItem, 'problem', 'No document language. Screen readers may use the wrong voice or pronunciation. In Word, set it under Review, then Language.', 'lang');

  /* ----- Inline content of one paragraph ----- */
  function readParagraph(p: any) {
    const pPr = kid(p, 'pPr');
    const styleId = wv(kid(pPr, 'pStyle'));
    const out: any = {
      styleId, text: '', speech: '', disp: '', links: [], graphics: [], boxes: [], page: null,
      boldChars: 0, plainChars: 0, numPr: null,
    };
    const np = kid(pPr, 'numPr');
    if (np) out.numPr = { numId: wv(kid(np, 'numId')), ilvl: kid(np, 'ilvl') ? Number(wv(kid(np, 'ilvl'))) : 0 };
    if (!useLRPB && on(kid(pPr, 'pageBreakBefore'))) ctx.page++;
    const paraBold = styleBold(S, styleId);
    let link: any = null;

    const put = (t: any, bold: any) => {
      if (!t) return;
      if (out.page === null && t.trim()) out.page = ctx.page;
      out.text += t; out.speech += t; out.disp += t;
      if (link) link.text += t;
      const n = t.replace(/\s/g, '').length;
      if (bold) out.boldChars += n; else out.plainChars += n;
    };
    const openLink = (url: any) => { link = { text: '', url: url || '' }; out.speech += ' link, '; };
    const closeLink = () => {
      if (!link) return;
      out.speech += ', ';
      out.links.push(link);
      link = null;
    };
    const inField = () => ctx.fields.length && ctx.fields[ctx.fields.length - 1].phase === 'instr';

    const run = (r: any) => {
      const rPr = kid(r, 'rPr');
      const bold = kid(rPr, 'b') ? on(kid(rPr, 'b')) : paraBold;
      const hidden = on(kid(rPr, 'vanish')) && kid(rPr, 'vanish');
      for (const c of kids(r)) {
        switch (c.localName) {
          case 't': if (!inField() && !hidden) put(c.textContent, bold); break;
          case 'tab': case 'ptab': if (!inField()) put(' ', bold); break;
          case 'br': case 'cr':
            if (wv(c, 'type') === 'page' && !useLRPB) ctx.page++;
            if (!inField()) put(' ', bold);
            break;
          case 'noBreakHyphen': case 'softHyphen': if (c.localName === 'noBreakHyphen') put('-', bold); break;
          case 'lastRenderedPageBreak': if (useLRPB) ctx.page++; break;
          case 'instrText': if (ctx.fields.length) ctx.fields[ctx.fields.length - 1].instr += c.textContent; break;
          case 'fldChar': {
            const t = wv(c, 'fldCharType');
            if (t === 'begin') ctx.fields.push({ instr: '', phase: 'instr', link: false });
            else if (t === 'separate' && ctx.fields.length) {
              const f = ctx.fields[ctx.fields.length - 1];
              f.phase = 'result';
              const m = /HYPERLINK\s+(?:\\l\s+)?"([^"]*)"/i.exec(f.instr);
              if (m && !link) { f.link = true; openLink(m[1]); }
            } else if (t === 'end' && ctx.fields.length) {
              const f = ctx.fields.pop();
              if (f.link) closeLink();
            }
            break;
          }
          case 'footnoteReference': case 'endnoteReference': {
            const kind = c.localName === 'footnoteReference' ? 'footnote' : 'endnote';
            const id = wv(c, 'id');
            const key = kind + ':' + id;
            if (!ctx.noteLabel.has(key)) { ctx.noteNum[kind]++; ctx.noteLabel.set(key, ctx.noteNum[kind]); ctx.noteOrder.push({ kind, id, label: ctx.noteNum[kind] }); }
            const lbl = ctx.noteLabel.get(key);
            out.speech += ` ${kind} ${lbl} `; out.disp += `[${lbl}]`;
            if (out.page === null) out.page = ctx.page;
            break;
          }
          case 'drawing': graphicFromDrawing(c); break;
          case 'pict': case 'object': graphicFromVml(c); break;
          case 'AlternateContent': { const ch = kid(c, 'Choice') || kid(c, 'Fallback'); if (ch) run(ch); break; }
          case 'sym': break;
          default: break;
        }
      }
    };

    const graphicFromDrawing = (d: any) => {
      const holder = kid(d, 'inline') || kid(d, 'anchor');
      if (!holder) return;
      const docPr = kid(holder, 'docPr');
      const descr = clean(docPr ? docPr.getAttribute('descr') : '');
      const ttl = clean(docPr ? docPr.getAttribute('title') : '');
      const dec = descAll(docPr, 'decorative').some((e: any) => (e.getAttribute('val') || '') === '1' || (e.getAttribute('val') || '').toLowerCase() === 'true');
      const txbx = descAll(holder, 'txbxContent');
      const blip = desc(holder, 'blip');
      const isChart = !!desc(holder, 'chart');
      const isPic = !!desc(holder, 'pic') || !!blip;
      const g: any = {
        alt: descr || ttl, decorative: dec, floating: holder.localName === 'anchor',
        type: isChart ? 'chart' : isPic ? 'picture' : 'shape',
        src: blip ? imageUrl(blip.getAttribute('r:embed')) : '',
      };
      if (txbx.length) { out.boxes.push({ content: txbx[0], floating: g.floating, alt: g.alt }); if (!isPic) return; }
      if (out.page === null) out.page = ctx.page;
      out.graphics.push(g);
    };
    const graphicFromVml = (pict: any) => {
      const shape = desc(pict, 'shape') || desc(pict, 'rect') || desc(pict, 'roundrect');
      if (!shape) return;
      const txbx = desc(pict, 'txbxContent');
      if (txbx) { out.boxes.push({ content: txbx, floating: true, alt: '' }); return; }
      const im = desc(pict, 'imagedata');
      if (out.page === null) out.page = ctx.page;
      out.graphics.push({ alt: clean(shape.getAttribute('alt') || (im && im.getAttribute('o:title')) || ''), decorative: false, floating: /position:\s*absolute/i.test(shape.getAttribute('style') || ''), type: im ? 'picture' : 'shape', src: im ? imageUrl(im.getAttribute('r:id')) : '' });
    };

    const walkInline = (el: any) => {
      for (const c of kids(el)) {
        switch (c.localName) {
          case 'r': run(c); break;
          case 'hyperlink': {
            const rid = c.getAttribute('r:id');
            const url = rid && rels.get(rid) ? rels.get(rid).target : (wv(c, 'anchor') ? '#' + wv(c, 'anchor') : '');
            const nested = !!link;
            if (!nested) openLink(url);
            walkInline(c);
            if (!nested) closeLink();
            break;
          }
          case 'fldSimple': {
            const m = /HYPERLINK\s+(?:\\l\s+)?"([^"]*)"/i.exec(wv(c, 'instr') || '');
            if (m && !link) { openLink(m[1]); walkInline(c); closeLink(); } else walkInline(c);
            break;
          }
          case 'sdt': walkInline(kid(c, 'sdtContent')); break;
          case 'ins': case 'smartTag': case 'customXml': case 'moveTo': case 'bdo': case 'dir': walkInline(c); break;
          case 'AlternateContent': { const ch = kid(c, 'Choice') || kid(c, 'Fallback'); if (ch) walkInline(ch); break; }
          default: break; // del, moveFrom, bookmarks, proofErr, pPr
        }
      }
    };
    walkInline(p);
    closeLink();
    if (out.page === null) out.page = ctx.page;
    out.text = clean(out.text);
    out.speech = clean(out.speech.replace(/\s+,/g, ','));
    out.disp = clean(out.disp);
    return out;
  }

  /* ----- Emit helpers ----- */
  const closeLists = (toLevel = -1) => {
    while (ctx.list.length && ctx.list[ctx.list.length - 1].ilvl > toLevel) {
      const L = ctx.list.pop();
      const lbl = `${L.count} item${L.count === 1 ? '' : 's'}`;
      L.item.display = `List with ${lbl}`;
      L.item.speech = `list with ${lbl}${L.depth > 1 ? `, nesting level ${L.depth}` : ''}`;
      const m = add({ kind: 'marker', role: L.item.role, page: ctx.page, display: 'Out of list', speech: 'out of list' });
      html.push(`<div class="dv-marker" data-n="${m.n}"></div>`);
      void m;
    }
  };

  const linkChecks = (item: any, links: any) => {
    for (const l of links) {
      ctx.links++;
      const t = clean(l.text);
      if (!t) flag(item, 'problem', `A link has no text${l.url ? ` (${l.url})` : ''}. Screen readers announce only "link".`, 'link');
      else if (/^(https?:\/\/|www\.)\S+$/i.test(t) && t.length > 30) flag(item, 'review', 'Link text is a long web address. Screen readers read it out piece by piece. Use words that describe where the link goes.', 'link');
      else if (VAGUE_LINK.has(t.toLowerCase())) flag(item, 'review', `Link text "${t}" does not say where it goes. Screen reader users often browse a list of links out of context.`, 'link');
    }
  };

  const emitGraphics = (graphics: any, page: any) => {
    for (const g of graphics) {
      if (g.decorative) {
        html.push(g.src ? `<div class="dv-img dv-dec"><img src="${g.src}" alt=""></div>` : '');
        continue; // decorative images are skipped by screen readers
      }
      const word = g.type === 'chart' ? 'chart' : 'graphic';
      const it = add({ kind: 'graphic', role: g.type === 'chart' ? 'Chart' : 'Graphic', page, display: g.alt || '(no alternative text)', speech: g.alt ? `${word}, ${g.alt}` : `unlabeled ${word}` });
      html.push(`<div class="dv-img" data-n="${it.n}">${g.src ? `<img src="${g.src}" alt="">` : `<span class="dv-shape">${esc(g.type === 'chart' ? 'Chart' : 'Shape')}</span>`}</div>`);
      if (!g.alt) flag(it, 'problem', `${g.type === 'chart' ? 'Chart' : g.type === 'shape' ? 'Shape' : 'Image'} has no alternative text. In Word, right-click it, choose View Alt Text, and describe it or mark it as decorative.`, 'alt');
      else if (/\.(png|jpe?g|gif|bmp|tiff?|svg|webp)$/i.test(g.alt) || /^(image|picture|graphic|figure|photo|screenshot)\s*\d*$/i.test(g.alt) || /^(a )?(picture|close up|screenshot) (of|containing)/i.test(g.alt) && /description automatically generated/i.test(g.alt)) {
        flag(it, 'review', `Alt text "${g.alt}" looks like a file name or placeholder. Describe what the image shows.`, 'alt');
      } else if (/description automatically generated/i.test(g.alt)) {
        flag(it, 'review', 'This alt text was generated automatically by Word. Check that it describes the image accurately.', 'alt');
      }
      if (g.floating) flag(it, 'review', 'This object floats with text wrapping. A screen reader may reach it in a different place than it appears. Set it to "In Line with Text" if order matters.', 'order');
    }
  };

  const emitBoxes = (boxes: any) => {
    for (const b of boxes) {
      const startN = items.length;
      html.push('<div class="dv-box">');
      walkBlocks(b.content);
      closeLists();
      html.push('</div>');
      const first = items[startN];
      if (first) flag(first, 'review', 'This text is in a text box. Screen readers may read it in a different place than it appears, or skip it. Consider moving it into the main text.', 'order');
    }
  };

  function emitParagraph(p: any) {
    const P = readParagraph(p);
    const level = styleHeading(S, P.styleId);
    const numPr = P.numPr || styleNum(S, P.styleId);
    const lvl = numPr && numPr.numId && numPr.numId !== '0' ? numLevel(N, numPr.numId, numPr.ilvl || 0) : null;
    const isList = !!lvl && !level;
    const empty = !P.text && !P.graphics.length && !P.boxes.length && P.speech === '';

    if (!isList) closeLists();

    if (empty) {
      if (ctx.inTable) return;
      ctx.blankRun++;
      const it = add({ kind: 'blank', role: 'Blank', page: P.page, display: 'Blank', speech: 'blank' });
      html.push(`<div class="dv-blank" data-n="${it.n}">&nbsp;</div>`);
      if (ctx.blankRun === 3) flag(it, 'review', 'Several blank lines in a row are used for spacing. Screen readers announce each one as "blank." Use paragraph spacing or a page break instead.', 'blank');
      ctx.fake = null;
      return;
    }
    ctx.blankRun = 0;

    let item: any = null;
    if (P.text || P.speech) {
      if (level) {
        const speech = `heading level ${level}, ${P.speech || 'blank'}`;
        item = add({ kind: 'heading', role: `Heading ${level}`, level, page: P.page, display: P.disp || '(empty heading)', speech, links: P.links.length });
        ctx.headingCount++;
        if (!P.text) flag(item, 'problem', 'Empty heading. Screen readers announce "heading, blank."', 'heading');
        if (ctx.lastHeading === 0 && level > 2) flag(item, 'review', `The first heading is level ${level}. Most documents start with a level 1 heading.`, 'heading');
        else if (ctx.lastHeading && level > ctx.lastHeading + 1) flag(item, 'problem', `Heading level skipped: jumps from level ${ctx.lastHeading} to level ${level}.`, 'heading');
        ctx.lastHeading = level;
        html.push(`<div class="dv-h dv-h${Math.min(level, 6)}" data-n="${item.n}">${esc(P.disp)}</div>`);
        ctx.fake = null;
      } else if (isList) {
        const ilvl = numPr.ilvl || 0;
        // close deeper levels, open a new level if needed
        closeLists(ilvl);
        let top = ctx.list[ctx.list.length - 1];
        if (top && top.ilvl === ilvl && top.numId !== numPr.numId && ilvl === 0) { closeLists(-1); top = null; }
        if (!top || top.ilvl < ilvl) {
          const depth = ctx.list.length + 1;
          const start = add({ kind: 'list', role: depth > 1 ? `List, level ${depth}` : 'List', page: P.page, display: 'List', speech: 'list' });
          html.push(`<div class="dv-marker" data-n="${start.n}"></div>`);
          ctx.list.push({ ilvl, numId: numPr.numId, count: 0, item: start, depth });
          top = ctx.list[ctx.list.length - 1];
        }
        top.count++;
        // counters
        const key = numPr.numId;
        let ctr = ctx.counters.get(key);
        if (!ctr) { ctr = []; ctx.counters.set(key, ctr); }
        ctr[ilvl] = ctr[ilvl] === undefined ? lvl.start : ctr[ilvl] + 1;
        for (let k = ilvl + 1; k < 9; k++) ctr[k] = undefined;
        let label = '';
        if (lvl.fmt === 'bullet') label = 'bullet';
        else if (lvl.fmt !== 'none') {
          label = (lvl.text || `%${ilvl + 1}.`).replace(/%([1-9])/g, (_: any, d: any) => {
            const k = Number(d) - 1;
            const L = numLevel(N, numPr.numId, k) || lvl;
            const v = ctr[k] === undefined ? L.start : ctr[k];
            return fmtNum(v, k === ilvl ? lvl.fmt : L.fmt);
          });
        }
        const dl = label === 'bullet' ? '•' : label;
        item = add({ kind: 'listitem', role: 'List item', page: P.page, display: `${dl ? dl + ' ' : ''}${P.disp}`.trim() || '(empty list item)', speech: `${label ? label + ', ' : ''}${P.speech || 'blank'}`, links: P.links.length });
        html.push(`<div class="dv-li" style="--lvl:${ctx.list.length - 1}" data-n="${item.n}"><span class="dv-lbl">${esc(dl)}</span>${esc(P.disp)}</div>`);
        ctx.fake = null;
      } else {
        const isTitle = styleIsTitle(S, P.styleId);
        item = add({ kind: 'para', role: 'Text', page: P.page, display: P.disp, speech: P.speech, links: P.links.length, linkText: P.links.length ? true : undefined });
        if (P.links.length) item.role = 'Text · link';
        html.push(`<div class="dv-p${isTitle ? ' dv-title' : ''}" data-n="${item.n}">${esc(P.disp)}</div>`);
        if (isTitle && !ctx.titleStyleItem) ctx.titleStyleItem = item;
        if (!ctx.inTable) {
          // Bold line that looks like a heading
          const t = P.text;
          if (!isTitle && P.boldChars > 0 && P.plainChars === 0 && t.length <= 80 && !/[.:;?!,]$/.test(t) && !P.links.length && /[A-Za-z]/.test(t)) {
            flag(item, 'review', 'This bold line looks like a heading but uses a regular text style. If it starts a section, apply a Heading style so screen readers can find it.', 'fakeheading');
          }
          // Hand-typed list
          if (FAKE_LIST_RE.test(t)) {
            if (ctx.fake && !ctx.fake.flagged) { flag(ctx.fake.item, 'review', 'These lines look like a list typed by hand. Use the Bullets or Numbering button so screen readers announce a list and count its items.', 'fakelist'); ctx.fake.flagged = true; }
            if (!ctx.fake) ctx.fake = { item, flagged: false };
          } else ctx.fake = null;
        }
      }
      if (item) linkChecks(item, P.links);
    }
    emitGraphics(P.graphics, P.page);
    emitBoxes(P.boxes);
  }

  function emitTable(tbl: any) {
    closeLists();
    ctx.fake = null; ctx.blankRun = 0;
    const rows: any[] = [];
    const visitRows = (el: any) => { for (const c of kids(el)) { if (c.localName === 'tr') rows.push(c); else if (c.localName === 'sdt') visitRows(kid(c, 'sdtContent')); else if (c.localName === 'customXml') visitRows(c); } };
    visitRows(tbl);
    const grid = rows.map((tr: any) => {
      const cells: any[] = [];
      const visitCells = (el: any) => { for (const c of kids(el)) { if (c.localName === 'tc') cells.push(c); else if (c.localName === 'sdt') visitCells(kid(c, 'sdtContent')); else if (c.localName === 'customXml') visitCells(c); } };
      visitCells(tr);
      const hdr = on(kid(kid(tr, 'trPr'), 'tblHeader')) && !!kid(kid(tr, 'trPr'), 'tblHeader');
      return { tr, cells, hdr };
    });
    const cols = grid.reduce((m: any, r: any) => Math.max(m, r.cells.reduce((n: any, c: any) => n + Number(wv(kid(kid(c, 'tcPr'), 'gridSpan')) || 1), 0)), 0);
    const startPage = ctx.page;
    const dims = `${rows.length} row${rows.length === 1 ? '' : 's'} and ${cols} column${cols === 1 ? '' : 's'}`;
    const start = add({ kind: 'table', role: 'Table', page: startPage, display: `Table with ${dims}`, speech: `table with ${dims}` });
    html.push(`<table class="dv-table" data-n="${start.n}"><tbody>`);
    const single = rows.length === 1 && cols === 1;
    const headerRows: any[] = [];
    for (const r of grid) { if (r.hdr) headerRows.push(r); else break; }
    if (single) flag(start, 'review', 'One-cell table. If it is only used for a box or layout, screen readers still announce it as a table. Consider a paragraph border instead.', 'table');
    else if (!headerRows.length) flag(start, 'problem', 'Table has no header row. In Word, select the first row, then turn on Repeat Header Rows on the Table Layout tab, so screen readers can announce column headers.', 'table');

    const colHeaders: any[] = [];
    const deferred: any[] = [];
    ctx.inTable++;
    grid.forEach((row: any, ri: any) => {
      html.push('<tr>');
      let col = 0;
      row.cells.forEach((tc: any) => {
        const tcPr = kid(tc, 'tcPr');
        const span = Number(wv(kid(tcPr, 'gridSpan')) || 1);
        const vm = kid(tcPr, 'vMerge');
        const cont = vm && (wv(vm) === null || wv(vm) === 'continue');
        if (cont) { html.push(`<td class="dv-merged" colspan="${span}"></td>`); col += span; return; }
        // Collect cell text; nested lists/tables/graphics follow the cell
        const parts: any[] = [];
        let links: any[] = [];
        let page: any = null;
        const nestedTables: any[] = [];
        const graphics: any[] = [];
        const boxes: any[] = [];
        const visitCell = (el: any) => {
          for (const b of kids(el)) {
            if (b.localName === 'p') {
              const P = readParagraph(b);
              if (page === null && (P.text || P.speech)) page = P.page;
              const np = P.numPr || styleNum(S, P.styleId);
              const lv = np && np.numId && np.numId !== '0' ? numLevel(N, np.numId, np.ilvl || 0) : null;
              const pre = lv ? (lv.fmt === 'bullet' ? 'bullet, ' : '') : '';
              if (P.speech) parts.push({ s: pre + P.speech, d: (lv && lv.fmt === 'bullet' ? '• ' : '') + P.disp });
              links = links.concat(P.links);
              graphics.push(...P.graphics); boxes.push(...P.boxes);
            } else if (b.localName === 'tbl') nestedTables.push(b);
            else if (b.localName === 'sdt') visitCell(kid(b, 'sdtContent'));
            else if (b.localName === 'customXml') visitCell(b);
          }
        };
        visitCell(tc);
        const text = clean(parts.map((x: any) => x.s).join(' '));
        const disp = clean(parts.map((x: any) => x.d).join(' '));
        const isTH = row.hdr;
        if (isTH && ri === headerRows.length - 1) colHeaders[col] = clean(parts.map((x: any) => x.d).join(' '));
        const sp: any[] = [];
        if (col === 0) sp.push(`row ${ri + 1}`);
        sp.push(`column ${col + 1}`);
        if (!isTH && colHeaders[col]) sp.push(colHeaders[col]);
        const it = add({ kind: 'cell', role: isTH ? 'Header cell' : 'Cell', page: page ?? ctx.page, display: disp || '(blank)', speech: `${sp.join(', ')}, ${text || 'blank'}`, cell: `R${ri + 1} C${col + 1}`, links: links.length });
        linkChecks(it, links);
        const Tag = isTH ? 'th' : 'td';
        html.push(`<${Tag} colspan="${span}" data-n="${it.n}">${esc(disp)}`);
        // graphics and nested tables inside the cell are read right after it
        if (graphics.length || boxes.length || nestedTables.length) {
          html.push('<div class="dv-incell">');
          emitGraphics(graphics, page ?? ctx.page);
          emitBoxes(boxes);
          for (const nt of nestedTables) emitTable(nt);
          html.push('</div>');
        }
        html.push(`</${Tag}>`);
        col += span;
      });
      html.push('</tr>');
    });
    ctx.inTable--;
    html.push('</tbody></table>');
    void deferred;
    const end = add({ kind: 'marker', role: 'Table', page: ctx.page, display: 'Out of table', speech: 'out of table' });
    html.push(`<div class="dv-marker" data-n="${end.n}"></div>`);
  }

  function walkBlocks(container: any) {
    for (const b of kids(container)) {
      switch (b.localName) {
        case 'p': emitParagraph(b); break;
        case 'tbl': emitTable(b); break;
        case 'sdt': walkBlocks(kid(b, 'sdtContent')); break;
        case 'customXml': walkBlocks(b); break;
        case 'AlternateContent': { const ch = kid(b, 'Choice') || kid(b, 'Fallback'); if (ch) walkBlocks(ch); break; }
        default: break; // sectPr, bookmarks
      }
    }
  }

  const body = kid(docXml.documentElement, 'body');
  walkBlocks(body);
  closeLists();

  // Footnotes and endnotes, in the order they are referenced
  if (ctx.noteOrder.length) {
    for (const nref of ctx.noteOrder) {
      const fn = notes[nref.kind].get(nref.id);
      if (!fn) continue;
      const parts: any[] = [];
      for (const p of descAll(fn, 'p')) { const P = readParagraph(p); if (P.speech) parts.push(P.speech); }
      const t = clean(parts.join(' ')).replace(/^\d+\s*/, '');
      const it = add({ kind: 'para', role: 'Note', page: ctx.page, display: `${nref.label}. ${t}`, speech: `${nref.kind} ${nref.label}, ${t || 'blank'}` });
      html.push(`<div class="dv-note" data-n="${it.n}"><sup>${nref.label}</sup> ${esc(t)}</div>`);
    }
  }

  if (ctx.headingCount === 0 && items.length > 6) flag(docItem, 'problem', 'No headings found. Screen reader users cannot jump between sections. Use Word\'s Heading 1, Heading 2, and so on.', 'heading');
  if (ctx.titleStyleItem && !items.some((i: any) => i.kind === 'heading' && i.level === 1)) {
    flag(ctx.titleStyleItem, 'review', 'This line uses Word\'s Title style, which screen readers do not treat as a heading. Use Heading 1 for the main title so it shows up in heading navigation.', 'heading');
  }

  const textChars = items.reduce((n: any, i: any) => n + (['para', 'heading', 'listitem', 'cell'].includes(i.kind) ? i.display.length : 0), 0);
  if (textChars === 0) {
    flag(docItem, 'problem', items.some((i: any) => i.kind === 'graphic') ? 'No readable text was found, only images. If these are pictures of text, screen readers cannot read them.' : 'This document has no readable text.', 'scan');
  }

  const pages = Math.max(appPages || 0, ctx.page, 1);
  const end = add({ kind: 'end', role: 'End', page: ctx.page, display: 'End of document', speech: 'End of document' });
  html.push(`<div class="dv-marker" data-n="${end.n}"></div>`);

  const counts: any = {
    pages,
    headings: items.filter((i: any) => i.kind === 'heading').length,
    graphics: items.filter((i: any) => i.kind === 'graphic').length,
    missingAlt: issues.filter((i: any) => i.kind === 'alt' && i.severity === 'problem').length,
    tables: items.filter((i: any) => i.kind === 'table').length,
    lists: items.filter((i: any) => i.kind === 'list').length,
    links: ctx.links,
    fields: 0,
  };
  return { format: 'docx', items, issues, title, displayTitle: true, lang, tagged: true, counts, name, html: html.join(''), blobUrls };
}
