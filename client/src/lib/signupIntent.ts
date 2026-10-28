// Sign-up is only offered as a step toward a plan: the free trial, an
// Individual plan (monthly/annual), or a Team plan. Anyone who reaches the
// sign-up page without one of those is sent to /pricing first, so an account
// is never created on its own. Organization invitations (Clerk adds
// __clerk_ticket to the link) are always allowed through.

export type SignupIntent =
  | { kind: "trial" }
  | { kind: "individual"; billing: "monthly" | "annual" }
  | { kind: "team"; seats: number; payment: "card" | "invoice" }
  | { kind: "invite" }
  | { kind: "none" };

const MAX_TEAM_SEATS = 20;

export function readSignupIntent(search: string): SignupIntent {
  const p = new URLSearchParams(search);
  if (p.get("__clerk_ticket") || p.get("__clerk_status")) return { kind: "invite" };
  if (p.get("trial") === "1") return { kind: "trial" };
  const plan = p.get("plan");
  if (plan === "monthly" || plan === "annual") return { kind: "individual", billing: plan };
  if (plan === "team") {
    const seats = Math.min(MAX_TEAM_SEATS, Math.max(2, parseInt(p.get("seats") || "2") || 2));
    const payment = p.get("payment") === "invoice" ? "invoice" : "card";
    return { kind: "team", seats, payment };
  }
  return { kind: "none" };
}

// Query string (with leading "?") that carries the intent between /signup and /login.
export function intentQuery(intent: SignupIntent): string {
  switch (intent.kind) {
    case "trial": return "?trial=1";
    case "individual": return `?plan=${intent.billing}`;
    case "team": return `?plan=team&seats=${intent.seats}&payment=${intent.payment}`;
    default: return "";
  }
}

// Where to go right after the account is created (or the user signs in):
// straight to payment for paid plans, to the trial card for the trial.
export function intentDestination(intent: SignupIntent): string | null {
  switch (intent.kind) {
    case "trial": return "/pricing?trial=1";
    case "individual": return `/pricing?checkout=${intent.billing}`;
    case "team":
      return intent.payment === "invoice"
        ? `/invoice-request?seats=${intent.seats}`
        : `/team?checkout=1&seats=${intent.seats}`;
    default: return null;
  }
}
