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
- Added `.github/workflows/payment-consistency.yml` to run repository checks, the full test suite, dependency audit, and Cloudflare build on relevant pull requests.
- Fixed the four Next.js advisories from the Cloudflare production audit by pinning `next` and `eslint-config-next` to `15.5.28` and updating their package, SWC, and peer-reference lock entries.
- Replaced the production-only audit with full `pnpm audit`, covering production, development, and optional dependencies; no advisory suppressions were added.

## Dependency security review

The Cloudflare build log from 2026-10-30 reported four advisories on the locked `next@15.5.25`: critical `GHSA-2464-fhr4-w9xw`, high `GHSA-p3m5-59mp-jv5r`, and moderate `GHSA-4jqv-mc3x-m676` / `GHSA-mcj8-r9mp-w47p`. The web workspace and lockfile now pin Next.js and eslint-config-next to `15.5.28`, which includes the patched 15.5 line.

The audit command now runs as `pnpm audit` (not `pnpm audit --prod`) both in the Cloudflare build script and the PR workflow. A successful full audit has **not** yet been observed: Cloudflare build `d92671ff-fe3d-4078-a5ab-5f41bb5ed10b` ended in failure, but its check exposes no compiler/audit output. The lockfile installation and the full development/optional dependency report must be confirmed from that build log before the security gate is considered green.

## Acceptance criteria

- [x] Duplicate provider callbacks and retries do not repeat payment transitions or ledger entries.
- [x] A payment already in a terminal state can repair incomplete order, reservation, and ledger effects.
- [x] Successful refund records can recover payment, order, and ledger finalization after a partial failure.
- [x] Refund lock release cannot delete a lock owned by another idempotency key.
- [x] Tests cover success, retries, lock contention, order-refund lifecycle, and failures at persistence boundaries.
- [ ] GitHub Actions can acquire a runner and all checks pass on this PR.
- [ ] Review of D1 migration/runtime compatibility and final diff is complete.

## Verification

The new Actions workflow is configured to run formatting, foundation, frontend data, architecture, lint, TypeScript, the complete Vitest suite, and the Cloudflare application build. The latest GitHub Actions run (`41134644250`) also failed before runner allocation: both jobs report `runner_id=0`, empty runner name, and `steps=[]`; therefore the audit/test/typecheck steps did not start. Cloudflare build `d92671ff-fe3d-4078-a5ab-5f41bb5ed10b` failed on the latest dependency-update commit and exposes no annotations or output through the GitHub check. The private Cloudflare dashboard logs are required to determine whether frozen installation or the full audit failed. This environment cannot execute dependency installation or local test commands, so no local test result is claimed.

## Operational note

If a provider refund request has an ambiguous network/persistence outcome, its lock is intentionally retained. Retry/reconcile with the same idempotency key; a different key must not start a second refund while the external outcome is unresolved.

## Dependency

Coordinate with the existing open PR #19 where shared-kernel or architecture changes overlap.