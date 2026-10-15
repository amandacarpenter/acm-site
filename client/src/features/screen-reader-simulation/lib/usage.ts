import type { SimulationUsageEvent } from "@shared/simulationUsage";

export function createSimulationUsage(file: File, compact: boolean, excludedUser: boolean) {
  const params = new URLSearchParams(location.search);
  if (excludedUser || !["remedy508.com", "www.remedy508.com"].includes(location.hostname) ||
      params.get("qa") === "1" || params.get("test") === "1" || navigator.webdriver ||
      /HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(navigator.userAgent)) return () => {};
  const base = {
    runId: crypto.randomUUID(),
    fileType: (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" ? "PDF" : "DOCX") as "PDF" | "DOCX",
    source: compact ? "homepage" as const : "simulation-page" as const,
  };
  const sent = new Set<string>();
  return (event: SimulationUsageEvent["event"]) => {
    if (sent.has(event)) return;
    sent.add(event);
    // Best effort only: reporting failures must never interrupt the simulation.
    try {
      void fetch("/api/simulation-usage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, event }), keepalive: true,
      }).catch(() => {});
    } catch { /* A blocked reporting API must not affect document processing. */ }
  };
}
