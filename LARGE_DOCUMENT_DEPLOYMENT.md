# Remedy Docs: Large-document deployment candidate

The user approved the successful private catalog result and the existing rate of 1 credit per source page. This candidate adds an explicit large-document choice and signed-in credit handling without changing the accepted AI prompt, extraction, image or assembly pipeline.

## Included

- Standard remains the default and keeps the existing Word/PDF processing paths.
- Large document accepts a PDF with 51–400 actual source pages, up to 25 MB.
- The longer-processing notice and acknowledgment are required before submission.
- A job produces one PDF or one Word document, not separate section downloads.
- Full source-page credit availability is checked before AI starts. Paid credits come from the monthly allowance first, then purchased credits.
- Existing owner-account exemption remains in effect.
- Duplicate uploads and charged pause/resume operations reuse the existing charge.
- Processing failures and removal of unfinished jobs refund once. A refunded retry reserves credits again.
- Unknown external credit-write outcomes block new spending until the stored receipt can be verified; they are never blindly repeated.
- Saved progress survives restart, and completed results remain downloadable at zero credits.
- Large documents report once in the existing document-usage category. No reporting history is reset.
- New credit bookkeeping uses additive tables only. No production database was touched during testing.

## Verification completed locally

- Credit tests: insufficient funds, monthly-plus-purchased allocation, concurrent spending, duplicate requests, owner isolation, refunds, renewal boundaries, trial rollback, owner exemption, denied access, and recovery after a lost network response.
- Lock tests: nested operations and stale asynchronous contexts cannot bypass a later lock.
- HTTP tests: authentication, acknowledgment, source-page minimum, insufficient balance before processing, cross-account denial on every job action, duplicate uploads, both PDF and DOCX output, restart and zero-credit downloads.
- Failure tests: processing failure refunds, a new reservation for a refunded retry, and no double refund on deletion.
- Standard Docs regression: 16 existing route-test groups passed with mock authentication/provider responses and real local renderers.
- Image regression: PDF image fidelity, extraction and text-PDF image tests passed.
- Offline full-catalog assembly: all 374 source pages assembled into PDF and Word. This uses deterministic fixture content, not a fresh AI remediation or independent accessibility certification.
- Browser QA at 1280px and 375px: size selection, acknowledgment, output buttons, credit-error display, preserved standard form, other tool tabs, and file replacement resetting consent. No new page errors or horizontal overflow observed.
- Production and private-preview builds passed. TypeScript still reports seven pre-existing errors in unrelated routes; no new errors were introduced.

The user's report that the earlier real-AI catalog scored 100 on their checker remains user-reported evidence. These integration tests do not certify every document or substitute for fresh production testing.

## Staged rollout approved; production checks pending

The user approved a staged rollout with public visibility withheld until production checks pass. Main remained at `c72ecc97` immediately before this rollout. Public UI and server access stay off independently; only the internal QA account can test the enabled backend.

Before activation:

- Verify the Railway service has a durable `/data` volume and a single application instance. The per-user credit lock is process-local; multiple replicas are not supported by this candidate.
- Verify CPU and memory headroom while standard tools are operating. The candidate refuses to enable large processing below 3 GiB container memory; this is a floor, not a performance guarantee. Earlier offline catalog testing peaked around 1.62 GiB for the worker alone, so additional application/concurrent-work headroom is necessary.
- Verify the production provider/model and repeat a representative real-AI sample. The accepted preview used the Computer alias `claude_sonnet_5_5`; the existing production code names `claude-sonnet-4-6`. They are not assumed equivalent, and Computer proxy credentials must not be copied into Railway.
- Confirm Clerk receipt behavior and production credit handling with a designated test account before public activation.
- Preserve the approved private stage until all production checks pass.
- After deployment, test a fresh signed-in PDF and Word job, inspect the live health checks, verify the stored credit/reporting records, and confirm that standard processing still works.

Subsequent Railway inspection verified one replica, a durable `/data` volume, configured capacity of 24 GB RAM and 24 vCPU, and `claude-sonnet-5-5` in the production provider's model list. This establishes configuration, not load-test success. A SQLite backup was created on the volume and passed `PRAGMA quick_check` before deploying the additive bookkeeping changes.

## Configuration

Default remains off. Activation requires:

```text
VITE_LARGE_DOCS_ENABLED=true       # Build-time UI flag
LARGE_DOCS_ENABLED=true            # Server flag
LARGE_DOCS_PUBLIC_ENABLED=false    # Keep false until production checks pass
LARGE_DOCS_MODEL=<verified production model ID>
LARGE_DOCS_SINGLE_INSTANCE=true    # Set only after verifying deployment topology
LARGE_DOCS_DATA_DIR=/data/large-documents
```

The normal production Anthropic credential must be available to the worker. An invalid large-worker configuration disables that feature rather than preventing the other tools from starting.

While public access is off, only accounts with backend-only `privateMetadata.largeDocsQa === true` can reach the large-document endpoints. A hidden frontend alone is not treated as an access restriction.

## Operational notes

- Standard and large processing share the application host in this candidate. A separate worker service remains an option if capacity testing shows contention.
- A paid-write response with no matching receipt remains a support-review item. Do not remove its journal entry or retry the external write blindly; verify whether the original mutation applied.
- Purchased-credit checkout waits for credit reconciliation before fulfillment. A reconciliation deferral returns HTTP 503 so the event is retried rather than silently acknowledged.
- Source/result files normally expire 24 hours after processing. A record with an unresolved refund is retained for reconciliation rather than silently discarded.
- To roll back visibility, disable the UI/server flags. Do not delete the additive credit journal or the durable job directory while outstanding charges/refunds remain.
