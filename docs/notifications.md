# Notifications and email

## Production architecture

The application uses a transactional notification outbox in D1 and the already-provisioned Cloudflare Queue `ecommerce-iphone-events`.

1. Checkout/service APIs persist the business operation.
2. A notification event is appended to `notification_outbox`.
3. A one-minute Cron Trigger dispatches pending events to the Queue.
4. The Queue consumer renders the appropriate transactional template.
5. Resend sends the email.
6. `notification_deliveries` records the provider response and prevents duplicate sends.

Cloudflare Queue consumers support batching and retries; the Worker is configured with a batch size of 10, five-second timeout and five retries.

## Required production configuration

Configure these Worker values/secrets:

- `RESEND_API_KEY` — secret
- `EMAIL_FROM` — Worker variable, for example `Ecommerce iPhone <noreply@your-domain>`

The Resend API key must never be committed to Git.

## Integrated events

- Checkout -> `OrderCreated`
- Service request -> `ServiceRequestCreated`

The same event contract can be used by future order/payment/service state transitions without coupling those bounded contexts to Resend.

## Observability

Administrators with `dashboard:read` can inspect delivery history and outbox status at `/api/admin/notifications`.


## Current certification state

The outbox, Queue dispatcher, Resend adapter and delivery ledger are implemented.

Still pending before Fase 07 can be declared complete:

- explicit DLQ strategy;
- deterministic retry policy and terminal-failure classification;
- replay tooling;
- terminal failure audit/evidence;
- final production certification.
