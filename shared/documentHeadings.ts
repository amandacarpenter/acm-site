import { parseFragment, serialize } from "parse5";

/** Repair skipped levels across the assembled document, not independently per
 * AI batch. Preserve text, pictures and relative hierarchy within each subtree.
 * This validates level order, not whether a sentence should be a heading.
 */
export function normalizeDocumentHeadings(html: string) {
  const root = parseFragment(html);
  const stack: { source: number; output: number }[] = [];
  let changes = 0;
  function visit(node: any) {
    if (/^h[1-6]$/.test(node.tagName || "")) {
      const source = Number(node.tagName[1]);
      while (stack.length && stack[stack.length - 1].source >= source) stack.pop();
      const output = Math.min(6, (stack[stack.length - 1]?.output || 0) + 1);
      stack.push({ source, output });
      if (source !== output) changes++;
      node.tagName = node.nodeName = `h${output}`;
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(root);
  return { html: serialize(root), changes };
}
