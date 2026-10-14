/* Speech helpers for the Free Screen Reader Simulation (Web Speech API). */

export const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

/** Split long text into sentence-sized pieces; some browsers stop speaking very long utterances. */
export function chunks(text: string): string[] {
  const parts = text.match(/[^.!?;:]+[.!?;:]*\s*/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) {
      out.push(cur);
      cur = p;
    } else cur += p;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Voices sorted so the document's language comes first. */
export function sortedVoices(lang: string): SpeechSynthesisVoice[] {
  if (!synth) return [];
  const base = (lang || navigator.language || 'en').slice(0, 2).toLowerCase();
  return [...synth.getVoices()].sort((a, b) => {
    const am = a.lang.toLowerCase().startsWith(base) ? 0 : 1;
    const bm = b.lang.toLowerCase().startsWith(base) ? 0 : 1;
    return am - bm || a.name.localeCompare(b.name);
  });
}

export function makeUtterance(text: string, rate: number, voice: SpeechSynthesisVoice | undefined, lang: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : lang || 'en';
  return u;
}

/** Caption-only pacing when voice is off or unavailable. */
export function captionDelay(text: string, rate: number): number {
  return Math.max(900, (text.split(/\s+/).length * 260) / rate);
}
