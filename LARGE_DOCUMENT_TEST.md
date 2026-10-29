# Remedy Docs: isolated large-document test

This is a separate prototype based on production commit `c72ecc97`, not a deployed change to remedy508.com. Existing routes, the 50-page tool, accounts, billing and database are untouched.

## What it does

- Accepts one PDF with 1–400 pages, no more than 25 MB.
- Offers one PDF or one native Word download. Sections are internal, not separate user downloads.
- Processes internally in 20-page sections, with up to four model calls at a time.
- Saves each successful page response and each prepared section to a private job directory.
- Supports percentage progress, pause/resume, refresh recovery, interrupted-worker recovery and duplicate-upload reuse.
- Retains completed/paused test files for 24 hours and offers explicit removal.
- Rejects encrypted, invalid, over-limit and excessively large-resolution inputs.
- Bounds the test store to eight jobs and the waiting queue to four admissions/jobs.

## Architecture

`LargeDocumentTest.tsx` is the standalone interface. `server/largeDocuments.ts` handles owned job records, the queue, subprocesses, recovery and downloads without opening the application database.

`large_document_worker.py` uses the existing extractor and image helpers. It checkpoints semantic HTML, preserves source-page anchors and original link destinations, and assembles all sections before rendering the final document. It does not concatenate separate tagged PDFs.

`large_document_render.py` is a versioned snapshot of the deployed renderer, with prepared-section input, prepare-only and HTML-only stages. Future renderer changes must be deliberately ported and regression-tested; this snapshot does not automatically track the production inline renderer.

`large_document_word.py` creates native headings, paragraphs, lists, tables, bookmarks, links and embedded images from that same semantic content. It validates image counts, nonempty alternative-text fields and internal bookmark targets. Illegal XML control characters from native PDF extraction are normalized to spaces.

Image-heavy, text-sparse first-page covers are treated as one visual composition to preserve overlapping artwork. Ordinary document pages are not flattened. Vector figures use source-page crops. Original content can reflow and the output page count can change.

## Private preview

Build with `npx vite build --config script/large-docs-preview/vite.config.ts`.

Start locally with `npx tsx script/large-docs-preview/server.ts`. It listens on port 8766 by default. For a Computer preview, build with `VITE_LARGE_DOCS_API=__PORT_8766__` and start the server using the platform's website LLM credential preset. Never include credentials in the frontend or source archive.

Configuration:

- `LARGE_DOCS_DATA_DIR`: private files, outside the served build directory.
- `LARGE_DOCS_MODEL`: preview default `claude_sonnet_5_5`. Production currently uses a different configured model; repeat quality checks with the intended deployment model.
- `LARGE_DOCS_CHUNK_SIZE`: default 20. Set to 1 only to exercise section boundaries with the small AI sample.
- `LARGE_DOCS_FAKE_AI=1`: deterministic workflow testing only. Output is visibly labeled as not accessibility-remediated.
- `PORT`: default 8766.

The preview entry uses a fixed owner because the Computer preview is private to its user. It explicitly refuses `NODE_ENV=production`. Do not expose this entry publicly. The reusable manager supports per-owner isolation, but authenticated production routing is not installed.

## Tests

Run:

```sh
python3 script/test_large_documents.py
npx tsx script/test_large_document_queue.ts
python3 script/test_pdf_image_fidelity.py
python3 script/test_complex_pdf_extract.py
python3 script/test_text_pdf_images.py
node script/test_document_routes.mjs
```

The large-document fixture script currently references the supplied catalog attachment; replace that input path when reproducing outside this workspace.

The 374-page test is a deterministic scale/assembly test, not a 374-page AI remediation. It deliberately turns extracted lines into paragraphs and can expand pagination dramatically. Its timings and layout are not representative of the real-AI path.

The real-AI sample uses original catalog pages 1, 5 and 6, including the complete cover, Enrique Perez portrait and district map. Both PDF and Word outputs must be inspected visually and structurally, not just checked for HTTP success.

## Before any live rollout

- Obtain separate deployment approval.
- Run the full catalog through actual AI and review its content, tables, reading order and alternative text with accessibility tools and assistive technology.
- Add verified Clerk ownership and an explicit tester allowlist; decide large-document credit reservation/refund rules.
- Use a durable private volume and a dedicated worker/service rather than adding this workload to the live request process.
- Size memory from measured load. The offline full-catalog fixture exceeded 1.6 GiB peak child-process RSS; do not assume the current live service has sufficient headroom.
- Set production model, resource/time limits, job-expiry policy, monitoring and restart behavior.
- Test concurrent workloads, worker interruption, deployment recovery and ongoing renderer parity.

No accessibility certification or guarantee for all documents is implied by these tests. Some source text in the catalog already contains run-together sentences; this version does not silently rewrite those institutional statements.
