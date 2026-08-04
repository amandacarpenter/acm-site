// Injects per-route SEO metadata (title, description, canonical, Open Graph,
// Twitter Card, JSON-LD) into the SPA's index.html before it's sent to the
// client. This is what lets crawlers and link-preview bots that don't run
// JS see real per-page metadata, since the app itself is a client-rendered
// Vite/React SPA with no server-side rendering.
import { getRouteMeta, SITE_URL, DEFAULT_OG_IMAGE } from "../shared/seo";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function softwareApplicationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Remedy508",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered accessibility remediation for higher education course materials. Fix PDFs and Word docs, generate alt text, clean Canvas HTML, and caption videos to meet WCAG 2.1 AA.",
    url: SITE_URL,
    image: DEFAULT_OG_IMAGE,
    offers: [
      {
        "@type": "Offer",
        name: "Individual Monthly",
        price: "19.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
      {
        "@type": "Offer",
        name: "Individual Annual",
        price: "199.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "249.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        url: `${SITE_URL}/pricing`,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: "Left Coast Learning LLC",
    },
  });
}

/**
 * Rewrites the <title>, meta description, and adds canonical/OG/Twitter/JSON-LD
 * tags for the given request path. Falls back to the template's existing
 * title/description when the path has no registered SEO metadata (e.g.
 * auth-gated routes like /dashboard, /admin).
 */
export function injectSeoMeta(html: string, requestPath: string): string {
  const meta = getRouteMeta(requestPath);
  if (!meta) return html;

  const canonicalUrl = `${SITE_URL}${requestPath === "/" ? "" : requestPath}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);

  let result = html;

  // Replace <title>...</title>
  result = result.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

  // Replace the existing meta description
  result = result.replace(
    /<meta name="description" content=".*?" \/>/i,
    `<meta name="description" content="${description}" />`,
  );

  const extraTags: string[] = [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Remedy508" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />`,
  ];

  if (meta.jsonLd === "software") {
    extraTags.push(`<script type="application/ld+json">${softwareApplicationJsonLd()}</script>`);
  }

  result = result.replace("</head>", `  ${extraTags.join("\n  ")}\n</head>`);

  return result;
}
