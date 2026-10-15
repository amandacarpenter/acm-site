# Screen Reader Simulation usage and simpler admin dashboard

Prepared October 15, 2026. Deployment requires owner approval.

## Scope

- Admin overview highlights visitors, recurring revenue, paid-tool jobs and recent failures.
- Simulation metrics show processed document runs today (Pacific time), rolling 7/30-day windows, outcomes, file types and whether Play was pressed.
- Detailed revenue, traffic, cost, activity and external service links remain available in native expandable sections.
- A run is not a unique visitor. Canceled runs and uploader validation rejections are excluded. Play is a button interaction, not proof that speech was audible.
- No document bytes, text, filenames, email addresses or audio enter the new telemetry endpoint.
- Random per-run IDs deduplicate reports and Play clicks. Rows are retained for 90 days in the existing persistent SQLite database. No historical backfill.
- Admin identity, local hosts, QA/test parameters and automated browsers are excluded by the client. The ingestion route also validates origins, payloads and bot user agents, with bounded short-lived rate limiting.
- Analytics is best-effort and does not gate parsing or playback. Rate-limited, blocked, offline or excluded sessions can make counts lower than actual use.
- Existing paid tools, auth policy, credit logic and document parsers are unchanged.

## Verification

- `npm run build`: passes.
- `npx tsx --test server/simulationUsage.test.ts`: seven tests pass, covering deduplication, out-of-order events, retention/time windows, privacy schema, endpoint rejection/rate limits, client exclusion and admin-only summary access.
- Browser QA used the actual components with a local auth stub and seeded dashboard response, not live account data.
- Actual synthetic DOCX and PDF files processed through the local simulation. Captured completion and Play events contained only the four permitted metadata keys.
- Play/pause/replay produced only one Play event per document run.
- An invalid PDF produced a failed event. `?qa=1` suppressed reporting.
- Desktop and mobile dashboard layouts, expandable sections, refresh, empty-state, missing-field and refresh-failure behavior were checked.
- Signed-in production dashboard and audible speech were not tested in this local pass.

## Existing checks outside this scope

- Full `npm run check` still reports the pre-existing errors in `server/routes.ts` (duplicate fs import, old narrowing/implicit-any errors and Clerk/string type errors). No new-file errors remain.
- `script/test_admin_auth.ts` completes its runtime authorization cases but fails its old source assertion that the backup route uses only `requireAdmin`. The unchanged backup route already uses `requireAdminOrBackupKey`. This unrelated policy/test was not changed.

## Deployment check

After approved deployment, verify the production rollout, homepage/tool availability and unauthenticated dashboard rejection. The owner should open `/admin` while signed in to confirm the new section. Initial genuine usage can be zero; owner/admin testing intentionally does not add counts.
