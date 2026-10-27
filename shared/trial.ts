export const FREE_TRIAL_CREDITS = 30;
export const FREE_TRIAL_DAYS = 14;
export const FREE_TRIAL_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type FreeTrialStatus = {
  state: "eligible" | "verification_required" | "ineligible" | "active" | "exhausted" | "expired";
  allocated: number;
  remaining: number;
  startsAt: number | null;
  expiresAt: number | null;
  message: string;
};
