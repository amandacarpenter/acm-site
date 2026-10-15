import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  LocateFixed,
  OctagonAlert,
  Pause,
  Play,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import type { Severity, SimIssue, SimItem, SimModel } from '../lib/types';
import { captionDelay, chunks, makeUtterance, sortedVoices, synth } from '../lib/speech';
import { DocumentStage } from './DocumentStage';

const SEV_LABEL: Record<Severity, string> = { problem: 'Problem', review: 'Needs review' };
const SEV_ICON: Record<Severity, typeof Eye> = { problem: OctagonAlert, review: Eye };
const SEV_CLASS: Record<Severity, string> = { problem: 'status-critical', review: 'status-review' };

type MoveKind = 'item' | 'heading' | 'table' | 'list' | 'link' | 'graphic' | 'field' | 'issue';

const MATCH: Record<MoveKind, (it: SimItem) => boolean> = {
  item: () => true,
  heading: (it) => it.kind === 'heading',
  table: (it) => it.kind === 'table',
  list: (it) => it.kind === 'list',
  link: (it) => (it.links || 0) > 0,
  graphic: (it) => it.kind === 'graphic',
  field: (it) => it.kind === 'field',
  issue: (it) => (it.flags || []).length > 0,
};
const MOVE_NAMES: Record<MoveKind, string> = {
  item: 'item',
  heading: 'heading',
  table: 'table',
  list: 'list',
  link: 'link',
  graphic: 'graphic',
  field: 'form field',
  issue: 'issue',
};
const KEYMAP: Record<string, MoveKind> = { h: 'heading', t: 'table', l: 'list', k: 'link', g: 'graphic', f: 'field', i: 'issue' };

interface IssueGroup extends SimIssue {
  items: number[];
}

function caption(it: SimItem | undefined) {
  if (!it) return '';
  return it.speech.charAt(0).toUpperCase() + it.speech.slice(1);
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEV_ICON[severity];
  return (
    <span className={`status-badge ${SEV_CLASS[severity]}`}>
      <Icon size={14} aria-hidden="true" />
      {SEV_LABEL[severity]}
    </span>
  );
}

export function SimResults({ model, onReset, onPlayback }: { model: SimModel; onReset: () => void; onPlayback?: () => void }) {
  const { isSignedIn } = useAuth();
  const remediationUrl = isSignedIn ? '/dashboard' : '/pricing';
  const uid = useId().replace(/:/g, '');
  const items = model.items;

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [moveBy, setMoveBy] = useState<MoveKind>('item');
  const [voiceOn, setVoiceOn] = useState(Boolean(synth));
  const [rate, setRate] = useState(1.1);
  const [voiceURI, setVoiceURI] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notice, setNotice] = useState('');

  const transcriptRef = useRef<HTMLOListElement>(null);
  const live = useRef({ index: 0, playing: false, voiceOn: Boolean(synth), rate: 1.1, voiceURI: '', token: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const selectRef = useRef<(i: number, opts?: { speak?: boolean; scroll?: boolean }) => void>(() => {});

  live.current.voiceOn = voiceOn;
  live.current.rate = rate;
  live.current.voiceURI = voiceURI;

  const lang = model.lang || 'en';
  const counts = model.counts;

  useEffect(() => {
    const s = synth;
    if (!s) return;
    const load = () => setVoices(sortedVoices(lang));
    load();
    s.addEventListener?.('voiceschanged', load);
    return () => s.removeEventListener?.('voiceschanged', load);
  }, [lang]);

  const voiceFor = useCallback(
    () => (synth ? synth.getVoices().find((v) => v.voiceURI === live.current.voiceURI) : undefined),
    [],
  );

  const setPlay = useCallback((p: boolean) => {
    live.current.playing = p;
    setPlaying(p);
  }, []);

  const stopSpeech = useCallback(() => {
    setPlay(false);
    live.current.token++;
    clearTimeout(timer.current);
    synth?.cancel();
  }, [setPlay]);

  const sayOnly = useCallback(
    (text: string) => {
      live.current.token++;
      clearTimeout(timer.current);
      setNotice(text);
      if (!synth || !live.current.voiceOn) return;
      synth.cancel();
      synth.speak(makeUtterance(text, live.current.rate, voiceFor(), lang));
    },
    [lang, voiceFor],
  );

  const speakFrom = useCallback(
    (i: number) => {
      const token = ++live.current.token;
      clearTimeout(timer.current);
      synth?.cancel();
      const it = items[i];
      const advance = () => {
        if (token !== live.current.token) return;
        if (live.current.playing && i < items.length - 1) selectRef.current(i + 1, { speak: true });
        else if (live.current.playing) setPlay(false);
      };
      const s = synth;
      if (!s || !live.current.voiceOn) {
        if (live.current.playing) timer.current = setTimeout(advance, captionDelay(it.speech, live.current.rate));
        return;
      }
      const parts = chunks(it.speech);
      let k = 0;
      const next = () => {
        if (token !== live.current.token) return;
        if (k >= parts.length) {
          advance();
          return;
        }
        const u = makeUtterance(parts[k++], live.current.rate, voiceFor(), lang);
        u.onend = () => setTimeout(next, 60);
        u.onerror = (ev) => {
          if (ev.error !== 'interrupted' && ev.error !== 'canceled') setTimeout(next, 60);
        };
        s.speak(u);
      };
      // A short delay avoids a Chrome issue where speak() right after cancel() is dropped
      timer.current = setTimeout(next, 40);
    },
    [items, lang, setPlay, voiceFor],
  );

  const select = useCallback(
    (raw: number, { speak = false, scroll = true }: { speak?: boolean; scroll?: boolean } = {}) => {
      if (!items.length) return;
      const i = Math.max(0, Math.min(items.length - 1, raw));
      live.current.index = i;
      setIndex(i);
      setNotice('');
      if (scroll) {
        requestAnimationFrame(() => {
          const t = transcriptRef.current;
          const li = document.getElementById(`${uid}-it-${i}`);
          if (!t || !li) return;
          const tr = t.getBoundingClientRect();
          const lr = li.getBoundingClientRect();
          if (lr.top < tr.top + 4) t.scrollTop += lr.top - tr.top - 8;
          else if (lr.bottom > tr.bottom - 4) t.scrollTop += lr.bottom - tr.bottom + 8;
        });
      }
      if (speak) speakFrom(i);
    },
    [items.length, speakFrom, uid],
  );
  selectRef.current = select;

  const move = useCallback(
    (kind: MoveKind, dir: 1 | -1) => {
      const fn = MATCH[kind];
      for (let i = live.current.index + dir; i >= 0 && i < items.length; i += dir) {
        if (fn(items[i])) {
          if (kind !== 'item') setPlay(false);
          select(i, { speak: true });
          return;
        }
      }
      if (kind !== 'item') sayOnly(`No ${dir > 0 ? 'next' : 'previous'} ${MOVE_NAMES[kind]}`);
    },
    [items, select, sayOnly, setPlay],
  );

  const togglePlay = useCallback(() => {
    if (live.current.playing) {
      stopSpeech();
      return;
    }
    setPlay(true);
    onPlayback?.();
    select(live.current.index >= items.length - 1 ? 0 : live.current.index, { speak: true });
  }, [items.length, select, setPlay, stopSpeech, onPlayback]);

  // Start at the top; stop speaking when leaving the results
  useEffect(() => {
    select(0, { speak: false, scroll: true });
    return () => {
      live.current.token++;
      clearTimeout(timer.current);
      synth?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const groups = useMemo(() => {
    const out: IssueGroup[] = [];
    const byMsg = new Map<string, IssueGroup>();
    for (const iss of model.issues) {
      let g = byMsg.get(iss.message);
      if (!g) {
        g = { ...iss, items: [] };
        byMsg.set(iss.message, g);
        out.push(g);
      }
      g.items.push(iss.item);
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'problem' ? -1 : 1));
  }, [model.issues]);

  const problemCount = model.issues.filter((i) => i.severity === 'problem').length;
  const reviewCount = model.issues.length - problemCount;
  const headings = useMemo(() => items.filter((i) => i.kind === 'heading'), [items]);

  const current = items[index];
  const currentFlag = current?.flags?.[0];
  const pageTotal = model.format === 'docx' ? counts.pages : model.pdf?.numPages ?? counts.pages;
  const yes = (b: boolean) => (b ? 'Yes' : 'No');

  const facts: { label: string; value: string; tone?: 'bad' | 'warn' }[] = [
    model.format === 'docx'
      ? { label: 'Format', value: 'Word (.docx)' }
      : { label: 'Tagged', value: yes(model.tagged), tone: model.tagged ? undefined : 'bad' },
    {
      label: 'Title',
      value: model.title ? (model.displayTitle ? 'Set' : 'Set, not shown') : 'Missing',
      tone: model.title ? (model.displayTitle ? undefined : 'warn') : 'bad',
    },
    { label: 'Language', value: model.lang || 'Missing', tone: model.lang ? undefined : 'bad' },
    { label: 'Pages', value: String(counts.pages) },
    { label: 'Headings', value: String(counts.headings), tone: model.tagged && counts.headings === 0 ? 'bad' : undefined },
    {
      label: 'Graphics',
      value: counts.graphics ? `${counts.graphics}${counts.missingAlt ? `, ${counts.missingAlt} missing alt` : ''}` : '0',
      tone: counts.missingAlt ? 'bad' : undefined,
    },
    { label: 'Tables', value: String(counts.tables) },
    { label: 'Lists', value: String(counts.lists) },
    { label: 'Links', value: String(counts.links) },
    ...(counts.fields ? [{ label: 'Form fields', value: String(counts.fields) }] : []),
  ];

  function onTranscriptKey(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPlay(false);
      move('item', 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPlay(false);
      move('item', -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPlay(false);
      select(0, { speak: true });
    } else if (e.key === 'End') {
      e.preventDefault();
      setPlay(false);
      select(items.length - 1, { speak: true });
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopSpeech();
    } else if (KEYMAP[k]) {
      e.preventDefault();
      move(KEYMAP[k], e.shiftKey ? -1 : 1);
    }
  }

  const docLabel = model.format === 'docx' ? 'Word document' : 'PDF';

  return (
    <section className="results wrap" aria-labelledby={`${uid}-results-title`}>
      <div className="results-head">
        <div>
          <h1 id={`${uid}-results-title`}>Screen reader simulation results</h1>
          <p className="file-chip" data-testid="sim-file-summary">
            <strong>{model.name}</strong>
            <span className="dot" aria-hidden="true">
              ·
            </span>
            <span>{docLabel}</span>
            {model.title && (
              <>
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                <span>Title: {model.title}</span>
              </>
            )}
          </p>
        </div>
        <div className="results-actions">
          <button type="button" className="btn btn-secondary" onClick={onReset} data-testid="sim-button-reset">
            <RotateCcw size={17} aria-hidden="true" />
            Simulate another document
          </button>
          <a className="btn btn-primary ext" href={remediationUrl} data-testid="sim-link-remedy508">
            <Wrench size={17} aria-hidden="true" />
            Fix with Remedy508
          </a>
        </div>
      </div>

      <dl className="facts" data-testid="sim-facts">
        {facts.map((f) => (
          <div className="fact" key={f.label}>
            <dt>{f.label}</dt>
            <dd className={f.tone ? `sim-${f.tone}` : /^\d[\d,]*$/.test(f.value) ? 'num' : undefined}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <p className="disclaimer" data-testid="sim-results-disclaimer">
        <Info size={18} aria-hidden="true" />
        <span>
          <strong>Simulated screen reader output.</strong>{' '}
          {model.format === 'docx'
            ? "Based on the Word file's styles and structure. NVDA, JAWS, and VoiceOver may announce things a little differently in Word, so confirm final files with a real screen reader."
            : "Based on the PDF's tags. NVDA, JAWS, and VoiceOver may announce things a little differently, so confirm final files with a real screen reader."}{' '}
          Your document was not uploaded or saved.
        </span>
      </p>

      <div className="sim-player">
        <section className="sim-panel sim-reader" aria-labelledby={`${uid}-listen-title`}>
          <h2 className="sim-panel-title" id={`${uid}-listen-title`}>
            Listen to the reading order
          </h2>

          <div className="sim-now" data-testid="sim-now">
            <div className="sim-now-meta">
              <span className="sim-chip">
                {current ? current.role + (current.cell ? ` · ${current.cell}` : '') : 'Ready'}
              </span>
              {current && <span className="sim-now-page">Page {current.page}</span>}
            </div>
            <p className="sim-now-text" data-testid="sim-now-text">
              {caption(current) || 'Press Play to start reading from the top.'}
            </p>
            {notice ? (
              <p className="sim-now-issue sim-sev-review" role="status">
                {notice}
              </p>
            ) : currentFlag ? (
              <p className={`sim-now-issue sim-sev-${currentFlag.severity}`}>
                {SEV_LABEL[currentFlag.severity]}: {currentFlag.message}
              </p>
            ) : null}
          </div>

          <div className="sim-controls" role="group" aria-label="Playback controls">
            <button
              type="button"
              className="btn btn-primary sim-play"
              aria-pressed={playing}
              onClick={togglePlay}
              data-testid="sim-button-play"
            >
              {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <div className="sim-moveby">
              <label htmlFor={`${uid}-moveby`}>Move by</label>
              <select
                id={`${uid}-moveby`}
                className="sim-select"
                value={moveBy}
                onChange={(e) => setMoveBy(e.target.value as MoveKind)}
                data-testid="sim-select-moveby"
              >
                <option value="item">Item</option>
                <option value="heading">Heading</option>
                <option value="table">Table</option>
                <option value="list">List</option>
                <option value="link">Link</option>
                <option value="graphic">Graphic</option>
                <option value="field">Form field</option>
                <option value="issue">Issue</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPlay(false);
                  move(moveBy, -1);
                }}
                data-testid="sim-button-prev"
              >
                <ChevronLeft size={17} aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPlay(false);
                  move(moveBy, 1);
                }}
                data-testid="sim-button-next"
              >
                Next
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="sim-voice-row">
            <label className="sim-switch">
              <input
                type="checkbox"
                checked={voiceOn}
                disabled={!synth}
                onChange={(e) => {
                  setVoiceOn(e.target.checked);
                  if (!e.target.checked) synth?.cancel();
                }}
                data-testid="sim-toggle-voice"
              />
              <span>Voice</span>
            </label>
            <label className="sim-field">
              <span>Speed</span>
              <input
                type="range"
                min={0.6}
                max={2.5}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                data-testid="sim-range-rate"
              />
              <output className="num">{rate.toFixed(1)}×</output>
            </label>
            <label className="sim-field sim-grow">
              <span>Voice</span>
              <select
                className="sim-select"
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                disabled={!synth}
                data-testid="sim-select-voice"
              >
                <option value="">Browser default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!synth && (
            <p className="sim-voice-note" role="status">
              This browser does not support speech. The reading order and captions still work.
            </p>
          )}

          <div className="sim-transcript-head">
            <h3 className="sim-panel-subtitle" id={`${uid}-transcript-title`}>
              Reading order
            </h3>
            <details className="sim-keys">
              <summary>Keyboard shortcuts</summary>
              <div className="sim-keys-panel">
                <p>Select the reading order list first, then use:</p>
                <ul>
                  <li>
                    <kbd>↓</kbd> <kbd>↑</kbd> next or previous item
                  </li>
                  <li>
                    <kbd>Space</kbd> play or pause
                  </li>
                  <li>
                    <kbd>H</kbd> heading, <kbd>T</kbd> table, <kbd>L</kbd> list
                  </li>
                  <li>
                    <kbd>K</kbd> link, <kbd>G</kbd> graphic, <kbd>F</kbd> form field
                  </li>
                  <li>
                    <kbd>I</kbd> next issue
                  </li>
                  <li>
                    Add <kbd>Shift</kbd> to go backward
                  </li>
                  <li>
                    <kbd>Esc</kbd> stop speaking
                  </li>
                </ul>
              </div>
            </details>
          </div>
          <ol
            className="sim-transcript"
            ref={transcriptRef}
            role="listbox"
            tabIndex={0}
            aria-labelledby={`${uid}-transcript-title`}
            aria-activedescendant={`${uid}-it-${index}`}
            onKeyDown={onTranscriptKey}
            data-testid="sim-transcript"
          >
            {items.map((it) => (
              <li
                key={it.n}
                id={`${uid}-it-${it.n}`}
                role="option"
                aria-selected={it.n === index}
                onClick={() => {
                  setPlay(false);
                  select(it.n, { speak: true });
                }}
              >
                <span className="sim-role">
                  {it.role}
                  {it.cell && <small>{it.cell}</small>}
                </span>
                <span className={`sim-txt${it.kind === 'marker' || it.kind === 'end' ? ' sim-muted' : ''}`}>
                  {it.display}
                  {(it.flags || []).map((f, fi) => (
                    <span key={fi} className={`sim-flag sim-sev-${f.severity}`}>
                      {SEV_LABEL[f.severity]}: {f.message}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="sim-panel sim-view" aria-labelledby={`${uid}-view-title`}>
          <div className="sim-view-head">
            <h2 className="sim-panel-title" id={`${uid}-view-title`}>
              {model.format === 'docx' ? (
                'Document view'
              ) : (
                <>
                  Page <span className="num">{current?.page ?? 1}</span> of <span className="num">{pageTotal}</span>
                </>
              )}
            </h2>
            <p className="sim-view-hint">
              {model.format === 'docx'
                ? 'A simple view of the Word file. The highlight shows what is being read.'
                : 'The highlight shows what is being read.'}
            </p>
          </div>
          <DocumentStage model={model} item={current} />
        </section>
      </div>

      <div className="sim-lower">
        <section aria-labelledby={`${uid}-issues-title`}>
          <h2 className="sim-section-title" id={`${uid}-issues-title`}>
            Issues found <span className="sim-count num">{model.issues.length}</span>
          </h2>
          <p className="sim-section-sub">
            {problemCount} {problemCount === 1 ? 'problem' : 'problems'}, {reviewCount} to review. Select an issue to
            hear where it happens; select it again to go to the next place.
          </p>
          {groups.length ? (
            <ul className="findings" data-testid="sim-issue-list">
              {groups.map((g, gi) => (
                <li className="finding" key={gi}>
                  <button
                    type="button"
                    className="finding-toggle"
                    onClick={() => {
                      const nextIdx = g.items.find((n) => n > live.current.index) ?? g.items[0];
                      setPlay(false);
                      select(nextIdx, { speak: true, scroll: true });
                    }}
                    data-testid={`sim-issue-${gi}`}
                  >
                    <SeverityBadge severity={g.severity} />
                    <span>
                      <span className="finding-title sim-issue-text">{g.message}</span>
                      {g.items.length > 1 && (
                        <span className="finding-summary" style={{ display: 'block' }}>
                          Found {g.items.length} times
                        </span>
                      )}
                    </span>
                    <LocateFixed className="chev" size={20} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-findings">
              <p style={{ fontWeight: 600 }}>No structural issues found</p>
              <p>The automated checks found nothing to flag. Still listen through the reading order to confirm it makes sense.</p>
            </div>
          )}
        </section>

        <section aria-labelledby={`${uid}-headings-title`}>
          <h2 className="sim-section-title" id={`${uid}-headings-title`}>
            Headings <span className="sim-count num">{headings.length}</span>
          </h2>
          <p className="sim-section-sub">The outline a screen reader user hears when they list headings.</p>
          {headings.length ? (
            <ul className="sim-outline" data-testid="sim-outline">
              {headings.map((h) => (
                <li key={h.n}>
                  <button
                    type="button"
                    data-depth={h.level}
                    onClick={() => {
                      setPlay(false);
                      select(h.n, { speak: true, scroll: true });
                    }}
                  >
                    <span className="sim-lvl num">H{h.level}</span>
                    <span>{h.display}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-findings">
              <p style={{ fontWeight: 600 }}>No headings</p>
              <p>Screen reader users will not be able to jump between sections of this document.</p>
            </div>
          )}
        </section>
      </div>

      <div className="cta-panel">
        <div>
          <h2>Ready for remediation assistance?</h2>
          <p>
            Remedy508 provides automated document accessibility remediation for structure, reading order, alternative
            text, and form labels, then returns the updated document with a summary of enhancements.
          </p>
        </div>
        <a className="btn btn-primary btn-lg ext" href={remediationUrl} data-testid="sim-link-remedy508-cta">
          Fix with Remedy508
        </a>
      </div>
    </section>
  );
}
