# Notifications bounded context

Transactional and realtime notifications are modeled as a provider-agnostic bounded context.

## Responsibility

The context owns:

- notification event contracts;
- recipient resolution;
- durable notification inbox;
- channel delivery state;
- deduplication;
- retry classification;
- replay commands;
- preferences;
- channel adapters.

Business modules do not import provider SDKs or Durable Object classes.

## Target flow

```text
Business transaction
   -> D1 state + notification_outbox
   -> immediate Queue publish
   -> Cron reconciliation
   -> Notifications Queue
   -> Notification Processor
   -> D1 notification inbox
   -> NotificationHub Durable Object
   -> WebSocket Hibernation
   -> authenticated client

Notification Processor
   -> EmailProvider
   -> Resend
```

D1 is the durable source of truth. Durable Objects coordinate live connections only.

## Application ports

- `NotificationOutboxRepository`
- `NotificationInboxRepository`
- `NotificationDeliveryRepository`
- `NotificationPublisher`
- `RealtimeNotificationPublisher`
- `EmailProvider`
- `NotificationPreferenceRepository`
- `NotificationReplayService`

Application services must not import Next.js, React, Cloudflare bindings, Durable Object classes, Resend SDKs or WebSocket implementation details.

## Domain contract

Every notification event must contain:

- immutable event id;
- event type;
- event version;
- aggregate type/id;
- created timestamp;
- actor context when applicable;
- recipient context;
- typed payload;
- sensitivity classification.

The event id remains stable across retries and replay.

## Channels

Current:
- `EMAIL`

Target:
- `IN_APP`

Future:
- `WHATSAPP`
- `SMS`
- `PUSH`

Channel failures are independent. Email failure must not erase an in-app notification.

## Realtime boundary

Target Cloudflare class: `NotificationHub`.

Object identity:

```text
notification:{recipientType}:{recipientId}
```

The Worker derives the recipient from the authenticated session. The client cannot select another recipient.

## Delivery semantics

- durable outbox;
- at-least-once Queue delivery;
- idempotent processing;
- durable inbox;
- low-latency WebSocket fan-out;
- HTTP catch-up after disconnect.

Exactly-once delivery is not required.

## Supported events

- `OrderCreated`
- `OrderPaid`
- `OrderStatusChanged`
- `ServiceRequestCreated`
- `ServiceStatusChanged`
- `RepairDeviceReceived`
- `RepairDiagnosisReady`
- `RepairQuoteIssued`
- `RepairApprovalRequired`
- `RepairApproved`
- `RepairStarted`
- `RepairWaitingPart`
- `RepairQualityControlStarted`
- `RepairReady`
- `RepairDelivered`
- `WarrantyCreated`
- technician assignment;
- operational alerts;
- terminal notification failure.

## Persistence target

D1 should separate:

- event outbox;
- notification inbox;
- channel delivery attempts;
- preferences;
- terminal failures/replay evidence.

Canonical notification history must not live only inside a Durable Object.

## Failure handling

Transient failures use exponential backoff, jitter and the same idempotency key.

Terminal failures are persisted, audited, moved to DLQ and replayed only through authorized operations.

A provider success immediately followed by Worker failure must remain safe to retry.

## Tests

- domain contract tests;
- application/idempotency tests;
- repository tests;
- Queue/DLQ/replay integration;
- authorization tests;
- WebSocket authentication tests;
- reconnect/catch-up E2E;
- realtime load tests.

## Documentation

- `docs/notifications.md`
- `docs/realtime-notifications.md`