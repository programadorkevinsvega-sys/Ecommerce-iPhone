# Analytics bounded context

Owns product and business analytics events. Tracking providers are adapters and must not affect transactional correctness.

## Phase 10.2 foundation

- Versioned event contract with a fixed allow-list of business event types.
- AnalyticsService validates identifiers, timestamps, payload size and sensitive-field exclusions before infrastructure.
- AnalyticsPort keeps the application independent of Cloudflare.
- CloudflareAnalyticsQueuePublisher publishes asynchronously to the existing EVENTS_QUEUE.
- D1AnalyticsRepository persists events with event-id idempotency and a 180-day retention timestamp.
- `POST /api/analytics/events` accepts validated analytics events and returns 202 after queue publication.
- Event storage is separate from transactional tables and payment/order correctness.

Base event types: VisitorStarted, SessionStarted, ProductViewed, SearchPerformed, CartItemAdded, CheckoutStarted, PaymentStarted, PurchaseCompleted, RevenueRecorded. The Phase 10.3/10.4 contract extends this allow-list with catalog/search interaction and cart/checkout events.

The foundation does not manufacture business events. Later analytics subphases emit each event only from the corresponding real application state transition.


## Phase 10.3 — Catalog and search

The catalog storefront emits real analytics events from rendered catalog/product state and user interactions. The contract now covers ProductViewed, SearchPerformed, SearchResultClicked, CategoryNavigated, FilterApplied, PaginationChanged, ProductVariantSelected and RelatedProductClicked.

- Search/product payloads are minimized and never include the raw search query, credentials, payment data or PII.
- Browser interaction events use an in-memory anonymous context and the server establishes HttpOnly, Secure, SameSite=Lax first-party analytics identifiers through the analytics endpoint.
- Product and search rendering remains server-side; interactive events are emitted only from client interaction components.
- Production verification exercises a real published product route, a real catalog search route, Queue → D1 persistence and event-id idempotency.


## Phase 10.4 — Cart and checkout

The commerce funnel now records real cart and checkout transitions:

- CartItemAdded / CartItemRemoved after successful cart mutations.
- CartAbandoned server-side from the existing minute Cron Trigger for carts with items inactive for at least 30 minutes, with deterministic idempotency keys.
- CheckoutStarted after a real order is created server-side.
- ShippingMethodSelected from the real checkout form.
- PaymentStarted after a real payment intent is created/recovered from the server-side order.
- PurchaseCompleted only after payment webhook processing leaves both payment and order in PAID state across Wompi, Stripe, Mercado Pago, PayPal and Binance Pay.

Financial payloads for PaymentStarted and PurchaseCompleted are sourced from server-side order/payment/provider state. HTTP analytics publication uses Cloudflare waitUntil so analytics failures do not turn a successful commerce mutation into a failed transaction.
