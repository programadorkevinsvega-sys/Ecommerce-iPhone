# Production hardening and operational evidence

**Updated:** 2026-11-02  
**Branch:** `feat/phase10-production-readiness`  
**Status:** This document consolidates the production-hardening baseline already integrated into `main` and the additional operational telemetry/readiness work in this continuation. CI and external operational acceptance remain pending on the final PR HEAD.

## HTTP request correlation

- The Worker accepts a validated inbound `X-Request-Id` or creates a UUID for Worker-owned responses.
- Next.js middleware reuses a valid ID (or creates one), forwards it to route handlers and returns the same value in `X-Request-Id`.
- The Worker adopts the validated middleware response ID rather than replacing it.
- Accepted identifiers are bounded to 8–128 ASCII letters, digits, dot, underscore, colon or hyphen. Malformed values are not trusted.
- Mutating API requests retain same-origin checks and API responses remain non-cacheable except for the explicit public content cache path.

## Transactional outbox and queue correlation

- Checkout passes the middleware request ID into the order application.
- The order repository prepares the `OrderCreated` outbox event with that optional identifier in the same transactional workflow as order persistence.
- Additive migration `0045_production_hardening.sql` adds `notification_outbox.request_id` and an index for non-null values.
- D1 Outbox serialization/deserialization persists the ID, and the notification Queue publisher forwards it when present.
- Analytics events continue to preserve an optional request ID provided by their API producers.
- Events produced outside a request context may legitimately have no request ID; they still retain their durable outbox/job identifier.

This creates HTTP-to-Notification correlation for the checkout order-created path without making request IDs mandatory for scheduled or system-originated events.

## Structured logs and sensitive-data minimization

Server and Worker failures use JSON records with timestamp, level, source, operation, safe context and normalized error details. The logger redacts sensitive context keys and common credential, email, payment-card and private-key patterns. Raw stack traces are omitted because they may embed provider payloads, query values or personal data.

Queue publisher, consumer, dead-letter persistence and scheduled-handler failures include component, queue/schedule, outcome and available correlation identifier. Queue message bodies and credentials are not written to application logs. Notification Outbox error persistence retains its sanitization path.

Redaction is defense in depth, not permission to pass sensitive data to the logger. New log fields must be reviewed for privacy before being added.

## Browser security headers and CSP

The baseline response-header map is centralized in `apps/web/lib/securityHeaders.ts` and is consumed by Next.js and the Cloudflare Worker response wrapper. Worker-owned health, readiness, rate-limit and redirect responses receive the same baseline protection.

For document requests:

1. Middleware generates a fresh cryptographic nonce.
2. The nonce and matching CSP are forwarded into Next.js rendering.
3. The response carries the same policy; the Worker preserves it.
4. Inline executable scripts and style elements must carry the request nonce.

The policy keeps same-origin defaults, `frame-ancestors 'none'`, `object-src 'none'`, explicit Cloudflare Insights script origin, and disables `unsafe-inline` and `unsafe-eval`.

Next.js Image emits `style="color:transparent"` on optimized images. The `style-src-attr` directive allows only the exact SHA-256 hash of this non-executable presentation hint using `unsafe-hashes`; it does not allow arbitrary inline CSS. Unit tests pin the hash, while Playwright monitors browser console output for CSP violations. This is deliberately narrower than `unsafe-inline`.

Other baseline headers include HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP and X-DNS-Prefetch-Control. Product images remain restricted to same-origin media paths through Next image configuration.

## Administrative authentication and sensitive mutations

Admin authorization remains server-side through persisted session resolution and effective RBAC permissions. Session tokens are stored as hashes; sessions enforce expiry/revocation, secure HttpOnly/SameSite cookies, throttling and audit records.

Sensitive operations additionally require password reauthentication through the admin step-up flow:

- Random proof tokens are stored as hashes, never in plaintext.
- Grants are bound to the current admin identity and hashed session token.
- Grants are scoped to `payments:refund`, `payments:void`, `admins:manage` or `settings:write`.
- Grants expire after five minutes and are recorded in the admin security audit.
- Failed password attempts are tracked and lockout is enforced.
- API routes return HTTP 428 when step-up proof is required; the admin UI obtains it before retrying the operation.

TOTP is mandatory before an administrative session is issued. The seed is encrypted at rest with the Worker Secret, recovery codes are hashed and single-use, accepted TOTP time steps are persisted to block replay, and privileged step-up requires password plus a valid second factor. The emergency break-glass procedure remains an operator-controlled, out-of-band process; it is not exposed as a public bypass.

The implementation is present in `main`, but production acceptance still requires the operator to confirm the Cloudflare encryption secret and migration 0047, enroll and log in with a real authenticator, consume/reissue recovery codes, and exercise a privileged step-up operation.

## Accessibility verification

Playwright checks the critical routes `/`, `/cart`, `/checkout` and `/admin/login` for Spanish document language, exactly one main landmark, accessible names for links/controls, image alt attributes, and Axe violations for WCAG 2.0/2.1/2.2 A/AA rule tags. It also checks that the first keyboard focus target has an accessible name and that app-authored inline styles are not introduced outside the exact framework exceptions described above.

This is a focused automated regression suite, not a claim of WCAG 2.2 AA certification. Manual keyboard-only journeys, full focus-order review, color contrast, zoom/reflow and screen-reader testing remain open.

## Performance verification

The scheduled production smoke runs every six hours and measures TTFB, DOMContentLoaded, load, LCP, CLS and Event Timing interaction samples. Current thresholds include:

| Metric                       | Threshold |
| ---------------------------- | --------: |
| TTFB                         |    800 ms |
| DOMContentLoaded             |  2,500 ms |
| Load event                   |  4,000 ms |
| LCP                          |  2,500 ms |
| CLS                          |       0.1 |
| Event Timing interaction P98 |    200 ms |

The interaction percentile is a lab sample, not field INP. Missing measurements remain inconclusive. Cloudflare edge challenges are classified as inconclusive instead of being reported as storefront failures or passes. No improvement or Core Web Vitals pass is claimed without reproducible production/field measurements.

## Payment and Worker architecture

- `PaymentService` stays in the Payments Application layer and depends on repository, provider, order and reservation ports.
- Payment domain rules remain independent from Cloudflare and provider SDKs; adapters and composition remain in Infrastructure.
- Architecture checks validate module-layer boundaries and reject direct D1 execution or infrastructure imports from presentation routes.
- Existing payment idempotency, payment finalization and refund recovery contracts are preserved; no broad rewrite was justified by the inspected dependency graph.
- The Worker remains the Cloudflare composition root for HTTP, Queue and Scheduled handlers, not a domain service.

## GitHub Actions and Node.js runtime policy

GitHub-hosted Actions runners removed Node.js 20 support on September 23, 2026. The repository therefore uses the supported Node.js 24 runtime instead of attempting to force the retired Node.js 20 action runtime.

- Application and build commands are pinned to Node.js `24.18.0`, matching the exact `package.json` engine and `scripts/verify-install.mjs` guard.
- JavaScript actions use Node.js 24-compatible releases: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6` and `actions/upload-artifact@v7`.
- The runner diagnostics job installs and verifies the same exact Node.js `24.18.0` runtime used by the repository CI job.
- Do not set the removed `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` escape hatch or downgrade the project toolchain to an end-of-life Node.js release.

This alignment also replaces the older action bundles associated with the observed `DEP0169` (`url.parse()`) and `DEP0040` (core `punycode`) warnings. CI logs must be checked on the new HEAD to confirm whether any warning remains.

## Migration and CI/CD ownership

Migration `0045_production_hardening.sql` is additive and introduces the Outbox request ID field/index and the admin step-up grants table.

GitHub Actions validates frozen-lockfile installation, full dependency audit, formatting, repository foundations, frontend data, architecture, lint, TypeScript, unit/integration tests, isolated local D1 preparation, OpenNext/Worker build, generated artifacts and Wrangler/Playwright E2E. It does not apply remote production migrations.

Cloudflare remains responsible for the configured Worker deployment and the remote D1 migration sequence. Production migrations must not be moved into CI. A Cloudflare Preview build can be checked through the PR bot, but Preview URLs are disabled, so there is currently no public Preview URL for functional browser verification.

## Remaining acceptance items

1. Confirm the Cloudflare `ADMIN_MFA_ENCRYPTION_KEY` Worker Secret and migration 0047; manually validate TOTP enrollment/login, one-time recovery-code consumption/regeneration, and privileged step-up using a real authenticator.
2. Complete manual accessibility validation for keyboard journeys, focus, contrast, 200/400% zoom/reflow and assistive technology.
3. Deploy migration 0046 through Cloudflare, confirm the production build-time RUM sample rate, collect real LCP/INP/CLS observations, and review sample counts before interpreting p75.
4. Confirm Repository CI and the Cloudflare Workers Build result for the exact final PR HEAD. Preview functional checks remain unavailable until isolated preview resources are configured.
5. Validate the rollback/recovery runbook in an isolated environment when one exists; do not claim a production rollback exercise that has not been performed.

## Admin MFA, error tracking and operational telemetry

Admin TOTP is implemented in the application and D1 repository. The production Worker Secret and remote migration 0047 remain external deployment prerequisites. The manual production smoke now verifies the mandatory password-to-TOTP challenge and proves that the challenge cookie cannot access admin APIs; it deliberately does not submit a generated code, read a TOTP seed, or claim successful authenticator acceptance.

The Worker emits one structured `http.request` metric record per HTTP request with a low-cardinality route group, method, status, duration and request ID. Unhandled Worker HTTP exceptions are logged with a safe generic 500 response. Next.js segment and global error boundaries report only the framework digest and a normalized route group; browser messages, stacks, URLs and form values are not accepted by the endpoint. Queue and scheduled failures retain their existing structured error logs.

Readiness checks execute D1 `SELECT 1`, an R2 list operation and a Notification Hub Durable Object health request. Queue bindings are reported as `configured`, not as a proof of queue consumption; external email/payment connectivity is not probed by readiness. See `docs/phase10-operational-acceptance.md` for the exact evidence boundary and remaining manual acceptance.

Field Web Vitals remain separate from Lighthouse lab reports. RUM records still depend on Cloudflare applying migration 0046 and real traffic producing sampled observations. The p75 endpoint is restricted to administrators with `audit:read`; sample counts must be reviewed before interpreting percentiles.

The automated accessibility suite includes Axe on home, catalogue, product, cart, checkout and admin login, keyboard navigation, visible focus, native required-field checks and narrow-width overflow checks. Manual screen-reader, 200/400% zoom, contrast, and browser/AT matrix execution remain explicitly pending; no manual result or WCAG certification is invented.
