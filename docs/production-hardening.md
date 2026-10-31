# Production hardening and operational evidence

**Updated:** 2026-10-31  
**Branch:** `chore/production-hardening`  
**Status:** Partial implementation; Repository CI run [#41232292845](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41232292845) passed on code HEAD `f20a35d5ed485ceb18c53b793b5fd2b5ec98e85d`. The Cloudflare Preview build for that HEAD was still in progress at the last bot update; remaining production acceptance criteria are pending.

## HTTP request correlation

- The Cloudflare Worker accepts a valid inbound `X-Request-Id` or creates a UUID for Worker-owned responses.
- The Next.js API middleware reuses the valid ID (or creates one), forwards it into the route-handler request headers, and returns the same value in the `X-Request-Id` response header.
- After OpenNext responds, the Worker adopts the validated middleware response ID instead of replacing it with a different identifier. This aligns route logs and the externally visible response.
- Accepted identifiers are 8–128 ASCII letters, digits, dot, underscore, colon or hyphen. Malformed values are not trusted.
- Same-origin restrictions on mutating API requests, non-cacheable API responses, and the public content cache exception are preserved.

## Structured logs and sensitive-data minimization

Server and Worker failures use JSON records with timestamp, level, source, operation, safe context and a normalized error object. The logger redacts sensitive context keys and common credential, email, payment-card and private-key patterns in free-form text. Raw stack traces are excluded because they may embed provider payloads, query values or personal data.

Queue publisher, consumer, dead-letter persistence and scheduled-handler failures include component, queue/schedule, outcome and available correlation identifier. Queue message bodies and credentials are not written to application logs. Notification Outbox error persistence retains its existing sanitization path.

This is a defense-in-depth redaction layer, not a substitute for callers passing only minimal structured context. New log fields must be reviewed for privacy before being added.

## Queue correlation contract and boundary

- Analytics events already support an optional `requestId`; the event is serialized through the Analytics Queue publisher and remains available to the consumer. API producers that supply it can be correlated to the originating request.
- Notification queue messages carry the durable `outboxId`. Queue failures therefore remain traceable to an outbox record and retry/dead-letter operation.
- The current Notification Outbox schema does **not** persist the originating HTTP request ID. The notification path is traceable by outbox/job ID, but a complete HTTP-request-to-notification trace is not implemented. An additive outbox correlation field and propagation from request-scoped application services remain a follow-up.

## Browser security headers

The same response-header map is consumed by Next.js and the Cloudflare Worker wrapper, including Worker-owned health, readiness, rate-limit and redirect responses:

- Content-Security-Policy: same-origin default, `frame-ancestors 'none'`, `object-src 'none'`, and one explicit external script origin for the existing Cloudflare Insights integration.
- Strict-Transport-Security: `max-age=31536000; includeSubDomains; preload`.
- X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy.
- Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy and X-DNS-Prefetch-Control.

**Known CSP limitation:** the existing policy retains `'unsafe-inline'` for scripts and styles. It was preserved rather than risking an unverified break to Next.js rendering/hydration or application styling. `'unsafe-eval'` is not enabled. Replacing inline allowances with per-request nonces or hashes requires nonce propagation through the deployed Next.js/OpenNext Worker path and a separate verified production test.

## Administrative authentication and authorization

- Protected admin routes resolve a persisted session server-side and authorize each operation against effective RBAC permissions.
- Admin session tokens are stored hashed; sessions are checked through the session repository and can be revoked. The browser cookie is HttpOnly, Secure and SameSite=Strict.
- Admin authentication has persistent throttling and audit events; logout revokes the active session.
- Sensitive mutations such as refunds require an explicit server-side permission (for example, `refunds:create`). UI state is not the authorization boundary.

**MFA / step-up limitation:** the repository currently uses its own email/password admin authentication and has no verified MFA or step-up provider integration. No simulated second factor was added. Compensating controls currently consist of persisted session resolution, expiry/revocation, per-operation RBAC, login throttling, secure cookies and audit records. These controls do not provide the same assurance as a provider-backed reauthentication challenge. MFA/step-up remains pending until a real provider and recovery policy are selected and integrated.

## Accessibility and performance verification

The new Playwright smoke covers the storefront homepage for document language, a main landmark, image alt attributes and accessible names on visible links and controls. It is a targeted regression check, not a WCAG 2.2 AA certification. Keyboard-only completion, focus visibility, color contrast, zoom/reflow and critical checkout form review remain open.

The scheduled production monitor already runs every six hours across the configured route set. Its existing budgets are TTFB 800 ms, DOMContentLoaded 2,500 ms and load event 4,000 ms. It detects Cloudflare edge challenges and classifies those runs as inconclusive rather than storefront performance failures.

The monitor now also reports browser-observed LCP and CLS, plus Event Timing interaction samples. Its interaction percentile is a lab sample, not field INP; INP is null where the page probe records no interaction. No production measurement has been run for this PR, so this document does not claim a Web Vitals pass or a performance improvement. LCP/INP/CLS budgets must be based on reproducible field/lab evidence before they become release gates.

## Payment and Worker architecture

- `PaymentService` is in the Payments Application layer and depends on repository, provider, order and reservation ports.
- Payment domain rules are separate from Cloudflare and provider adapters; infrastructure adapters and composition remain outside the domain.
- The existing architecture checker validates module layer boundaries and rejects infrastructure imports/direct D1 execution from API presentation routes.
- No payment rewrite was justified by the inspected dependency graph. Existing idempotency, payment finalization and refund recovery contracts are preserved.
- The Worker remains the Cloudflare composition root for HTTP, Queue and Scheduled handlers. The changes add safe observability and shared headers without moving payment rules into the Worker.

## Shared media reference and dependency status

PR #19 is closed without merge. The exact path `modules/shared-kernel/domain/MediaReference.ts` does not exist on current `main`. The actual existing primitive is `modules/shared-kernel/MediaReference.ts`, and Worker uses that path. PR #26 does not reintroduce or relocate it.

## CI/CD ownership and release gate

The Repository CI workflow remains responsible for frozen-lockfile installation, complete dependency audit, changed-file formatting, repository foundations, architecture, lint, typecheck, unit/integration tests, local D1 preparation, OpenNext/Worker build verification and Playwright E2E. Cloudflare remains the owner of its configured Worker deployment and production D1 migration sequence.

The PR branch code HEAD `f20a35d5ed485ceb18c53b793b5fd2b5ec98e85d` passed Repository CI run [#41232292845](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41232292845): frozen install, audit, changed-file format, repository/front-end/architecture checks, ESLint, TypeScript, unit/integration tests, isolated D1 preparation, OpenNext/Worker build, generated artifact verification, Chromium, 11 Wrangler E2E tests and the production-branch guard. The CI job and aggregate `CI required` both concluded `success`. A subsequent documentation-only commit changes the PR HEAD, so the exact new HEAD must receive a fresh CI run before final acceptance. Cloudflare's Preview integration separately reported the `f20a35d` build as in progress at the last update; no Preview URL is enabled. Do not merge or authorize production deployment while that external Preview evidence or remaining risk acceptance is pending.

## Remaining work

1. Integrate provider-backed MFA/step-up authentication and define recovery/administrative break-glass policy.
2. Persist originating request correlation through the notification Outbox for HTTP-to-notification trace continuity.
3. Complete a WCAG 2.2 AA-oriented review of keyboard flows, focus, contrast, reflow, and critical checkout forms.
4. Establish validated LCP, INP and CLS budgets from reproducible lab and/or field data; no Core Web Vitals pass is claimed by the current smoke.
5. Confirm the Cloudflare Preview build for the final PR HEAD; then record its outcome alongside the already successful Repository CI evidence.
