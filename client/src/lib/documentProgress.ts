/** Weighted stage estimate, not an elapsed-time animation or accessibility score. */
export function documentProgress(stage: string): { percent: number; label: string } {
  if (/checking pdf generator/i.test(stage)) return { percent: 10, label: "Preparing PDF output" };
  if (/ready to download/i.test(stage)) return { percent: 98, label: "Preparing your download" };
  if (/building.*pdf|finalizing/i.test(stage)) return { percent: 90, label: "Creating your document" };
  const section = stage.match(/section (\d+) of (\d+)/i);
  if (section) {
    const total = Math.max(1, Number(section[2]));
    const completed = Math.min(total, Math.max(0, Number(section[1]) - 1));
    return { percent: Math.round(15 + completed / total * 65), label: "Improving accessibility" };
  }
  const pages = stage.match(/pages? (\d+)(?:-(\d+))? of (\d+)/i);
  if (pages) return { percent: Math.round(15 + (Number(pages[1]) - 1) / Math.max(1, Number(pages[3])) * 65), label: "Improving accessibility" };
  if (/preparing|checking.*images|assembling/i.test(stage)) return { percent: 85, label: "Checking your document" };
  if (/extracting|reading|checking document/i.test(stage)) return { percent: 10, label: "Reading your document" };
  if (/waiting|queued/i.test(stage)) return { percent: 5, label: "Waiting to start" };
  return { percent: 3, label: /reconnecting/i.test(stage) ? "Checking your progress" : "Uploading your document" };
}
