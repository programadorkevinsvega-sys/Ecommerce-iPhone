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

Event types: VisitorStarted, SessionStarted, ProductViewed, SearchPerformed, CartItemAdded, CheckoutStarted, PaymentStarted, PurchaseCompleted, RevenueRecorded.

The foundation does not manufacture business events. Later analytics subphases emit each event only from the corresponding real application state transition.
