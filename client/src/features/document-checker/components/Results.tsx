import { useMemo, useState } from 'react';
import {
  CircleCheck,
  Download,
  Eye,
  ChevronDown,
  Info,
  OctagonAlert,
  RotateCcw,
  SearchCheck,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import {
  countByStatus,
  scoreBand,
  STATUS_LABEL,
  STATUS_ORDER,
  type Report,
  type Status,
} from '../lib/types';
import { DISCLAIMER, downloadReport } from '../lib/report';

const PRODUCT_URL = '/pricing';

type FilterKey = 'all' | Status;

const STATUS_ICON: Record<Status, typeof CircleCheck> = {
  critical: OctagonAlert,
  warning: TriangleAlert,
  passed: CircleCheck,
  review: Eye,
};

function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`status-badge status-${status}`} data-testid={`badge-status-${status}`}>
      <Icon size={14} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Results({ report, onReset }: { report: Report; onReset: () => void }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => countByStatus(report.findings), [report.findings]);
  const ordered = useMemo(
    () =>
      [...report.findings].sort(
        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
      ),
    [report.findings],
  );
  const visible = filter === 'all' ? ordered : ordered.filter((f) => f.status === filter);

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: report.findings.length },
    { key: 'critical', label: 'Critical', count: counts.critical },
    { key: 'warning', label: 'Warnings', count: counts.warning },
    { key: 'review', label: 'Needs review', count: counts.review },
    { key: 'passed', label: 'Passed', count: counts.passed },
  ];

  return (
    <section className="results wrap" aria-labelledby="results-title">
      <div className="results-head">
        <div>
          <h1 id="results-title">Accessibility check results</h1>
          <p className="file-chip" data-testid="text-file-summary">
            <strong>{report.fileName}</strong>
            <span className="dot" aria-hidden="true">
              ·
            </span>
            <span>{report.kind}</span>
            <span className="dot" aria-hidden="true">
              ·
            </span>
            <span>{report.fileSizeLabel}</span>
            <span className="dot" aria-hidden="true">
              ·
            </span>
            <span>Checked {report.generatedAt}</span>
          </p>
        </div>
        <div className="results-actions">
          <button type="button" className="btn btn-secondary" onClick={onReset} data-testid="button-reset">
            <RotateCcw size={17} aria-hidden="true" />
            Check another document
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void downloadReport(report)}
            data-testid="button-download"
          >
            <Download size={17} aria-hidden="true" />
            Download report
          </button>
          <a
            className="btn btn-primary ext"
            href={PRODUCT_URL}
            data-testid="link-remedy508"
          >
            <Wrench size={17} aria-hidden="true" />
            Fix with Remedy508
          </a>
        </div>
      </div>

      <div className="score-panel">
        <div className="score-box">
          <p className="score-label" id="score-label">
            Automated findings score
          </p>
          <p className="score-value num" data-testid="text-score" aria-describedby="score-label">
            {report.score}
            <small>/100</small>
          </p>
          <div
            className="score-meter"
            role="img"
            aria-label={`Automated accessibility check score ${report.score} out of 100. ${scoreBand(report.score)}.`}
          >
            <div style={{ width: `${report.score}%` }} />
          </div>
          <p className="score-band">{scoreBand(report.score)}</p>
          <p className="score-note">
            Confirmed automated findings only. Manual-review items are not deducted. This is not an Acrobat or
            compliance score.
          </p>
        </div>
        <div className="tally">
          {(['critical', 'warning', 'review', 'passed'] as Status[]).map((s) => {
            const Icon = STATUS_ICON[s];
            return (
              <div className="tally-item" key={s}>
                <span className="k" style={{ color: `var(--${s === 'review' ? 'review' : s})` }}>
                  <Icon size={15} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </span>
                <span className="v" data-testid={`count-${s}`}>
                  {counts[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <dl className="facts" data-testid="list-facts">
        {report.facts.map((f) => (
          <div className="fact" key={f.label}>
            <dt>{f.label}</dt>
            <dd className={/^\d[\d,]*$/.test(f.value) ? 'num' : undefined}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <p className="disclaimer" data-testid="text-disclaimer">
        <Info size={18} aria-hidden="true" />
        <span>
          <strong>Automated checks only.</strong> {DISCLAIMER}
        </span>
      </p>

      {report.parseNotes && report.parseNotes.length > 0 && (
        <p className="disclaimer" data-testid="text-scan-notes">
          <SearchCheck size={18} aria-hidden="true" />
          <span>
            <strong>Scan notes.</strong> {report.parseNotes.join(' ')}
          </span>
        </p>
      )}

      <h2 className="sr-only">Findings</h2>
      <div className="filter-bar" role="group" aria-label="Filter findings by status">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className="filter-btn"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
            <span className="count">({f.count})</span>
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only" data-testid="text-filter-status">
        Showing {visible.length} of {report.findings.length} findings
        {filter === 'all' ? '' : ` with status ${STATUS_LABEL[filter as Status]}`}.
      </p>

      {visible.length === 0 ? (
        <div className="empty-findings" data-testid="empty-findings">
          <CircleCheck size={28} aria-hidden="true" />
          <p style={{ marginTop: 10, fontWeight: 600 }}>Nothing in this category</p>
          <p>No findings match the current filter. Choose “All” to see every check that was run.</p>
        </div>
      ) : (
        <ul className="findings" data-testid="list-findings">
          {visible.map((f) => {
            const isOpen = Boolean(open[f.id]);
            return (
              <li className="finding" key={f.id} data-testid={`finding-${f.id}`}>
                <button
                  type="button"
                  className="finding-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`panel-${f.id}`}
                  id={`toggle-${f.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
                  data-testid={`toggle-${f.id}`}
                >
                  <StatusBadge status={f.status} />
                  <span>
                    <span className="finding-title">{f.title}</span>
                    <span className="finding-summary" style={{ display: 'block' }}>
                      {f.summary}
                    </span>
                  </span>
                  <ChevronDown className="chev" size={20} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div
                    className="finding-body"
                    id={`panel-${f.id}`}
                    role="region"
                    aria-labelledby={`toggle-${f.id}`}
                    data-testid={`panel-${f.id}`}
                  >
                    <div className="body-grid">
                      <div>
                        <h4>Why this matters</h4>
                        <p>{f.why}</p>
                      </div>
                      <div>
                        <h4>How to fix it</h4>
                        <p>{f.fix}</p>
                      </div>
                    </div>
                    {f.details && f.details.length > 0 && (
                      <div>
                        <h4>What the scan saw</h4>
                        <ul className="detail-list">
                          {f.details.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {f.locations && f.locations.length > 0 && (
                      <div>
                        <h4>Where</h4>
                        <div className="locations">
                          {f.locations.map((l) => (
                            <span className="loc-chip" key={l}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {f.refs && f.refs.length > 0 && (
                      <div>
                        <h4>Related criteria</h4>
                        <p style={{ fontSize: 14 }}>{f.refs.join(' · ')}</p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="cta-panel">
        <div>
          <h2>Ready for remediation assistance?</h2>
          <p>
            Remedy508 provides automated document accessibility remediation for structure, reading order, alternative
            text, and form labels, then returns the updated document with a summary of enhancements.
          </p>
        </div>
        <a
          className="btn btn-primary btn-lg ext"
          href={PRODUCT_URL}
          data-testid="link-remedy508-cta"
        >
          Fix with Remedy508
        </a>
      </div>
    </section>
  );
}
