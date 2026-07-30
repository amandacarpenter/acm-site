import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

// Site-wide incident banner. Hidden by default. Shows only when INCIDENT_BANNER_MESSAGE
// is set on the server (Railway env var) -- toggle it there to show/hide instantly,
// no redeploy needed. Dismissible per-browser-tab (re-appears on next visit/reload
// so a real outage stays visible, but doesn't nag within one session).
export default function IncidentBanner() {
  const [status, setStatus] = useState<{ active: boolean; message: string | null; severity: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/incident-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setStatus(data); })
      .catch(() => {}); // fail silently -- a broken banner check should never block the page
    return () => { cancelled = true; };
  }, []);

  if (!status?.active || !status.message || dismissed) return null;

  const isError = status.severity === "error";

  return (
    <div
      role="alert"
      className={`w-full px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 relative ${
        isError ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
      }`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="text-center">{status.message}</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
        className={`absolute right-3 p-1 rounded-md hover:bg-black/10 transition-colors ${isError ? "text-white" : "text-amber-950"}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
