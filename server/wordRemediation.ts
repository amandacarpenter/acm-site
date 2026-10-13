import { parseFragment, serializeOuter } from "parse5";

export type WordBlock = { id: string; html: string; locked: boolean };
export type WordPlan = { blocks: WordBlock[]; batches: WordBlock[][]; lockedTables: number };
const marker = /\[\[REMEDY_IMG_[\w]+\]\]/;
const textContent = (node: any): string =>
  node.nodeName === "#text" ? node.value : (node.childNodes || []).map(textContent).join("");
const normalizedText = (html: string) =>
  textContent(parseFragment(html)).normalize("NFKC").replace(/\s+/g, "").replace(/\u00ad/g, "");
const unsafe = /<(?:img|svg|object|embed|script|iframe)\b|REMEDY_IMG_|\[Image\s*[—–-]/i;

/** Image-containing source blocks never enter the AI request. In particular,
 * tables are atomic: a cell's picture cannot migrate to another cell.
 */
export function planWordRemediation(html: string, maxLength = 6000): WordPlan {
  const root = parseFragment(html);
  const blocks = root.childNodes.filter((node: any) => node.nodeName !== "#comment")
    .map((node: any, i) => {
      const html = serializeOuter(node);
      return { id: `b${i}`, html, locked: marker.test(html) };
    });
  const batches: WordBlock[][] = [];
  let batch: WordBlock[] = [], length = 0;
  for (const block of blocks.filter(block => !block.locked && block.html.trim())) {
    // Never split a table or paragraph. Oversized blocks retain source structure
    // rather than risking a truncated model response.
    if (block.html.length > 14000) continue;
    if (batch.length && length + block.html.length > maxLength) {
      batches.push(batch); batch = []; length = 0;
    }
    batch.push(block); length += block.html.length;
  }
  if (batch.length) batches.push(batch);
  return { blocks, batches, lockedTables: blocks.filter(block => block.locked && /<table\b/i.test(block.html)).length };
}

export function assembleWordRemediation(plan: WordPlan, responses: string[]) {
  const replacements = new Map<string, string>();
  const retained: string[] = [];
  for (let i = 0; i < plan.batches.length; i++) {
    const batch = plan.batches[i];
    let entries: any[] = [];
    try {
      const raw = (responses[i] || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.blocks)) entries = parsed.blocks;
    } catch { /* Preserve source blocks; report the review requirement below. */ }
    for (const block of batch) {
      const matches = entries.filter(entry => entry?.id === block.id);
      const result = matches.length === 1 && typeof matches[0].html === "string" ? matches[0].html : "";
      if (result && !unsafe.test(result) && normalizedText(result) === normalizedText(block.html)) {
        // Parse each result separately so a malformed wrapper cannot swallow a
        // protected sibling block when the final document is assembled.
        replacements.set(block.id, parseFragment(result).childNodes.map(node => serializeOuter(node)).join(""));
      } else {
        retained.push(block.id);
      }
    }
  }
  const scheduled = new Set(plan.batches.flat().map(block => block.id));
  for (const block of plan.blocks) {
    if (!block.locked && block.html.trim() && !scheduled.has(block.id)) retained.push(block.id);
  }
  return {
    html: plan.blocks.map(block => block.locked ? block.html : replacements.get(block.id) ?? block.html).join("\n"),
    retainedBlocks: retained.length,
    protectedBlocks: plan.blocks.filter(block => block.locked).length,
    lockedTables: plan.lockedTables,
  };
}
