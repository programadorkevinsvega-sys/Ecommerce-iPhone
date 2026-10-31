# PR 06 — Critical commerce and security E2E coverage

**Priority:** P1

**Status:** E2E implementation and local validation are complete on the current PR head. GitHub Actions `CI required` and Cloudflare Preview build both passed for SHA `ad8e26a333cdbc376ea916a2213823b2b7214b1c`. Provider sandbox and refund journeys remain conditional.

## Repository baseline and dependencies

- This plan is implemented on the existing PR #25 branch: `test/critical-commerce-e2e`.
- PR #31 is merged into `main` (Cloudflare challenge/block classification).
- PR #24 is merged into `main` (atomic checkout + durable notification outbox).
- PR #19 was closed without merge. It is not an active dependency and no implementation is assumed from it.
- The integration base used for this implementation is the current `main` commit `143689a835116675c1c141992b2d0f137d32ac44`.

## Implemented E2E coverage

The new Playwright suite `apps/web/e2e/commerce-security.spec.ts` runs against the real local Wrangler Worker and local D1, using existing HTTP routes and contracts.

- [x] Cart creation and product addition through `/api/cart`.
- [x] Quantity updates, invalid quantities, removal, and unavailable/zero-stock product rejection.
- [x] Malformed JSON requests return a client error instead of an internal-server error.
- [x] Checkout validates required input and idempotency headers before creating a customer, order, or stock mutation.
- [x] Server-side price refresh when the catalog variant price changes after the item was placed in the cart.
- [x] Client-supplied price and total fields are ignored; order totals are calculated from current server-side catalog data.
- [x] Successful customer checkout, authenticated order listing, and order detail retrieval.
- [x] Same-customer checkout retry with the same idempotency key returns the committed order without a second stock decrement.
- [x] Database-level evidence for one `OrderCreated` order event, one durable `notification_outbox` record, one inventory reservation, stock decrement, and cart clearing.
- [x] Unauthenticated order/payment access is rejected.
- [x] A second authenticated customer cannot read another customer's order or create a payment intent for it (IDOR boundary); no payment row is created.
- [x] Concurrent checkout attempts against one remaining unit produce one committed order and one conflict; the failed cart remains intact and no second reservation/outbox/order is persisted.

The suite is serialized within its spec to make inventory mutations deterministic. Playwright targets `http://localhost:8787` so the Worker can exercise production-style `Secure` cookies on a loopback origin. Each request context receives an independent cart/customer identity. An E2E-only Wrangler variable is intercepted in `apps/web/worker-entry.ts`: the notification Queue producer and durable outbox path remain active, while the local consumer acknowledges notifications without invoking external email delivery. The production Worker behavior is unchanged when that variable is absent. The `afterEach` cleanup helper removes notification channel deliveries, inbox entries, outbox rows, order children, orders, idempotency records, customers, reservations, cart items, and carts in foreign-key-safe order. It asserts that no created customer, order, outbox, delivery, or cart rows remain. The fixture reset restores the test product stock and variant price before every scenario; the disposable local D1 is never shared with production.

## Small API correctness fixes required by the E2E contract

- Cart and checkout routes now classify malformed JSON as HTTP 400.
- Cart/checkout stock and availability conflicts return HTTP 409 rather than being surfaced as generic HTTP 500 errors.
- The checkout route resolves an authenticated idempotent retry before requiring a non-empty cart. This is necessary because a committed checkout clears its cart.
- The HTTP boundary maps the transaction's conditional checkout-guard constraint to HTTP 409. Other persistence errors continue to propagate.

## CI/CD integration

No duplicate workflow was added. The existing `.github/workflows/payment-consistency.yml` already runs:

- Frozen pnpm installation and toolchain verification.
- Dependency audit, formatting, foundation, frontend data and architecture checks.
- ESLint, TypeScript, and the unit/integration suite.
- Isolated local D1 migration preparation.
- OpenNext Cloudflare Worker build and generated-artifact verification.
- Chromium installation and Playwright E2E against `wrangler dev --local`.
- Deployment-guard checks and the aggregate `CI required` gate.

`scripts/prepare-local-e2e-d1.mjs` now seeds only deterministic inventory values into the local D1 database after migrations. No remote D1 command is used by the E2E fixture.

## Conditional provider and administrative scenarios

- [ ] Mercado Pago, PayPal, Binance Pay, Wompi and other provider sandbox checkout/callback journeys. These require provider-specific sandbox credentials, valid signed callback fixtures, and verified sandbox configuration. The E2E suite does not call live payment services.
- [ ] Provider-confirmed refund lifecycle and refund replay. No live refund is attempted.
- [ ] Authorized admin refund and role-escalation E2E scenarios. Existing authorization/unit coverage is not represented as an end-to-end approval here.

These items remain explicitly incomplete until a safe sandbox/test credential path is available. The implemented security suite verifies unauthenticated admin refund denial and customer-to-customer resource isolation.

## Verification status

- **Local terminal execution:** Not run from the assistant runtime. The complete validation ran on the isolated GitHub-hosted runner.
- **GitHub Actions:** Run [#41226512674](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41226512674) passed on SHA `ad8e26a333cdbc376ea916a2213823b2b7214b1c`: formatting, repository checks, lint, TypeScript, unit/integration tests, local D1 preparation, OpenNext build, generated Worker/static artifact verification, Chromium install, all 8 Playwright E2E tests (`8 passed`, no flaky tests), and the production branch guard.
- **CI required:** Passed on the same SHA.
- **Cloudflare Preview:** Build succeeded for SHA `ad8e26a333cdbc376ea916a2213823b2b7214b1c`. Preview URLs are disabled for the Worker, so no public Preview URL was generated.
- **Production data/deployment:** Not used; no manual production deployment occurred.

Only successful checks attached to the final PR head may be marked approved. The PR remains Draft until CI results are green, Preview build evidence for the final SHA is reviewed, and the conditional provider scope is resolved or explicitly accepted as out of scope.
