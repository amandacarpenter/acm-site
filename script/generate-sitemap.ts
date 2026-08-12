// Build-time sitemap.xml generator. Runs after the Vite client build so it
// can write directly into dist/public alongside the other static assets.
//
// KB article ids/titles are read by parsing server/kb.ts as text (not
// importing the module) because kb.ts opens a live better-sqlite3 connection
// at import time -- we don't want a DB side-effect during a static build.
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { getBlogRouteMeta, ROUTES, SITE_URL } from "../shared/seo";

const OUT_PATH = path.resolve(import.meta.dirname, "..", "dist", "public", "sitemap.xml");
const KB_TS_PATH = path.resolve(import.meta.dirname, "..", "server", "kb.ts");

interface KbEntry {
  id: string;
}

async function extractKbIds(): Promise<KbEntry[]> {
  const content = await readFile(KB_TS_PATH, "utf-8");
  const pattern = /\{\s*id:\s*["']([^"']+)["']/g;
  const ids: KbEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    ids.push({ id: match[1] });
  }
  return ids;
}

function urlEntry(loc: string, changefreq: string, priority: number, lastmod?: string): string {
  const lastmodLine = lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "";
  return `  <url>\n    <loc>${loc}</loc>\n${lastmodLine}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
}

export async function generateSitemap() {
  const entries: string[] = [];

  for (const route of ROUTES) {
    entries.push(urlEntry(`${SITE_URL}${route.path}`, route.changefreq, route.priority));
  }

  // Remedy508 Insights posts come from shared/blog.ts, which is a plain data
  // module with no database side effects, so it is safe to import here.
  for (const post of getBlogRouteMeta()) {
    entries.push(urlEntry(`${SITE_URL}${post.path}`, post.changefreq, post.priority, post.lastmod));
  }

  const kbArticles = await extractKbIds();
  for (const article of kbArticles) {
    entries.push(urlEntry(`${SITE_URL}/kb/articles/${article.id}`, "monthly", 0.5));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  await writeFile(OUT_PATH, xml, "utf-8");
  console.log(`sitemap.xml written with ${entries.length} URLs -> ${OUT_PATH}`);
}

// Allow running standalone: tsx script/generate-sitemap.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
