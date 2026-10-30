# PR 06 — Critical commerce and security E2E coverage

**Priority:** P1  
**Status:** Planning scaffold only; test implementation and verification are pending.

## Scope
- Add end-to-end coverage for catalog pricing, checkout, payment provider callbacks, refunds, RBAC, and IDOR boundaries.
- Exercise supported Mercado Pago, PayPal, and Binance Pay sandbox flows where credentials and environments are available.
- Cover stale catalog price behavior between product selection and checkout.

## Acceptance criteria
- Critical customer and administrative journeys have repeatable automated coverage.
- Server-side prices are authoritative at checkout.
- Unauthorized cross-user access and role escalation are rejected.
- External-provider tests use sandbox credentials and do not affect live transactions.

## Verification
Document required secrets/environment setup, run E2E in CI, and attach evidence. Clearly mark provider scenarios not executable due to missing sandbox access.