# PR 05 — Checkout and notification outbox atomicity

**Priority:** P1  
**Status:** Implementation complete; the required Repository CI matrix passed on the implementation tree (run [41219049800](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41219049800)). Cloudflare Preview confirmation for the current PR head remains pending.

## Implemented solution

### Atomic transaction boundary

`D1OrderRepository.checkout()` builds a stable `OrderCreated` event and appends the prepared `notification_outbox` insert to the same D1 `batch()` as:

- Checkout idempotency reservation.
- Inventory decrements and reservation creation.
- Promotion/coupon usage and coupon redemption.
- Order and order-item persistence.
- `OrderCreated` persistence in `order_events`.
- Durable notification event persistence in `notification_outbox`.
- Cart item removal.

A failure of the outbox statement aborts the batch. A follow-up changes() guard also fails the batch if INSERT OR IGNORE silently ignored a uniqueness conflict instead of inserting the outbox row. SQLite persistence regressions inject both an aborting trigger and an ignoring trigger, then verify rollback of the order, order event, stock decrement, inventory reservation, checkout idempotency row, and cart state. The aborting trigger test removes the trigger and retries with the same idempotency key.

### Bounded-context boundaries

Orders infrastructure accepts an injected prepared-statement factory. Notifications infrastructure owns `D1NotificationOutboxRepository.prepareEnqueue()`; the web composition root adapts the order into a `NotificationEvent` and supplies that statement factory. Orders domain and application layers do not import Notifications, Next.js, Cloudflare Workers, or Queue APIs. No circular dependency is introduced.

### Stable identity and idempotency

New checkout events use `order-created:${order.id}` as both the `order_events` ID and `notification_outbox` ID. The outbox event key remains type/aggregate/event-ID based and backed by the existing unique constraint.

A repeated checkout with the same idempotency key returns the same order and does not decrement stock or recreate reservations/events. The repository also repairs a missing outbox row for a legacy idempotent order with the same stable event ID. Cross-customer reuse of an idempotency key remains rejected.

### Queue publication and recovery

The checkout route no longer inserts an order notification after checkout. After the D1 batch commits, it calls `publishPersistedNotificationEvent()`, which loads and publishes the already-durable outbox row. Queue publication errors are sanitized, persisted as retryable failures, and do not turn a committed checkout into an HTTP checkout failure.

The outbox now separates two clocks:

- `available_at`: the next eligible retry time for PENDING/FAILED events.
- `queue_published_at` and `lease_expires_at`: when the Queue message was last published and when a consumer/publisher claim expires.

After successful publication the event is immediately claimable by the consumer. The reconciler republishes a `QUEUED` record only after its 15-minute publication age has elapsed and no active consumer lease remains. A failed publish whose state transition cannot be persisted is recoverable after its publisher lease expires. This avoids hiding a new Queue message behind the retry timer or re-publishing it while a consumer is active.

A duplicate Queue delivery that encounters an active publisher/consumer lease is acknowledged without repeating work: the durable D1 row remains authoritative, and the reconciler republishes it if the active lease expires without the record reaching PROCESSED. Retryable processing failures transition the row to FAILED with a future available_at; the scheduled reconciler republishes it when due. Already processed events are acknowledged without repeating effects.

Delivery remains at-least-once. Stable event IDs, outbox consumer claims, inbox uniqueness constraints, and delivery ledgers provide idempotent processing; the implementation does not claim exactly-once delivery.

### Migration and error safety

Migration `0044_notification_outbox_leases.sql` adds `queue_published_at` and `lease_expires_at`, and an index for reconciliation. Its backfill maps existing `QUEUED` rows from the previous shared `available_at` lease model so historical pending events remain recoverable. Existing event rows and orders are not deleted or rewritten.

Outbox, legacy delivery-ledger, and recipient delivery-ledger error strings are sanitized and length-bounded before persistence. The SQLite D1 fixture mirrors the post-migration outbox schema.

## Regression tests added or extended

- Successful checkout persists one order, one `OrderCreated` order event, and one matching outbox row with the correct aggregate ID and event payload.
- A trigger-induced outbox insert failure rolls back order, event, stock, reservation, idempotency, and cart writes; the same idempotency key succeeds after the failure is removed.
- Repeated and concurrent checkouts do not duplicate orders, order events, outbox rows, stock decrements, or reservations.
- Cross-customer idempotency-key ownership remains rejected.
- D1 outbox tests cover stable identity, sanitized failure persistence, retry attempts, consumer visibility, active-lease exclusion, and 15-minute queued lease recovery.
- Queue publication failure followed by retry is exercised using a real SQLite outbox repository and a failing Queue port.
- Concurrent duplicate consumer delivery is tested with real SQLite outbox, inbox and recipient-delivery repositories: only one inbox item and one SENT email-delivery ledger row are persisted; a completed duplicate has no additional effect.
- A transient notification-processing failure retains the same event ID and remains retryable.

## Verification status

The PR workflow `.github/workflows/payment-consistency.yml` defines the required validation: frozen dependency installation, toolchain verification, dependency audit, changed-file formatting, foundation checks, frontend production-data validation, architecture checks, ESLint, TypeScript, the complete unit/integration suite, isolated local D1 preparation, OpenNext Worker build, generated artifact verification, Playwright E2E against local Wrangler, deployment-guard assertions, and the aggregate `CI required` job.

The full Repository CI matrix passed: run 41219049800 completed with success for runner diagnostics, payment-quality and the aggregate CI required job. Cloudflare's GitHub integration has not yet reported a completed Preview build or deployment URL for the current PR head; the Preview check remains pending and the PR stays Draft until that evidence is available. No production deployment or merge is part of this change.
