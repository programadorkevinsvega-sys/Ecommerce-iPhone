# PR 04 — Scheduled worker isolation and R2 cleanup

**Priority:** P1  
**Status:** Implementation complete; Repository CI #128 passed on the current PR head. Code review and Preview runtime/resource-isolation verification remain separate.  
**Branch:** `fix/scheduled-worker-isolation` → `main`

## Problems verified on the current main baseline

- The `scheduled()` handler awaited unrelated maintenance operations in one sequence. Any uncaught failure stopped every later operation in that invocation.
- R2 orphan cleanup listed only the first 1,000 objects for each prefix and did not persist the R2 cursor. Subsequent minute-level invocations restarted at the first page.
- The queued-media cleanup already used a bounded `LIMIT 100`, but an exception on one row stopped processing the rest of the selected batch.

## Implementation

- Preserve the OpenNext HTTP, Queue and Durable Object Worker in `apps/web/worker.ts`; install the separate scheduled handler through `apps/web/worker-entry.ts` and point Wrangler at that entrypoint.
- Run each scheduled concern through a sequential isolation runner. Every task records its name, outcome, duration and a bounded/redacted error message. All tasks are attempted; after the full batch the handler throws an aggregate error when one or more tasks failed so the platform still records the scheduled invocation as failed.
- Split the four R2 orphan prefixes into separate scheduled tasks so a bad prefix does not prevent the remaining prefixes from being scanned.
- Keep explicit media deletion retries bounded to 100 due rows per invocation. A row is removed only after it is confirmed referenced, successfully deleted, or rejected as an invalid media key. R2 delete failures are rescheduled with capped exponential backoff.
- Paginate orphan scans at 250 objects per prefix and persist the opaque R2 cursor in D1. A cursor advances only after all eligible objects in the page have been processed; failures retry the same page. A compare-and-swap condition prevents an overlapping scan from overwriting a cursor that another invocation already advanced. Completed sweeps reset the cursor and wait six hours before starting another sweep.
- Add migration `0043_media_cleanup_scan_state.sql` with one cursor state per managed media prefix.
- Add unit tests for task isolation, error redaction, bounded page size, cursor resume, completed-sweep pause, failed-page retry and stale-cursor rejection.
- Keep production bindings, routes, secrets, and Cloudflare deployment commands unchanged.

## Scheduled tasks isolated

1. Queued media cleanup.
2. Orphan R2 scan for product images.
3. Orphan R2 scan for category images.
4. Orphan R2 scan for service images.
5. Orphan R2 scan for home carousel assets.
6. Analytics retention.
7. Revenue analytics reconciliation.
8. Abandoned-cart analytics.
9. Scheduled CMS publishing.
10. Expired inventory reservation release.
11. Notification outbox publishing.

## Acceptance criteria

- [x] A failed scheduled task does not prevent subsequent tasks from running.
- [x] Task logs identify task, outcome and duration; error messages are bounded and redact common credential patterns.
- [x] R2 orphan cleanup uses a bounded page size and persists per-prefix cursors.
- [x] Failed page processing leaves the cursor unchanged so the page is retried.
- [x] Completed scans pause before the next full sweep instead of restarting every minute.
- [x] Queued cleanup remains bounded and retries object deletion failures with capped backoff.
- [x] Tests cover partial failure, pagination, resumption and retry behavior.
- [x] Repository CI #128 passed on commit `6cf1b7694ac54abd874ed89692e4024e34cc5a40`: audit, changed-file format, foundations, frontend data, architecture, lint, typecheck, 274 unit/integration tests, local D1 setup, OpenNext build, artifact verification, Playwright E2E and deployment-guard checks.
- [x] Aggregate GitHub check `CI required` passed on the same commit.
- [ ] Cloudflare Preview URL/runtime health and separate D1/R2/Queue resource isolation are independently verified.
- [ ] Cloudflare production deployment and runtime verification after merge.

## Dependency note

PR #19 (`fix(architecture): move media reference primitive to shared kernel`) is closed without being merged. This PR therefore uses and validates the shared-kernel import already present on `main`; PR #19 is not an outstanding merge dependency.

## Verification

Repository CI run [#128](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41209438007) passed on commit `6cf1b7694ac54abd874ed89692e4024e34cc5a40`, including the aggregate `CI required` gate. The separate Cloudflare Workers Builds Preview check is not a GitHub CI gate and does not replace Preview hostname/runtime and resource-isolation verification. Production deploy remains owned by Cloudflare Workers Builds after merge.
