# Analytics bounded context

Owns product and business analytics events. Tracking providers are adapters and must not affect transactional correctness.

## Phase 10.2 foundation

- Versioned event contract with a fixed allow-list of business event types.
- AnalyticsService validates identifiers, timestamps, payload size and sensitive-field exclusions before infrastructure.
- AnalyticsPort keeps the application independent of Cloudflare.
- CloudflareAnalyticsQueuePublisher publishes asynchronously to the existing EVENTS_QUEUE.
- D1AnalyticsRepository persists events with event-id idempotency and a 180-day retention timestamp.
- POST /api/analytics/events accepts validated client events and returns 202 after queue publication.
- Event storage is separate from transactional tables and payment/order correctness.

Base event types: VisitorStarted, SessionStarted, ProductViewed, SearchPerformed, CartItemAdded, CheckoutStarted, PaymentStarted, PurchaseCompleted, RevenueRecorded. The Phase 10.3/10.4 contract extends this allow-list with catalog/search interaction and cart/checkout events.

The foundation does not manufacture business events. Later analytics subphases emit each event only from the corresponding real application state transition.

## Phase 10.3 — Catalog and search

The catalog storefront emits real analytics events from rendered catalog/product state and user interactions. The contract covers ProductViewed, SearchPerformed, SearchResultClicked, CategoryNavigated, FilterApplied, PaginationChanged, ProductVariantSelected and RelatedProductClicked.

- Search/product payloads are minimized and never include the raw search query, credentials, payment data or PII.
- Browser interaction events use an in-memory anonymous context and the server establishes HttpOnly, Secure, SameSite=Lax first-party analytics identifiers through the analytics endpoint.
- Product and search rendering remains server-side; interactive events are emitted only from client interaction components.
- Production verification exercises a real published product route, a real catalog search route, Queue → D1 persistence and event-id idempotency.

## Phase 10.4 — Cart and checkout

The commerce funnel records real cart and checkout transitions:

- CartItemAdded / CartItemRemoved after successful server-side cart mutations.
- CartAbandoned server-side from the existing minute Cron Trigger for carts with items inactive for at least 30 minutes, with deterministic idempotency keys.
- CheckoutStarted after a real order is created server-side.
- ShippingMethodSelected from the real checkout form.
- PaymentStarted after a real payment intent is created/recovered from the server-side order.
- PurchaseCompleted only after verified payment webhook processing leaves both payment and order in PAID state across Wompi, Stripe, Mercado Pago, PayPal and Binance Pay.

## Server-owned event boundary

The browser contract intentionally excludes CartItemAdded, CartItemRemoved, CartAbandoned, CheckoutStarted, ShippingMethodSelected, PaymentStarted, PurchaseCompleted and RevenueRecorded. The public POST /api/analytics/events route never accepts a source value from the request and the AnalyticsService rejects server-owned event types unless the trusted caller explicitly supplies source: server. Attempts to publish these events from a browser receive HTTP 403.

- Cart and checkout API handlers mark events as server-originated only after the underlying mutation/order creation succeeds. Cart repositories return whether a row actually changed; add/remove events are omitted for no-op mutations. Event IDs are deterministic SHA-256 fingerprints of the cart, product/variant and client idempotency/request key. The add-to-cart UI sends an Idempotency-Key so retries deduplicate.
- ShippingMethodSelected is recorded from the validated server-side shipping method only after the corresponding order is persisted. Its canonical method key is PICKUP or DELIVERY; addresses and recipient data are excluded.
- PaymentStarted is emitted only after the server successfully creates or recovers the payment intent.
- PurchaseCompleted is emitted after verified provider callbacks and canonical payment/order state checks; its stable event ID is purchase-completed:<paymentId>.
- RevenueRecorded is projected from canonical payment_ledger entries using revenue:<ledgerId>; duplicate delivery is harmless because D1 persistence uses the event ID as its primary key.
- Revenue and conversion reports derive monetary values exclusively from eligible payment_ledger entries. Gross, refunds and net are grouped by currency; top-level monetary totals are null when the period spans multiple currencies rather than adding incomparable amounts. Currency breakdowns include payment/refund counts.
- Conversion uses the official PurchaseCompleted / CheckoutStarted definition, counted from distinct server-owned event references in the same UTC time window. A period whose purchase count exceeds its checkout count includes a warning about cross-period cohort alignment. Client analytics events cannot inflate conversion counts.
- Refund entries reduce net revenue only after the provider-confirmed PAYMENT_REFUNDED ledger entry. Voids, pending refund attempts and client-submitted payloads never create revenue. The current payment workflow supports a full refund; incomplete or duplicate ledger entries are rejected by reconciliation.
- CartAbandoned is scanned in bounded age order by the existing minute Cron, excludes already-projected deterministic keys, and uses a conditional D1 INSERT that rechecks the exact cart timestamp and non-empty state to prevent stale/concurrent abandonment records.

## Production certification 10.4 / 10.5

- The 10.4 production verifier reads existing server-owned cart/checkout events and joins them to canonical order/payment rows. It performs only D1 SELECT statements and a read-only unauthenticated revenue-endpoint check; it does not create test carts, synthetic events, orders, payments or refunds. A missing real event class is INCONCLUSIVE.
- The 10.5 production verifier reads payment_ledger, provider-confirmed refunds and RevenueRecorded projections only. It compares row-level values and per-currency aggregates, verifies conversion from server-owned CheckoutStarted/PurchaseCompleted events, and creates no financial or D1 data. A missing real refund is INCONCLUSIVE.
- Production replay/idempotency behavior is covered by unit/integration tests; production verification inspects deterministic unique event IDs rather than replaying commercial mutations against customers.
