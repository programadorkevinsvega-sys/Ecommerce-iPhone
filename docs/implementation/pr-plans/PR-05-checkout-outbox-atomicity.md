# PR 05 — Checkout and notification outbox atomicity

**Priority:** P1  
**Status:** Planning scaffold only; implementation and verification are pending.

## Scope
- Ensure order creation and durable notification/event recording cannot silently diverge.
- Review transactional boundaries around order persistence and `order_events`.
- Define recovery for failures between order creation and event consumption.

## Acceptance criteria
- A committed order has a durable corresponding outbox/event record.
- Retries and consumers are idempotent.
- Failed delivery remains observable and recoverable.
- Tests cover transaction failure, duplicate delivery, and consumer recovery.

## Verification
Run checkout/outbox tests, type checks, architecture checks, and production build.