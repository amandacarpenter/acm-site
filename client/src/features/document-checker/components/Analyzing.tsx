import { CircleCheck, LoaderCircle } from 'lucide-react';
import { STAGES, type StageId } from '../lib/analyze';

interface Props {
  fileName: string;
  stage: StageId;
  detail?: string;
  onCancel: () => void;
}

export function Analyzing({ fileName, stage, detail, onCancel }: Props) {
  const index = STAGES.findIndex((s) => s.id === stage);
  const pct = Math.round(((index + 1) / STAGES.length) * 100);
  const current = STAGES[index];

  return (
    <section className="analyzing" aria-labelledby="analyzing-title">
      <div className="analyzing-card">
        <h2 id="analyzing-title">Checking your document</h2>
        <p className="analyzing-file" data-testid="text-analyzing-file">
          {fileName}
        </p>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}% — ${current?.label ?? ''}`}
          aria-labelledby="analyzing-title"
        >
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="progress-value num" data-testid="text-progress">
          {pct}% complete
        </p>

        <ol className="stage-list">
          {STAGES.map((s, i) => {
            const state = i < index ? 'done' : i === index ? 'active' : 'todo';
            return (
              <li key={s.id} data-state={state} data-testid={`stage-${s.id}`}>
                {state === 'done' ? (
                  <CircleCheck size={18} aria-hidden="true" />
                ) : state === 'active' ? (
                  <LoaderCircle size={18} className="spin" aria-hidden="true" />
                ) : (
                  <span style={{ width: 18, height: 18, display: 'inline-block' }} aria-hidden="true" />
                )}
                <span>
                  {s.label}
                  {state === 'active' && detail ? ` — ${detail}` : ''}
                </span>
                <span className="sr-only">
                  {state === 'done' ? ' (complete)' : state === 'active' ? ' (in progress)' : ' (pending)'}
                </span>
              </li>
            );
          })}
        </ol>

        <p aria-live="polite" className="sr-only">
          {current ? `${current.label}. ${pct} percent complete.` : ''}
        </p>

        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
