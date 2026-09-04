import { useState } from "react";
import { PartyPopper, X } from "lucide-react";

// Site-wide promo banner for the Fall Semester launch discount.
// Dismissible per-browser-tab (re-appears on next visit/reload).
// Static content -- update or remove this component directly when the promo ends.
export default function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="note"
      className="w-full px-10 py-2.5 text-xs sm:text-sm font-semibold flex items-start sm:items-center justify-center gap-2 relative bg-[#01696F] text-white"
    >
      <PartyPopper className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
      <span className="text-center leading-snug">
        Fall Semester Launch: 30% off for a full year, on both plans. Add your code at checkout to apply discount.{" "}
        <span className="font-bold">Individual Plans: FALL30</span>
        {" · "}
        <span className="font-bold">Team Plans: FALL30TEAM</span>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss promo banner"
        className="absolute right-3 top-2.5 p-1 rounded-md hover:bg-black/10 transition-colors text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
