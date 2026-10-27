# Public free trial: implementation and launch checks

## Scope

- Four existing tools, 30 shared Credits, 14 days, no card and no automatic charge.
- Explicit activation after primary-email verification; no grant for viewing a page.
- Free Trial / Your Trial navigation on both header styles, desktop and mobile.
- Signup and login return to the offer only through the explicit `trial=1` path.
- Expiry, exhaustion, errors, verification and existing-plan states.
- Existing paid/complimentary/legacy-trial access takes priority. Legacy grants do not
  acquire the new expiry.

## Storage and billing

Only an additive `free_trial_activations` table is introduced in the existing
SQLite database. It records user ID, normalized-email SHA-256 digest, activation
and expiry timestamps. No existing table or column is dropped, renamed or retyped.
The unique email digest prevents reusing the exact same email with a second account;
it is not person-level identity verification and does not detect email aliases.

Activation and the 30-Credit allocation commit in one immediate transaction. Neither
Clerk subscription metadata nor Stripe is modified by activation. Trial balances
do not reset monthly or roll into paid balances. Already-reserved jobs can finish;
refunds return to their original ledger and cannot reopen an expired trial.

The activation record is retained to prevent repeated grants. Review retention
language alongside the privacy policy before launch.

## Offline checks

Run:

```sh
npm ci
npx tsx script/test_free_trial.ts
npx tsx script/test_trial_credits.ts
npm run build
npm run check
```

New trial tests use isolated SQLite and real Express middleware, with fake identity
provider responses. They do not send email, call Stripe, process production files,
or validate the accessibility quality of remediation output.

The pre-change main branch has nine TypeScript diagnostics in `server/routes.ts`.
Removing the duplicated `fs` import fixes two of them; seven unrelated diagnostics
remain (HTML union narrowing, legacy Clerk API calls, Express parameter typing).
The trial changes introduce no new TypeScript diagnostics. Production bundling passes.
Do not represent `npm run check` as passing.

## UI review harness

```sh
npx vite --config script/trial-qa/vite.config.ts --port 5173
```

This explicit test config substitutes Clerk and API fixtures. Production Vite
configuration does not import or alias these fixtures. The banner labels the
entire harness as a design preview. It cannot create accounts, send messages,
process uploads, charge cards, or change production data.

- `/free-trial`: signed-out offer.
- `/free-trial?qaUser=eligible`: activation form.
- Add `&qaState=active`, `expired`, `exhausted`, `verification_required`, or `error`
  to inspect additional states.
- `/` tests the separate dark homepage navigation.
- Review build: `npx vite build --config script/trial-qa/vite.config.ts --mode trial-preview`.
  It uses hash routing only for the private preview, not the production app.

## Results from this working copy

- 30 public-trial checks passed.
- 25 existing trial-ledger/middleware checks passed.
- Actual document-route regression suite passed using real SQLite and PDF
  renderers with mocked Clerk/AI responses. Includes public activation, a PDF
  processing job and download, and the expected remaining balance of 29 Credits.
- Both production and isolated preview builds passed.
- Desktop 1440px, dense signed-in navigation at 1280px, and mobile 375px reviewed.
  No clipping or horizontal overflow found after adjusting navigation spacing.
- Signup return, explicit consent, activation, tools entry and dashboard states
  exercised with sample identity. Keyboard activation also exercised.
- Expired, exhausted, verification-needed and error states rendered. Public pages
  and both header menus checked. The preview's Guides API fixture was corrected
  after an initial fixture-only rendering error.
- New offer text/button contrast pairs measured above 4.5:1. This is not a whole-site
  accessibility audit or assistive-technology test.
- `npm run check` still reports the seven pre-existing diagnostics described above.

## Before production activation

- Review the page copy and eligibility rules.
- Take the normal production SQLite backup and confirm the persistent `/data` volume.
- Deploy first to the normal staging environment with Clerk test credentials.
- Use a new verified account and an existing free account to activate a trial.
- Confirm authentication returns from both email verification and sign-in to the
  offer, and that the clock starts only when Start my free trial is selected.
- Exercise actual document/image/HTML/video processing with approved small fixtures.
- Confirm failed processing refunds, expiry/exhaustion blocking, and downloads.
- Test Individual and Team upgrades with Stripe test mode, including a trial account
  joining a team. Confirm no trial Credits roll into the paid monthly pool.
- Keep existing paid and legacy-trial accounts in the regression sample.
- Run signed-in keyboard and assistive-technology checks; the browser QA here is
  not a fresh WCAG audit or NVDA/VoiceOver certification.
- Merge/deploy production only after approval. Start the email campaign afterward.

## Rollback

Revert the feature commit, leaving the additive activation table intact. Do not
delete trial balances or activation records. The previous app does not understand
public-trial entitlements, so notify active trial users if a rollback is needed.
