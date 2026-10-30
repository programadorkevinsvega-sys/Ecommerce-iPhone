# PR 01 — Payment and refund consistency

**Priority:** P0  
**Status:** Planning scaffold only; implementation and verification are pending.

## Scope
- Make payment and refund finalization recoverable and idempotent.
- Keep provider state, payment state, order state, refund records, and ledger effects consistent.
- Review `markPaid()`, `refundPayment()`, and `completeRefund()`, including failure recovery and refund locks.
- Preserve an auditable administrative refund flow.

## Acceptance criteria
- Repeated provider callbacks and retries do not duplicate financial effects.
- Partial failures can be recovered without contradictory payment/order states.
- Ledger entries and refund records are consistent and traceable.
- Tests cover success, retries, lock contention, and failures at each persistence boundary.

## Verification
Run targeted payment tests, the full test suite, type checks, architecture checks, and production build. Attach CI evidence before marking ready for review.

## Dependency
Coordinate with the existing open PR #19 where shared-kernel changes overlap.