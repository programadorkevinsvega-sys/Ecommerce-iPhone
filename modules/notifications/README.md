# Notifications bounded context

Transactional notifications are modeled as a provider-agnostic bounded context.

## Flow

```text
Domain event
   -> D1 notification_outbox
   -> Cron dispatcher
   -> Cloudflare Queue
   -> NotificationService
   -> Resend adapter
   -> notification_deliveries
```

The outbox makes event publication durable across Worker restarts. Queue delivery is retryable and email delivery is idempotent through the D1 delivery ledger.

## Supported events

- `OrderCreated`
- `OrderPaid`
- `OrderStatusChanged`
- `ServiceRequestCreated`
- `ServiceStatusChanged`

Adding another provider must implement `EmailProvider`; the application layer must not import provider SDKs.
