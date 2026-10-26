import test from "node:test";
import assert from "node:assert/strict";
import { injectSeoMeta } from "./seo-html";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_ALT } from "../shared/seo";

const template = '<html><head><title>Old</title><meta name="description" content="Old" /></head><body></body></html>';

test("homepage serves the current sharing image without client-side JavaScript", () => {
  const html = injectSeoMeta(template, "/");
  assert.ok(html.includes(`<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />`));
  assert.ok(html.includes(`<meta property="og:image:alt" content="${DEFAULT_OG_IMAGE_ALT}" />`));
  assert.ok(html.includes(`"image":"${DEFAULT_OG_IMAGE}"`));
  assert.ok(!html.includes("/og-image.png"));
});

test("other public pages use the new default while blog imagery stays separate", () => {
  assert.ok(injectSeoMeta(template, "/pricing").includes(DEFAULT_OG_IMAGE));
  const blog = injectSeoMeta(template, "/blog");
  assert.ok(blog.includes("/blog-images/insights-hero.webp"));
  assert.ok(!blog.includes(DEFAULT_OG_IMAGE_ALT));
});
