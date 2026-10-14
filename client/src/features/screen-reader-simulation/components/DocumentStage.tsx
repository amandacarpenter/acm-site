import { useEffect, useMemo, useRef } from 'react';
import type { SimItem, SimModel } from '../lib/types';

interface Props {
  model: SimModel;
  item: SimItem | undefined;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Visual-only page view: the PDF page with a highlight box, or a simple view of the Word file. */
export function DocumentStage({ model, item }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<{ page: number; width: number; viewport: any; task: any }>({ page: 0, width: 0, viewport: null, task: null });
  const pending = useRef<{ p: number; rects: number[][] } | null>(null);
  const isDocx = model.format === 'docx';
  const docHtml = useMemo(() => ({ __html: model.html || '' }), [model.html]);

  function scrollStageTo(top: number, bottom: number) {
    const st = stageRef.current;
    if (!st) return;
    if (top < st.scrollTop + 20 || bottom > st.scrollTop + st.clientHeight - 20) {
      st.scrollTo({ top: Math.max(0, top - st.clientHeight / 3), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function drawHighlights(rects: number[][]) {
    const hl = hlRef.current;
    const canvas = canvasRef.current;
    const vp = rendered.current.viewport;
    if (!hl || !canvas) return;
    hl.innerHTML = '';
    if (!rects || !rects.length || !vp) return;
    const off = { x: canvas.offsetLeft, y: canvas.offsetTop };
    const boxes = rects
      .map((r) => {
        const [x1, y1] = vp.convertToViewportPoint(r[0], r[1]);
        const [x2, y2] = vp.convertToViewportPoint(r[2], r[3]);
        return { l: Math.min(x1, x2), t: Math.min(y1, y2), r: Math.max(x1, x2), b: Math.max(y1, y2) };
      })
      .sort((a, b) => a.t - b.t || a.l - b.l);
    const merged: { l: number; t: number; r: number; b: number }[] = [];
    for (const b of boxes) {
      const m = merged[merged.length - 1];
      if (m && Math.abs(m.t - b.t) < 4 && b.l - m.r < 12) {
        m.r = Math.max(m.r, b.r);
        m.b = Math.max(m.b, b.b);
        m.t = Math.min(m.t, b.t);
      } else merged.push({ ...b });
    }
    for (const m of merged) {
      const d = document.createElement('div');
      d.className = 'sim-hl';
      d.style.left = `${off.x + m.l - 2}px`;
      d.style.top = `${off.y + m.t - 1}px`;
      d.style.width = `${m.r - m.l + 4}px`;
      d.style.height = `${m.b - m.t + 2}px`;
      hl.appendChild(d);
    }
    if (stageRef.current) hl.style.height = `${stageRef.current.scrollHeight}px`;
    if (merged.length) scrollStageTo(off.y + merged[0].t, off.y + merged[merged.length - 1].b);
  }

  async function showPdfPage(p: number, rects: number[][], force = false) {
    const pdf = model.pdf;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !stage || !canvas) return;
    pending.current = { p, rects };
    const stageW = stage.clientWidth - 24;
    if (force || rendered.current.page !== p || rendered.current.width !== stageW) {
      const page = await pdf.getPage(p);
      if (!pending.current || pending.current.p !== p) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.3, stageW / base.width);
      const vp = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      if (rendered.current.task) {
        try {
          rendered.current.task.cancel();
        } catch {
          /* finished */
        }
      }
      const task = page.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      rendered.current = { page: p, width: stageW, viewport: vp, task };
      try {
        await task.promise;
      } catch {
        /* cancelled by a newer render */
      }
    }
    if (pending.current) drawHighlights(pending.current.rects);
  }

  // Follow the current item
  useEffect(() => {
    if (!item) return;
    if (isDocx) {
      const v = docRef.current;
      const st = stageRef.current;
      if (!v || !st) return;
      v.querySelectorAll('.dv-on').forEach((e) => e.classList.remove('dv-on'));
      const el = v.querySelector(`[data-n="${item.n}"]`);
      if (!el) return;
      el.classList.add('dv-on');
      const sr = st.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const top = er.top - sr.top + st.scrollTop;
      scrollStageTo(top, top + er.height);
      return;
    }
    void showPdfPage(item.page, item.rects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, isDocx, model]);

  // Re-render the PDF page at the new width when the window is resized
  useEffect(() => {
    if (isDocx) return;
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (pending.current) void showPdfPage(pending.current.p, pending.current.rects, true);
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDocx, model]);

  return (
    <div
      className="sim-stage"
      ref={stageRef}
      {...(isDocx
        ? { tabIndex: 0, role: 'region', 'aria-label': 'Document view, visual only. Use arrow keys to scroll.' }
        : {})}
      data-testid="sim-stage"
    >
      {isDocx ? (
        <div className="doc-view" ref={docRef} aria-hidden="true" dangerouslySetInnerHTML={docHtml} />
      ) : (
        <>
          <canvas ref={canvasRef} aria-hidden="true" />
          <div className="sim-hl-layer" ref={hlRef} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
