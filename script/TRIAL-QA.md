# One-time trial support

## Scope

An explicitly provisioned Clerk user with `plan: "trial"`, `subscribed: true`
(the existing tool-access flag, not a Stripe subscription), and
`trialCreditLimit: 140` receives a single lifetime allowance. No reset date,
Stripe customer, charge, scheduled expiry, or email is created by this feature.

The SQLite database already used by the app now holds `trial_balances` and
`trial_debits`. Trial usage is authoritative there, not in Clerk's monthly
metadata. Backups of the existing database include these tables. Do not delete
or recreate those tables as part of routine account maintenance: that would
erase usage history. Existing grants cannot be refilled by metadata edits.

All paid tool routes now verify the signed-in Clerk session, and tool requests
send `getToken()` as a bearer token. Posted user IDs cannot bypass the limit.
Free checker, contact, pricing and other public routes remain unchanged.
Paid Individual/Team allowance formulas remain unchanged.

Trial credits are reserved atomically before AI work, after actual page/figure
counts are known. Jobs too large for the remaining balance are rejected.
Normal failed responses refund exactly once. A process crash or interrupted
connection can leave a reservation charged; retained `trial_debits` records
allow support to review it. This conservatively prevents free processing.

Trials are offered a subscription at `/pricing`; credit-pack-only checkout is
blocked until they move to a paid plan. The existing subscription checkout
webhook writes `plan: individual` (or team), switching off trial accounting.
Unused trial credits do not become an additional paid credit pack.

## Checks completed locally

- `npx tsx script/test_trial_credits.ts`: 25 checks, including SQLite persistence,
  no calendar reset, exact exhaustion, over-budget rejection, idempotent refunds,
  concurrency, multipart context propagation, authenticated subject enforcement,
  unavailable Clerk failing closed, paid-plan compatibility, and paid conversion.
- `npm run build`: succeeds.
- `npm run check`: same nine pre-existing diagnostics as the baseline, after
  normalizing shifted line numbers; no new diagnostics.
- Existing `script/test_admin_auth.ts` stops at its stale static assertion that
  backup-db must use `requireAdmin`; baseline code already uses the intentionally
  narrower `requireAdminOrBackupKey`. Neither that middleware nor this old test
  was changed for trials.
- Actual Dashboard component rendered using isolated mock Clerk/usage responses.
  Playwright desktop 1280px and mobile 375px checks: fresh, nearly exhausted and
  exhausted states, no monthly/reset label, no credit-pack button, upgrade link
  points to `/pricing`, no horizontal overflow, no page errors. Paid Individual
  and Team plan labels preserved. This is fixture-based UI QA, not a customer login.

No customer's real credits were spent by these checks. These tests do not replace
a real user login and document-remediation test, or a fresh accessibility audit.
