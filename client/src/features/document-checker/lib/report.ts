import { countByStatus, scoreBand, STATUS_LABEL, type Report } from './types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DISCLAIMER =
  'Automated testing cannot confirm full conformance with WCAG, Section 508, or PDF/UA. These checks cover machine-detectable properties only; manual review with assistive technology is still necessary.';

export function buildReportHtml(report: Report): string {
  const counts = countByStatus(report.findings);
  const rows = report.findings
    .map(
      (f) => `
      <section class="finding ${f.status}">
        <h3>${esc(f.title)} <span class="badge">${STATUS_LABEL[f.status]}</span></h3>
        <p class="cat">${esc(f.category)}</p>
        <p class="sum">${esc(f.summary)}</p>
        <h4>Why this matters</h4>
        <p>${esc(f.why)}</p>
        <h4>How to fix it</h4>
        <p>${esc(f.fix)}</p>
        ${
          f.details && f.details.length
            ? `<h4>Observations</h4><ul>${f.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
            : ''
        }
        ${
          f.locations && f.locations.length
            ? `<h4>Where</h4><ul>${f.locations.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
            : ''
        }
        ${f.refs && f.refs.length ? `<p class="refs">Related: ${esc(f.refs.join(' · '))}</p>` : ''}
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Remedy508 Document Check report — ${esc(report.fileName)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; background: #faf6f1; margin: 0; padding: 40px 20px; line-height: 1.6; }
  main { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 32px 0 10px; }
  h3 { font-size: 17px; margin: 0 0 4px; }
  h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #4b5768; margin: 14px 0 4px; }
  p { margin: 0 0 6px; }
  .meta { color: #4b5768; font-size: 14px; }
  .score { font-size: 44px; font-weight: 700; margin: 8px 0 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 15px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f3f4f6; }
  .finding { border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; margin-top: 14px; }
  .finding.critical { border-left: 5px solid #b42318; }
  .finding.warning { border-left: 5px solid #92590b; }
  .finding.passed { border-left: 5px solid #146c43; }
  .finding.review { border-left: 5px solid #3f4c5f; }
  .badge { font-size: 12px; font-weight: 700; border: 1px solid currentColor; border-radius: 6px; padding: 2px 8px; vertical-align: middle; }
  .critical .badge { color: #b42318; }
  .warning .badge { color: #92590b; }
  .passed .badge { color: #146c43; }
  .review .badge { color: #3f4c5f; }
  .cat { font-size: 13px; color: #4b5768; }
  .sum { font-weight: 600; }
  .refs { font-size: 13px; color: #4b5768; }
  .disclaimer { margin-top: 28px; padding: 14px 16px; background: #f3f4f6; border-radius: 10px; font-size: 14px; color: #374151; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  a { color: #0f766e; }
</style>
</head>
<body>
<main>
  <h1>Remedy508 Document Check report</h1>
  <p class="meta">${esc(report.fileName)} · ${esc(report.kind)} · ${esc(report.fileSizeLabel)} · generated ${esc(report.generatedAt)}${report.isSample ? ' · SAMPLE REPORT (fabricated demonstration data)' : ''}</p>

  <h2>Automated findings score</h2>
  <p class="score">${report.score} / 100</p>
  <p class="meta">${esc(scoreBand(report.score))}. This score reflects confirmed automated findings only. Manual-review items are not deducted. It is not an Acrobat or compliance score.</p>

  <table>
    <caption class="meta" style="text-align:left;padding-bottom:6px">Findings by status</caption>
    <tr><th>Critical</th><th>Warning</th><th>Needs review</th><th>Passed</th></tr>
    <tr><td>${counts.critical}</td><td>${counts.warning}</td><td>${counts.review}</td><td>${counts.passed}</td></tr>
  </table>

  <h2>Document properties</h2>
  <table>
    ${report.facts.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`).join('')}
  </table>

  <h2>Findings</h2>
  ${rows}

  ${
    report.parseNotes && report.parseNotes.length
      ? `<h2>Scan notes</h2><ul>${report.parseNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
      : ''
  }

  <p class="disclaimer"><strong>Important:</strong> ${esc(DISCLAIMER)}</p>
  <p class="meta" style="margin-top:16px">Produced by Remedy508 Document Check — a free preflight from Remedy508, a product of Left Coast Learning LLC. Remediation help: <a href="https://remedy508.com/tools">remedy508.com/tools</a></p>
</main>
</body>
</html>`;
}

export function downloadReport(report: Report): void {
  const html = buildReportHtml(report);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const base = report.fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-');
  a.href = url;
  a.download = `remedy508-preflight-${base || 'report'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
