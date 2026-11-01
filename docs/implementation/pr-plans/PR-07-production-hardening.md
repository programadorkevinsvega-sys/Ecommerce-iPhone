# PR 07 — Production hardening and documentation

**Priority:** P2  
**Implementation branch:** `chore/production-hardening` (existing PR #26; no replacement PR)  
**Status:** Production-hardening code is implemented in the branch. Final CI evidence must be recorded against the exact latest PR HEAD. External acceptance items remain open, so the PR stays Draft.

## Baseline and boundaries

- PR #26 is based on `main` at `b608048786b751bc54277593c9d5feab0240524d`; the branch is ahead and has no commits behind main.
- This work remains on the existing branch `chore/production-hardening`.
- Repository CI owns dependency installation/audit, formatting, repository checks, architecture, lint, TypeScript, unit/integration, local D1 preparation, OpenNext build verification and Playwright E2E.
- CI prepares isolated local D1 only. Cloudflare remains responsible for Worker deployment and remote D1 migrations.
- The existing scheduled performance workflow runs every six hours and classifies Cloudflare edge challenges as inconclusive.

## Scope and delivery status

### A — Admin authentication and sensitive operations

- [x] Preserve server-side persisted session resolution and effective RBAC checks.
- [x] Preserve hashed session tokens, expiry/revocation, secure HttpOnly/SameSite cookies, throttling and audit records.
- [x] Add short-lived, password-based step-up grants for refunds, voids, admin user/permission management and sensitive settings writes.
- [x] Bind step-up proofs to admin identity, session hash and permission scope; store only token hashes, expire after five minutes, audit attempts and enforce lockout.
- [x] Cover grant issuance, invalid password/scope, missing/inactive admin and D1 persistence with unit/integration tests.
- [ ] Provider-backed MFA and recovery/break-glass policy. The current step-up rechecks the existing password and is explicitly **not MFA**; no provider or second factor is simulated.

### B — CSP and HTTP response security

- [x] Centralize security response headers for Next.js and Worker-owned responses.
- [x] Generate a fresh per-document nonce in middleware and propagate it through Next.js/OpenNext response rendering.
- [x] Require the nonce for inline script/style elements; keep `unsafe-inline` and `unsafe-eval` disabled.
- [x] Allow only the exact Next.js Image `color:transparent` style-attribute hash via `unsafe-hashes`; do not allow arbitrary inline style attributes.
- [x] Unit-test the nonce policy/hash and exercise nonce propagation and browser CSP-violation detection with Wrangler/Playwright.

### C — Structured logs and correlation

- [x] Emit structured JSON error records with timestamp, level, source, operation, safe context and normalized errors.
- [x] Redact sensitive context keys and common credential, email, payment-card and private-key patterns; omit raw stacks.
- [x] Align middleware, route-handler, Worker and response `X-Request-Id` values.
- [x] Persist optional checkout request IDs through order-created Notification Outbox rows and queue payloads using additive migration `0045_production_hardening.sql`.
- [x] Preserve optional request IDs in Analytics events and ensure Queue logs never include raw message bodies.

### D — Accessibility and performance

- [x] Add Playwright language, main-landmark, accessible-name and image-alt checks for home, cart, checkout and admin login.
- [x] Run Axe checks against WCAG 2.0/2.1/2.2 A/AA tag sets on those routes.
- [x] Add a keyboard first-focus accessible-name smoke and guard against app-authored inline styles.
- [x] Extend the scheduled performance probe to report LCP, CLS and Event Timing interaction samples while preserving TTFB/DOMContentLoaded/load and edge-challenge classification.
- [ ] Complete manual keyboard-only journeys, full focus-order review, contrast, zoom/reflow and screen-reader testing; automated Axe smoke is not WCAG certification.
- [ ] Validate LCP/INP/CLS thresholds using reproducible lab/field evidence. Event Timing lab P98 is not field INP.

### E — Payment and Worker architecture

- [x] Verify PaymentService uses Application-layer ports and Payment domain remains independent of Cloudflare/provider SDKs.
- [x] Keep D1/provider adapters in Infrastructure and retain existing payment idempotency/finalization/refund-recovery behavior.
- [x] Keep Worker as Cloudflare composition root; no speculative domain refactor was added.

### F — Documentation and operational boundaries

- [x] Update `docs/security.md` for per-request CSP nonces, exact Next Image style hash, step-up scope and current security boundaries.
- [x] Update `docs/production-hardening.md` with request/outbox correlation, observability, accessibility, performance and migration ownership.
- [x] Update this plan to reflect implemented code and the remaining acceptance items.
- [ ] Record final Repository CI and Cloudflare Preview results on the exact latest PR HEAD; Preview URL is disabled and cannot be used for functional browser checks.

## Required release evidence

The final PR HEAD must have successful Repository CI covering:

- Frozen-lockfile install, toolchain and complete dependency audit.
- Changed-file formatting, repository foundations, frontend-production-data and architecture checks.
- ESLint, TypeScript and full unit/integration suite.
- Isolated local D1 preparation.
- OpenNext/Cloudflare Worker build and generated page/bundle verification.
- Playwright E2E against local Wrangler, including CSP and accessibility checks.
- Production branch guard and aggregate `CI required`.

Cloudflare Preview build status must be recorded separately. A Preview build is not a functional Preview test when the URL feature is disabled.

## Exit criteria for Draft

- [x] Implementation and targeted regression tests are committed to the existing PR branch.
- [x] Documentation describes actual behavior and does not call password step-up MFA.
- [ ] Mandatory Repository CI passes on the exact final HEAD.
- [ ] Cloudflare Preview build result is confirmed for the exact final HEAD.
- [ ] Provider-backed MFA/recovery, manual accessibility review and Web Vitals evidence are completed or explicitly accepted as residual risks by the project owner.

Keep PR #26 in Draft until the remaining acceptance decisions are made. Do not merge or initiate a production deployment as part of this hardening work.
