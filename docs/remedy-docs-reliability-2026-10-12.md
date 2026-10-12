# Remedy Docs reliability update

Status: implemented and tested locally on October 12, 2026; production rollout pending approval. This release addresses request reliability, progress reporting and recovery, not a replacement of the remediation prompts or an assurance that every document will pass accessibility checks.

## Changes

- Background processing: authenticated upload receives a job reference before AI processing finishes. Short status requests replace the browser's single long-running connection.
- Recovery: the submitting account can retrieve finished results for up to 15 minutes without running the job again. Repeated identical uploads reuse a pending or retained result.
- Bounded work: two workers, at most four active/queued jobs, one pending/active job per account, and separate 128 MiB input/result bounds.
- Real progress: stages reflect layout detection, document sections, page batches and PDF generation instead of a simulated percentage.
- Failure handling: early audit rejection is handled immediately, PDF child-process errors/timeouts are handled, and temporary filenames use UUIDs.
- Credits: existing account rules remain; background trial failures refund idempotently. Failed server-side PDF rendering refunds its prior fast-path charge.
- Privacy: only job metadata is stored in SQLite. Finished bytes remain in server memory, not a permanent document library. UI and privacy copy disclose temporary retention.
- Prompts: audit, HTML and vision prompt constants are byte-for-byte unchanged. Existing routing and remediation engines remain in use.

## Verification

- `npx tsx script/test_document_tasks.ts`: 25 passed, including owner isolation, duplicate protection, bounded concurrency, recovery, expiry, restart behavior and trial charging.
- `npx tsx script/test_trial_credits.ts`: 25 passed, including one-time allocation, exhaustion, idempotent refunds and paid-account compatibility.
- `python script/test_complex_pdf_extract.py`: 2 passed.
- `node script/test_document_routes.mjs`: passed against actual Express routes, SQLite ledger and Python renderers, with mocked authentication and AI replies. Covered short upload acknowledgement, text PDF output, Word semantic-HTML handoff, image-bearing vision PDF output with an embedded image, duplicate retrieval without another debit, owner-only access, and immediate audit failure without server crash or lost trial credits.
- Browser component checks: desktop 1280px and mobile 375px layout, actual progress, existing-job retrieval with zero uploads, transient polling recovery without repeat upload, and failed-job messaging without unsupported credit reassurance.
- Production build: passed. Type checking still reports nine pre-existing diagnostics in `server/routes.ts`; no additional diagnostics were introduced by this release.

The integration test uses a fresh temporary database and refuses to run where `/data` exists, to avoid touching a mounted production database. It does not call live AI, Clerk or billing services. Requirements include the application's installed Node dependencies and Python PDF/Pillow dependencies.

## Limitations and rollout

- The exact reported live incident has not been matched to a production log entry. The long synchronous request is a credible failure mechanism, not a proven explanation for every error.
- Hosting documentation states that idle HTTP requests close after five minutes, while active transfers can continue up to 15 minutes ([Railway network specifications](https://docs.railway.com/networking/public-networking/specs-and-limits)). The new client no longer waits for AI work on one idle HTTP connection.
- Large files can still take several minutes. This release does not claim a measured reduction in AI generation time.
- The queue/cache is single-instance, matching the current SQLite-volume architecture. It is not a distributed job service.
- A server restart interrupts pending/active work and loses cached outputs. Interrupted jobs are marked for support review, never automatically rerun or charged again. Credits from interrupted work may need reconciliation.
- Cache pressure can shorten the recovery window. Job-status metadata is removed after seven days of inactivity; existing historical processing records follow their existing behavior.
- Live AI output quality, production latency under load, and full end-to-end accessibility compliance remain to be verified after deployment.
- Deploy through the existing GitHub-to-Railway production route, then verify the health version `docs-background-jobs-v1`, authentication on job endpoints, and representative signed-in uploads. Avoid deployment while users have active processing.
- If the release must be rolled back, revert its code commit through the same deployment route. The additive `document_tasks` table can remain; do not restore or overwrite the production database.
