// Shared editorial types and prose primitives for Remedy508 Insights.
// Imported by content.tsx and content-expansion.tsx so every article uses the
// same type scale, spacing, citation styling, and table treatment.
import type { ReactNode } from "react";
import { Link } from "wouter";

export interface BlogResource {
  label: string;
  href: string;
  publisher: string;
  note: string;
}

export interface RelatedGuide {
  id: string;
  title: string;
}

export interface BlogPostContent {
  body: ReactNode;
  resources: BlogResource[];
  relatedGuides: RelatedGuide[];
  cta: { heading: string; body: string; action: string };
}

/* ------------------------------------------------------------------ */
/* Small prose primitives so every article shares the same typography. */
/* ------------------------------------------------------------------ */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 mb-4 text-2xl sm:text-[1.75rem] font-bold text-[#111827] leading-snug scroll-mt-28">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 mb-3 text-lg font-bold text-[#0f766e] leading-snug">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-[1.0625rem] leading-[1.75] text-gray-800">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-6 pl-5 list-disc space-y-2 text-[1.0625rem] leading-[1.7] text-gray-800 marker:text-[#0f766e]">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mb-6 pl-5 list-decimal space-y-3 text-[1.0625rem] leading-[1.7] text-gray-800 marker:text-[#0f766e] marker:font-bold">
      {children}
    </ol>
  );
}

/** Inline citation to an external, authoritative source. */
export function Cite({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${children} (opens in a new tab)`}
      className="font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
    >
      {children}
    </a>
  );
}

/** Inline link to another page on remedy508.com. */
export function Internal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">
      {children}
    </Link>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-8 border border-[#0f766e]/20 bg-gray-50 px-5 py-4">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0f766e] mb-2">{title}</p>
      <div className="text-[1rem] leading-relaxed text-gray-800 [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}

/**
 * A content-bearing editorial figure built from HTML and CSS rather than a
 * decorative illustration. Each row states what a checker can decide on its
 * own and what a person still has to decide.
 */
export function DetectionTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { item: string; automated: string; human: string }[];
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto border border-gray-200">
        <table className="w-full border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[#3a485b] text-white">
              <th scope="col" className="px-4 py-3 font-bold">
                What you are checking
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                A tool can decide
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                A person must decide
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.item} className={index % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                <th scope="row" className="px-4 py-3 align-top font-semibold text-[#111827]">
                  {row.item}
                </th>
                <td className="px-4 py-3 align-top text-gray-800">{row.automated}</td>
                <td className="px-4 py-3 align-top text-gray-800">{row.human}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-sm text-gray-700">{caption}</figcaption>
    </figure>
  );
}

/**
 * A generic comparison table for articles that need to line up two or three
 * columns of short, scannable facts. Header cells are real <th> elements with
 * scope, and the wrapper scrolls horizontally on narrow screens.
 */
export function SimpleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto border border-gray-200">
        <table className="w-full border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[#3a485b] text-white">
              {headers.map((header) => (
                <th key={header} scope="col" className="px-4 py-3 font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row[0]} className={index % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                <th scope="row" className="px-4 py-3 align-top font-semibold text-[#111827]">
                  {row[0]}
                </th>
                {row.slice(1).map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top text-gray-800">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-sm text-gray-700">{caption}</figcaption>
    </figure>
  );
}
