import JSZip from 'jszip';

export type Zip = JSZip;

export async function openZip(file: File | Blob): Promise<JSZip> {
  return JSZip.loadAsync(file);
}

export async function readXml(zip: JSZip, path: string): Promise<Document | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  const text = await entry.async('string');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

/** Match elements by qualified tag name (works for prefixed OOXML names). */
export function tags(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName(name));
}

/** Match elements by local name regardless of prefix. */
export function localTags(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(
    (el) => el.localName === local,
  );
}

/** Read an attribute by local name regardless of prefix. */
export function attrLocal(el: Element, local: string): string | null {
  for (const a of Array.from(el.attributes)) {
    if (a.localName === local) return a.value;
  }
  return null;
}

export function textOf(el: Element): string {
  return localTags(el, 't')
    .map((t) => t.textContent ?? '')
    .join('')
    .trim();
}

export function coreTitle(doc: Document | null): string | null {
  if (!doc) return null;
  const el = localTags(doc, 'title')[0];
  const v = el?.textContent?.trim();
  return v ? v : null;
}

export function coreLanguage(doc: Document | null): string | null {
  if (!doc) return null;
  const el = localTags(doc, 'language')[0];
  const v = el?.textContent?.trim();
  return v ? v : null;
}

const GENERIC_LINK_TEXT = [
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'link',
  'this link',
  'download',
  'see more',
  'details',
  'continue',
];

export function isGenericLinkText(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.>»:]+$/, '');
  return t.length > 0 && GENERIC_LINK_TEXT.includes(t);
}

export function looksLikeRawUrl(text: string): boolean {
  const t = text.trim();
  return /^(https?:\/\/|www\.)\S+$/i.test(t) && t.length > 30;
}

export function truncate(s: string, n = 60): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Titles that carry no information for a reader. */
export function isPlaceholderTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (/^(untitled|unspecified|document\d*|presentation\d*|slide\s*show|unknown|title|new document)$/.test(t))
    return true;
  if (/^microsoft (word|powerpoint) - /.test(t)) return true;
  if (/\.(docx?|pptx?|pdf|pages|key|txt|rtf)$/.test(t)) return true;
  return false;
}

/** Alt text that is present but almost certainly useless. */
export function isWeakAltText(alt: string): boolean {
  const t = alt.trim().toLowerCase();
  if (!t) return true;
  if (/\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf)$/.test(t)) return true;
  if (/^(picture|image|graphic|photo|screenshot|logo|icon|chart|diagram|content placeholder|placeholder)\s*\d*$/.test(t))
    return true;
  if (/^(img|dsc|screen shot|screenshot)[-_ ]?\d+/.test(t)) return true;
  if (t.length < 3) return true;
  return false;
}
