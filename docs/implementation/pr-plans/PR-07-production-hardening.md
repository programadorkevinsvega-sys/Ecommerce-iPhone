# PR 07 — Production hardening and documentation

**Priority:** P2  
**Status:** Partial implementation published. Repository CI [#41232292845](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41232292845) passed on code HEAD `f20a35d5ed485ceb18c53b793b5fd2b5ec98e85d`; Cloudflare Preview for `f20a35d` was still in progress at the latest bot update. The documentation-only update below requires a fresh CI run on the new HEAD.

## Baseline confirmed on 2026-10-31

- PR #25 is merged; Repository CI run `41227903747` completed successfully on `main` commit `b608048786b751bc54277593c9d5feab0240524d`.
- PR #26 initially contained only this planning document. Its branch was 32 commits behind `main` and was synchronized onto that commit without creating another branch or changing `main`.
- PR #19 is closed and unmerged. The actual current media primitive is `modules/shared-kernel/MediaReference.ts`; `modules/shared-kernel/domain/MediaReference.ts` is absent.
- Repository CI already owns frozen-lockfile install, audit, format, foundations, architecture, lint, typecheck, unit/integration, local D1, Cloudflare Worker build verification and Playwright E2E.
- The existing performance workflow already runs every six hours and measures TTFB, DOMContentLoaded and load event. It classifies Cloudflare edge blocks as inconclusive.

## Latest verification evidence

Repository CI run [#41232292845](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41232292845) completed successfully on code HEAD `f20a35d5ed485ceb18c53b793b5fd2b5ec98e85d`:

- [x] Frozen-lockfile install, toolchain, dependency audit, changed-file format, repository foundations, frontend-data and architecture checks.
- [x] ESLint and TypeScript.
- [x] Full unit/integration suite: 305 tests passed.
- [x] Isolated D1 preparation, OpenNext/Cloudflare Worker build and generated artifact verification.
- [x] Chromium installation and 11 Playwright E2E tests against local Wrangler.
- [x] Production branch guard: rejects `feature/test` and `preview`, accepts only `main`.
- [x] Aggregate `CI required` job.

The Cloudflare Preview bot reported the Preview build for `f20a35d` as in progress; the Preview URL feature is disabled. This documentation-only update creates a new HEAD, which must receive a fresh CI run before the PR is considered fully verified.

## Scope and delivery status

### A — Authentication and sensitive administrative operations

- [x] Confirm server-side persisted session resolution and effective RBAC checks on protected admin operations.
- [x] Confirm hashed session tokens, session expiration/revocation, secure HttpOnly/SameSite cookies, authentication throttling and audit records.
- [x] Add regression coverage for missing and invalid/expired sessions at the `RequireAdmin` authorization boundary.
- [ ] Provider-backed MFA/step-up authentication. No verified provider exists in the repository. No simulated factor was introduced. Documented compensating controls do not provide the same assurance as a true step-up challenge.

### B — Content Security Policy and HTTP headers

- [x] Centralize the existing CSP/security header policy for Next.js and Worker-generated/wrapped HTTP responses.
- [x] Apply the shared baseline to health, readiness, rate-limit and redirect responses produced by the Worker.
- [x] Add unit coverage for key header values and CSP origin/directive constraints.
- [ ] Replace script/style `'unsafe-inline'` with runtime nonces or hashes. This requires independently verified nonce propagation through the Next.js/OpenNext Worker path. `'unsafe-eval'` remains disabled.

### C — Structured logs and correlation

- [x] Emit JSON error records with timestamp, severity, source, operation, minimal context and normalized error details.
- [x] Redact sensitive context keys and common credential, email, payment-card and private-key patterns; omit raw stack traces.
- [x] Align API route request IDs with response `X-Request-Id` by forwarding the middleware ID and preserving it in the Worker.
- [x] Log Queue publisher, consumer, dead-letter persistence and scheduled-handler failures with queue/schedule, outcome and available correlation key. Never log raw Queue bodies.
- [x] Preserve existing analytics event `requestId` through the analytics Queue contract where the producer supplied it.
- [ ] Persist originating HTTP request ID through Notification Outbox events. Current notification jobs correlate by durable `outboxId`; the outbox schema has no originating request ID.

### D — Accessibility and performance

- [x] Add a Playwright homepage smoke for document language, main landmark, image alt attributes and accessible names of visible links/controls.
- [x] Extend the existing scheduled browser performance smoke to report LCP, CLS and Event Timing interaction samples while preserving existing TTFB/DOMContentLoaded/load budgets and Cloudflare block classification.
- [ ] Complete keyboard-only, focus visibility, color contrast, zoom/reflow and critical checkout form checks; the homepage smoke is not a WCAG 2.2 AA audit.
- [ ] Establish and enforce LCP/INP/CLS budgets from reproducible lab/field measurements. Event Timing lab samples are not field INP; no production pass or improvement is claimed.

### E — PaymentService and Worker architecture

- [x] Review PaymentService boundaries: Application depends on ports and the Payment domain is independent from Cloudflare/provider SDKs.
- [x] Verify existing architecture checks and keep D1/provider adapters in Infrastructure.
- [x] Preserve payment idempotency and refund recovery; no broad refactor was justified by the inspected dependency graph.
- [ ] Refactor scheduled/Queue orchestration only if a concrete boundary or testability violation is identified; the Worker remains the Cloudflare composition root, not a domain service.

### F — Technical and operational documentation

- [x] Update `docs/security.md` with current headers, session controls, logger privacy behavior and MFA limitation.
- [x] Add `docs/production-hardening.md` with contracts, observability limits, security residual risks, operational checks and remaining work.
- [ ] Complete the final acceptance update after the documentation-only HEAD passes Repository CI and Cloudflare reports the Preview build outcome.

## Verification required for the final PR HEAD

The current code HEAD `f20a35d5ed485ceb18c53b793b5fd2b5ec98e85d` passed all gates listed below in run [#41232292845](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41232292845). Because this plan and the operations document are being updated in a new documentation-only commit, run the same workflow again on that exact new HEAD before marking the PR accepted:

- Frozen-lockfile install and toolchain validation.
- Full dependency audit.
- Changed-file formatting, repository foundations and frontend production-data checks.
- Architecture, ESLint and TypeScript.
- Unit/integration suite, including new logger, request-correlation, security-header and session-authorization regressions.
- Local D1 preparation, OpenNext/Cloudflare Worker build and generated artifact verification.
- Playwright E2E, including the new platform-hardening smoke.

Review Cloudflare preview/build output separately. A Cloudflare edge challenge is inconclusive, not a storefront performance pass or regression. Do not mark the PR ready or merge it until all mandatory branch checks and review evidence are complete.
