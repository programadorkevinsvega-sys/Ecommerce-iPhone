# PR 01 — Payment and refund consistency

**Priority:** P0  
**Status:** Implementation committed; validation is blocked. The latest GitHub Actions job failed before assigning a runner or starting any step; no test result is available.

## Implemented in this PR

- Payment approval finalization is replayable: an already-PAID payment still repairs the order status, consumes outstanding reservations, and records the idempotent confirmation ledger entry.
- Failed/cancelled payment finalization is replayable: an already terminal payment still repairs order cancellation, inventory release, and ledger recording.
- Payment state is transitioned before dependent order/inventory/ledger effects, making the payment state the concurrency gate and allowing later deliveries to repair incomplete effects.
- Provider transaction attachment is checked; a conflicting transaction ID is rejected rather than silently ignored.
- A provider-approved refund is persisted/reconciled before finalization; retries with a recorded SUCCEEDED refund complete payment state and ledger instead of returning a synthetic REFUNDED result.
- Refund lock release is ownership-checked using the payment ID and idempotency key.
- Refund status updates cannot downgrade SUCCEEDED or FAILED records.
- Payment-intent ledger recording is retried when an idempotent intent request is replayed.
- Added regression tests for replay repair, partial ledger failure, provider transaction mismatch, refund concurrency, pending refund reconciliation, and lock ownership.
- Added `.github/workflows/payment-consistency.yml` to run repository checks, the full test suite, and the Cloudflare build on relevant pull requests.

## Acceptance criteria

- [x] Duplicate provider callbacks and retries do not repeat payment transitions or ledger entries.
- [x] A payment already in a terminal state can repair incomplete order, reservation, and ledger effects.
- [x] Successful refund records can recover payment and ledger finalization after a partial failure.
- [x] Refund lock release cannot delete a lock owned by another idempotency key.
- [x] Tests cover success, retries, lock contention, and failures at persistence boundaries.
- [ ] GitHub Actions can acquire a runner and all checks pass on this PR.
- [ ] Review of D1 migration/runtime compatibility and final diff is complete.

## Verification

The new Actions workflow is configured to run formatting, foundation, frontend data, architecture, lint, TypeScript, the complete Vitest suite, and the Cloudflare application build. The latest GitHub Actions job ended in failure after 3 seconds with runner_id=0, runner_name empty, and steps=[]; its logs are unavailable. The Cloudflare Workers Builds check also concluded failure without exposing a build log through the connected GitHub interface. This environment cannot execute dependency installation or local test commands, so no test result is claimed.

## Operational note

If a provider refund request has an ambiguous network/persistence outcome, its lock is intentionally retained. Retry/reconcile with the same idempotency key; a different key must not start a second refund while the external outcome is unresolved.

## Dependency

Coordinate with the existing open PR #19 where shared-kernel or architecture changes overlap.