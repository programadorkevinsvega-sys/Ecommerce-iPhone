# PR 01 — Payment and refund consistency

**Priority:** P0  
**Status:** Implementation committed; automated validation remains blocked before runner allocation. Neither the full quality job nor the isolated `ubuntu-slim` probe has executed a step, so no test or build result is inferred from those runs.

## Implemented in this PR

- Payment approval finalization is replayable: an already-PAID payment repairs missing effects without trying to move an order backwards after it has advanced to `PROCESSING`, `READY_TO_SHIP`, `SHIPPED`, or `DELIVERED`.
- Failed/cancelled payment finalization is replayable: an already terminal payment still repairs order cancellation, inventory release, and ledger recording.
- Payment state is transitioned before dependent order/inventory/ledger effects, making the payment state the concurrency gate and allowing later deliveries to repair incomplete effects.
- Provider transaction attachment is checked; a conflicting transaction ID is rejected rather than silently ignored.
- A provider-approved refund is persisted/reconciled before finalization; retries with a recorded SUCCEEDED refund complete payment state, order state, and ledger instead of returning a synthetic REFUNDED result.
- Successful refunds complete either supported order lifecycle `PAID → REFUND_PENDING → REFUNDED` or `DELIVERED → REFUND_PENDING → REFUNDED`; the transitions are retryable if either order update fails.
- Refund lock release is ownership-checked using the payment ID and idempotency key.
- Refund status updates cannot downgrade SUCCEEDED or FAILED records.
- Payment-intent ledger recording is retried when an idempotent intent request is replayed.
- Added regression tests for replay repair after fulfillment advances, delivered-order refunds, partial ledger failure, provider transaction mismatch, refund concurrency, pending refund reconciliation, and lock ownership.
- Added `.github/workflows/payment-consistency.yml` to run repository checks, the full test suite, and the Cloudflare build on relevant pull requests.

## Acceptance criteria

- [x] Duplicate provider callbacks and retries do not repeat payment transitions or ledger entries.
- [x] A payment already in a terminal state can repair incomplete order, reservation, and ledger effects.
- [x] Successful refund records can recover payment, order, and ledger finalization after a partial failure.
- [x] Refund lock release cannot delete a lock owned by another idempotency key.
- [x] Tests cover success, retries, lock contention, order-refund lifecycle, and failures at persistence boundaries.
- [ ] GitHub Actions can acquire a runner and all checks pass on this PR.
- [ ] Review of D1 migration/runtime compatibility and final diff is complete.

## Verification

The new Actions workflow is configured to run formatting, foundation, frontend data, architecture, lint, TypeScript, the complete Vitest suite, and the Cloudflare application build. Fourteen `payment-quality` job executions (including one manual retry) and six `runner-diagnostics` executions have now failed without executing a step (`runner_id=0`, empty runner name, `steps=[]`); GitHub exposes no job logs for the latest attempt (`BlobNotFound`). The last Cloudflare deployment comment reports a failed build for the previous head `9829da0`; no Cloudflare result is yet available for the latest amended head, and its build logs are only visible in the private Cloudflare dashboard. This environment cannot execute dependency installation or local test commands, so no test result is claimed.

## Operational note

If a provider refund request has an ambiguous network/persistence outcome, its lock is intentionally retained. Retry/reconcile with the same idempotency key; a different key must not start a second refund while the external outcome is unresolved.

## Dependency

Coordinate with the existing open PR #19 where shared-kernel or architecture changes overlap.