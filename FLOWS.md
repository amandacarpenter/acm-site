# Trial pricing-card change: flow inventory

## Large-document isolated test version
- Live site and main branch remain unchanged. This branch starts from c72ecc97.
- Upload one PDF (test ceiling: 400 pages, 25 MB), select PDF or Word, receive one file.
- Keep the current brand, simple output selector and percentage progress bar.
- Reuse production extraction, image normalization and a versioned copy of its PDF renderer.
- Assemble semantic content BEFORE the final render, rather than concatenate tagged PDFs.
- Persist page responses and completed sections; resume without rerunning completed AI pages.
- Pause, resume, recover after refresh/restart, retry failures, and clear test files.
- Preview uses a separate filesystem store, no production accounts/database/credits.
- Production routes are not integrated at all. Any later integration requires verified
  user ownership, an explicit tester allowlist, credit rules and separate deployment approval.
- Both actual AI and deterministic workflow tests must be identified accurately.
- Test 374-page catalog assembly in both formats; bounded actual-AI sample separately.
- Test invalid/encrypted/oversized inputs, owner isolation, duplicate submit, recovery, expiry,
  combined headings, cross-page anchors, image colors, alt text, and single-download behavior.
- Inspect desktop/mobile/short viewport, errors, progress and download states in browser.

## October 28 PDF image-fidelity fix
- No UI, account, pricing, credit-allocation or database schema changes.
- Public homepage, pricing, free checker, simulator and tool information remain reachable.
- PDF vision path: retain large cover photographs alongside smaller images.
- Interpret DeviceN/Separation, ICC and Decode color semantics before HTML embedding.
- Preserve real inline images, repeated placements, source proportions and displayed size.
- Vector figures: source screenshot crop when a valid bounding box is supplied.
- Unknown IDs/bad crops/corrupt image files: fail rather than insert a transparent pixel.
- Model-omitted raster images: restore pixels and mark alt text/reading order for review.
- Verify final PDF image pixels and occurrence counts, not just tags or resource existence.
- Test original SCC pages 1–15 plus synthetic color/mask/scan/corruption fixtures.
- Run actual isolated job routes with mocked AI/auth: PDF, Word, refunds, retrieval and ownership.
- These are local pipeline/regression checks, not a live AI run or screen-reader certification.
- User approval required before production deployment. No production Credits used.

## October 27 optional-trial revision
- Get Started leads to pricing without activating a trial; Free Trial is separate.
- Pricing shows matching Free Trial / Individual / Team cards; FAQ unchanged.
- Signup/login from a trial CTA returns to pricing, not a separate landing page.
- Activation remains explicit and requires consent; merely viewing plans grants nothing.
- All trial states (eligible, active, expired, exhausted, unverified, error,
  ineligible) render inside the card. Existing accounts cannot restart a trial.
- Legacy /free-trial links redirect to /pricing?trial=1.
- Desktop and mobile headers retain both Get Started and Free Trial for guests.
- Keep backend allocation, expiry, credit reservation/refunds and paid checkout unchanged.
- Review at 1440/1280/1024/375/320px; exercise paid and trial paths independently.

## Embedded-preview recovery
- Start directly on pricing regardless of the viewer's URL or fragment.
- Load from a sandboxed srcdoc frame with no same-origin permission.
- Keep navigation in memory; do not call browser history from preview navigation.
- Use external JavaScript/CSS to avoid corrupting embedded document HTML literals.
- Exercise account preview, consent, activation, dashboard, home and mobile menu.
- Production routing, authentication, billing and deployment remain unchanged.

Baseline: main commit e11ac661. Live homepage and pricing reviewed in the preceding rollout.
Authenticated production flows require a designated test account and are not implied
by mocked local checks. Do not run production purchases or processing without approval.

## Shared navigation
- Home uses HomeHeader; interior pages use SiteHeader.
- Desktop and mobile: checker, Remedy Tools, simulator, pricing, login/account remain.
- Requested delta: separate Get Started and Free Trial buttons open pricing.
- Test 1440, 1280, 375px and keyboard; no horizontal clipping.

## Trial entry
- Pricing: show a matching 14-day / 30-Credit / no-card plan alongside paid cards.
- Keep the existing pricing FAQ, credit explanation, fonts and hero unchanged.
- Signed out: offer says 14 days, 30 Credits, no card; trial signup/login return to pricing.
- Eligible verified account: explicit activation grants once and shows end date/balance.
- Unverified, existing paid, existing legacy trial, duplicate email, service failure:
  show clear feedback, never grant or charge.
- Repeat/concurrent activation: same original grant and clock.

## Tools and dashboard
- New trial can enter all four existing tool tabs using existing metering.
- Expired/exhausted trial cannot start new work; dashboard shows expiry and upgrade.
- Expired/exhausted trial retains the Tools view and document-result retrieval;
  refocusing the window must not discard a job that used the final Credit.
- Accepted jobs/refunds retain their original Credit source.
- Existing paid and legacy-trial entitlements unchanged.

## Free tools and unrelated pages
- Checker and simulator load without trial, signup, or card.
- Pricing, Remedy Tools, contact, guides, login, signup remain reachable.
- Existing paid checkout handlers, invoice flow, and authentication defaults unchanged
  except explicit trial-return links.

## Backend checks
- Isolated SQLite/Express tests: 30 once, exact 14 days, identity verification,
  one grant per email/account, expiry, concurrent debit, failure refund, paid precedence,
  no monthly refill, reopen persistence, and legacy preservation.
- Mock identity/provider tests are not live Clerk/Stripe or output-accessibility tests.
