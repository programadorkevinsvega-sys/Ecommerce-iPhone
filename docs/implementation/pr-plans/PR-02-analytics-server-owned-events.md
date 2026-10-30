# PR 02 — Server-owned financial analytics

**Priority:** P0  
**Status:** Implementation added; automated verification pending.

## Scope
- Prevent clients from authoritatively emitting or modifying financial analytics events.
- Derive purchase, payment, refund, and revenue events from trusted server-side transitions.
- Validate event ownership, idempotency, and attribution boundaries.
- Keep conversion reporting grounded in canonical orders and payment-ledger records rather than browser-supplied events.

## Implemented protections
- Split the browser analytics contract from server-owned event types.
- Reject server-owned event types in AnalyticsService unless the trusted caller explicitly marks the event as server-originated.
- Keep the public analytics endpoint from accepting a client-supplied source and return HTTP 403 for attempts to submit server-owned events.
- Mark successful cart, checkout, and payment-intent events as server-originated.
- Derive completed purchase and revenue metrics from the payment ledger; derive checkout counts from persisted orders.
- Preserve stable idempotency identifiers for purchases and revenue ledger projections.

## Acceptance criteria
- [x] Client input cannot fabricate revenue, successful payments, or refunds through the public analytics endpoint.
- [x] Financial events are emitted only after the corresponding trusted server transition.
- [x] Retries do not duplicate stored purchase or revenue analytics events.
- [x] Conversion and financial totals use canonical order/payment data.
- [ ] Tests cover forged payloads, duplicate callbacks, and legitimate event creation.
- [ ] Format, lint, types, architecture checks, full tests, and production build pass in CI.
- [ ] CI evidence is attached before the PR leaves Draft.

## Verification
The GitHub Actions Payment consistency workflow is the verification gate for formatting, repository foundations, frontend data, architecture, lint, type checks, full Vitest suite, and Cloudflare build. Do not treat a Cloudflare Git-integration deployment result as CI evidence.
