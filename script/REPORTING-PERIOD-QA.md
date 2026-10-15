# Dashboard fresh reporting period

Owner selected all activity reporting on October 15, 2026. Publishing still requires deployment approval.

## Behavior

- The first server startup with this release inserts the approved period into `reporting_periods` in the persistent application SQLite database. `INSERT OR IGNORE` ensures later startups and deployments preserve the same timestamp.
- Dashboard job counts, costs, daily charts, failures, recent jobs, checker usage, simulator usage, first-party visitor counts and new-signup counts exclude earlier activity.
- Current Stripe revenue/subscriptions, total accounts, team seats and user credit balances remain unchanged.
- This is a reporting filter, not deletion. Existing retention policies still apply to metadata.
- First-party visitor daily deduplication is scoped to the new period so a visitor seen before the reset may count once again afterward.
- The visible dashboard notice identifies the start in Pacific time and clarifies that rolling windows include only post-reset activity.

## Google Analytics

The connected Remedy508 property reported `America/Los_Angeles` and accepted the `dateHourMinute` numeric lower-bound filter together with `sessionSourceMedium`, `sessions`, and `screenPageViews` in a read-only connector request.

Historical reports use that lower bound; realtime reports use a bounded `minuteRanges` window. GA4 starts at the first full minute after the reset, intentionally excluding the partial minute rather than mixing earlier traffic. No Google Analytics property data is deleted.

API references: [dateHourMinute schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema) and [realtime minute ranges](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runRealtimeReport).

## Checks

- Production build passed.
- `npx tsx --test server/reportingPeriod.test.ts server/simulationUsage.test.ts`: 12 tests passed.
- Tests cover persistence of the saved start, Pacific/UTC minute boundaries, realtime bounds, filtering every local activity summary, retained historical rows, unchanged credits on historical jobs, and admin-only access to the dashboard.
- Local browser QA with fixture data confirmed the fresh-period notice, empty activity counts alongside retained revenue/account totals, expandable traffic details and mobile fit.
- Simulator naming and bold navigation were separately checked on the homepage and interior pages, desktop and mobile.
- Full TypeScript checks still report only the known pre-existing `server/routes.ts` errors, unrelated to this feature.

## Production verification after approval

Verify the exact Railway production rollout and public naming/navigation, and confirm the dashboard API denies unauthenticated requests. The owner must confirm the signed-in dashboard's fresh-period notice; an unauthenticated public check cannot verify private counts. New legitimate activity may already make counts nonzero.
