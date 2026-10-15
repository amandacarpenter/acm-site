import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { createSimulationUsage } from '../lib/usage';
import { SimAnalyzing } from './SimAnalyzing';
import { SimResults } from './SimResults';
import { SimUploader } from './SimUploader';
import { loadSimDocument, releaseSimModel, type SimStageId } from '../lib/load';
import type { SimModel, SimValidationError } from '../lib/types';
import '../../document-checker/document-checker.css';
import '../screen-reader-simulation.css';

type View = 'idle' | 'analyzing' | 'results';

interface Props {
  compact?: boolean;
  mainId: string;
}

/**
 * Free Screen Reader Simulation. Uses the Free Checker's layout and styles.
 * Documents stay in the browser. Only anonymous run metadata is reported.
 */
export function SimulationExperience({ compact = false, mainId }: Props) {
  const { user, isLoaded } = useUser();
  const reportUsage = useRef<ReturnType<typeof createSimulationUsage>>(() => {});
  const [view, setView] = useState<View>('idle');
  const [error, setError] = useState<SimValidationError | null>(null);
  const [model, setModel] = useState<SimModel | null>(null);
  const [stage, setStage] = useState<SimStageId>('read');
  const [fileName, setFileName] = useState('');
  const run = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const modelRef = useRef<SimModel | null>(null);
  const Root = compact ? 'div' : 'main';

  const focusMain = useCallback(() => {
    mainRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    mainRef.current?.focus();
  }, []);

  const replaceModel = useCallback((next: SimModel | null) => {
    releaseSimModel(modelRef.current);
    modelRef.current = next;
    setModel(next);
  }, []);

  useEffect(() => () => releaseSimModel(modelRef.current), []);

  const handleFile = useCallback(
    async (file: File) => {
      const id = ++run.current;
      // If identity is still loading, skip analytics rather than counting admin testing.
      let report: ReturnType<typeof createSimulationUsage> = () => {};
      try {
        report = createSimulationUsage(file, compact, !isLoaded ||
          user?.primaryEmailAddress?.emailAddress?.toLowerCase() === 'amandathecarpenter@gmail.com');
      } catch { /* Analytics is optional. */ }
      reportUsage.current = report;
      setError(null);
      setFileName(file.name);
      setStage('read');
      setView('analyzing');
      replaceModel(null);
      try {
        const result = await loadSimDocument(file, (s) => {
          if (id === run.current) setStage(s);
        });
        if (id !== run.current) {
          releaseSimModel(result);
          return;
        }
        replaceModel(result);
        report('completed');
        setView('results');
        focusMain();
      } catch (err) {
        if (id !== run.current) return;
        report('failed');
        setError({
          title: 'This document could not be simulated',
          message: err instanceof Error ? err.message : 'An unexpected error stopped the simulation. Try another file.',
        });
        setView('idle');
      }
    },
    [focusMain, replaceModel, compact, user, isLoaded],
  );

  const reset = useCallback(() => {
    run.current++;
    replaceModel(null);
    setError(null);
    setView('idle');
    focusMain();
  }, [focusMain, replaceModel]);

  return (
    <div className={`document-checker-page screen-reader-sim${compact ? ' document-checker-compact' : ''}`}>
      <Root
        id={mainId}
        ref={(node: HTMLElement | null) => {
          mainRef.current = node;
        }}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        {view === 'idle' && <SimUploader onFile={handleFile} error={error} setError={setError} compact={compact} />}
        {view === 'analyzing' && <SimAnalyzing fileName={fileName} stage={stage} onCancel={reset} />}
        {view === 'results' && model && <SimResults model={model} onReset={reset} onPlayback={() => reportUsage.current('playback')} />}
      </Root>
    </div>
  );
}
