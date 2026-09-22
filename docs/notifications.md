# Notifications, realtime and email

## Scope

The `notifications` bounded context owns notification orchestration without coupling business domains to Resend, WebSockets, Durable Objects or other channel providers.

Responsibilities:

- durable notification state;
- channel delivery state;
- deduplication;
- retry classification;
- replay;
- notification preferences;
- channel adapters.

Business domains only publish contracts/events. They never call Resend or WebSocket code directly.

## Current implemented foundation

The repository already contains:

- transactional `notification_outbox`;
- D1 delivery ledger;
- Cloudflare Queue `ecommerce-iphone-events`;
- Queue consumer batching/retries;
- Resend adapter;
- `/api/admin/notifications` visibility.

Current Worker configuration:

- `max_batch_size = 10`;
- `max_batch_timeout = 5`;
- `max_retries = 5`;
- Cron reconciliation every minute.

This foundation is retained. It is not the final realtime implementation.

## Target architecture

```text
Business transaction
        │
        ├── D1 business state
        └── D1 notification_outbox
                    │
                    ├── immediate Queue publish
                    │
                    └── Cron reconciliation
                              │
                              ▼
                     Notifications Queue
                              │
                              ▼
                  Notification Processor
                      │              │
                      │              └── Resend
                      ▼
               D1 notification inbox
                      │
                      ▼
              NotificationHub Durable Object
                      │
                  WebSocket
                      │
                      ▼
             authenticated browser/client
```

D1 is the durable source of truth. Durable Objects coordinate active WebSocket connections; they do not replace notification history.

## Latency and durability

The one-minute Cron path is a reconciliation mechanism, not the realtime path.

Normal path:

1. Business transaction commits.
2. Outbox row is committed durably.
3. Immediate Queue publication is attempted after commit.
4. Processor persists the notification inbox.
5. Processor publishes to the recipient's Durable Object.
6. Connected clients receive the event over WebSocket.
7. Email delivery is processed independently.

Recovery path:

1. Immediate Queue publication fails.
2. The outbox row remains pending/failed.
3. Cron scans pending/failed rows.
4. The event is republished idempotently.

## Durable notification inbox

Recommended model:

```text
notifications
- id
- event_id
- event_type
- event_version
- recipient_type
- recipient_id
- title
- body
- payload_json
- created_at
- read_at
- expires_at
- dedupe_key
```

Recommended uniqueness:

`UNIQUE(event_id, recipient_type, recipient_id)`

Indexes must support recipient pagination, unread counts and reconnect/catch-up queries.

Canonical history must not live only inside a Durable Object.

## Channel delivery ledger

Channel state is independent:

- `IN_APP`
- `EMAIL`

Future:

- `WHATSAPP`
- `SMS`
- `PUSH`

Track at least notification id, channel, recipient, status, attempts, provider, provider message id, last error, next retry time, lease/claim metadata and sent timestamp.

A successful email must not be treated as proof of realtime delivery.

## NotificationHub Durable Object

Target class: `NotificationHub`.

Object identity:

```text
notification:{recipientType}:{recipientId}
```

The Worker authenticates the request first and derives the recipient identity from the real session. The client must never supply an arbitrary recipient id.

Durable Object memory is transport state only. Important application state is persisted in D1.

## WebSocket contract

Server event:

```json
{
  "type": "notification",
  "notificationId": "uuid",
  "eventId": "uuid",
  "eventType": "RepairReady",
  "eventVersion": 1,
  "createdAt": "2026-09-21T20:00:00.000Z",
  "title": "Tu equipo está listo",
  "body": "Tu reparación puede ser recogida.",
  "data": {}
}
```

Client transport ACK:

```json
{
  "type": "ack",
  "notificationId": "uuid"
}
```

ACK is transport telemetry only. Read state is persisted by authenticated application commands.

## Reconnect and catch-up

Every client must:

- keep a last-seen cursor;
- reconnect with exponential backoff and jitter;
- request catch-up from the durable API;
- reconcile gaps;
- resume WebSocket delivery;
- deduplicate by notification id.

A disconnect can never erase a persisted notification.

## Ordering

Cloudflare Queues provides at-least-once delivery but does not guarantee publication order. The application must not depend on global ordering.

The inbox is ordered by `created_at` plus `id`.

For aggregates that require causal ordering, include an aggregate version/sequence in the domain event and reject stale projections.

## Idempotency

Required keys:

- `eventId`;
- `eventId + recipientId`;
- `notificationId`;
- `notificationId + channel`.

Processing must be safe when a provider succeeds immediately before a Worker crash.

## Retry policy

Transient examples: timeout, `429`, `5xx` and temporary infrastructure failure.

Action:

- exponential backoff;
- bounded jitter;
- same idempotency key;
- bounded attempts.

Terminal examples: permanently invalid recipient, unsupported contract version, invalid provider credentials and authorization/policy failure.

Action:

- persist terminal status;
- emit audit evidence;
- send to DLQ;
- require controlled replay.

## DLQ and replay

Target queue resources:

```text
ecommerce-iphone-notifications
ecommerce-iphone-notifications-dlq
```

DLQ replay must require permission, preserve the original event id, increment a replay counter, reuse idempotency keys, create an audit event, be rate limited and support bounded batches.

Original failure evidence must never be silently deleted.

## Security

- same-origin WebSocket endpoint;
- strict Origin validation;
- authenticated session required;
- recipient derived server-side;
- no arbitrary recipient routing;
- no secrets in payloads;
- minimized PII;
- device identifiers masked;
- rate limit connection attempts;
- rate limit reconnect storms;
- cap active sockets per identity;
- audit replay/manual sends;
- server-side authorization for read/replay operations.

Customer, technician and admin notifications use separate scopes. Technician identity remains independent from `admin_users`.

## Target APIs

```text
GET    /api/notifications
GET    /api/notifications/unread-count
PATCH  /api/notifications/:id/read
POST   /api/notifications/read-all
GET    /api/notifications/realtime
```

`GET /api/notifications/realtime` upgrades to WebSocket.

Admin:

```text
GET    /api/admin/notifications
GET    /api/admin/notifications/dead-letter
POST   /api/admin/notifications/replay
POST   /api/admin/notifications/test-send
```

Manual/test sends must use the real notification pipeline and configured adapters. No fake provider path is allowed.

## Observability

Track:

- outbox age/backlog;
- queue depth and lag;
- retry counts;
- DLQ count;
- notification projection latency;
- realtime delivery latency;
- active WebSocket sessions;
- reconnect rate;
- duplicate suppression;
- email success/failure;
- provider latency;
- replay count;
- terminal failure count.

Propagate request/correlation id, event id, notification id, aggregate id, recipient id, channel and attempt.

Never log passwords, session tokens, payment secrets, full device identifiers or unnecessary PII.

## Tests

Required:

- event contract validation;
- recipient resolution;
- dedupe;
- preference evaluation;
- retry classification;
- outbox persistence;
- immediate Queue publish;
- Cron reconciliation;
- retry and DLQ;
- replay;
- inbox persistence;
- read/unread;
- email idempotency;
- WebSocket authentication;
- cross-user authorization;
- disconnect/reconnect/catch-up;
- multiple sessions;
- reconnect storms;
- p50/p95/p99 load measurements.

Load testing must exercise real Cloudflare primitives rather than replacing the delivery path with in-memory mocks.

## Implementation order

1. Event envelope and recipient resolution.
2. D1 notification inbox migration.
3. Channel delivery ledger independent from email.
4. Immediate Queue publication plus Cron reconciliation.
5. Dedicated notification Queue + DLQ.
6. `NotificationHub` Durable Object + WebSocket Hibernation.
7. Authenticated realtime and catch-up APIs.
8. Customer/technician/admin notification UI.
9. Retry classification and replay.
10. Metrics, audit and alerting.
11. Unit/integration/security/E2E/load tests.
12. Production deployment and certification.

## Certification

Fase 07 remains incomplete until realtime delivery, reconnect recovery, DLQ/replay, authorization, observability, load tests and production verification are evidenced.

## References

- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- https://developers.cloudflare.com/queues/configuration/configure-queues/
- https://developers.cloudflare.com/queues/configuration/dead-letter-queues/


## Implementación viva — 2026-09-22

La Fase 07 avanzó desde la base Outbox/Queue/Resend a una plataforma durable de inbox + realtime.

### Implementado en código

- notification_inbox persistente en D1 con aislamiento por recipient_type + recipient_id.
- Cursor opaco para paginación y catch-up.
- read_at y unread-count.
- PATCH /api/notifications/:id/read y POST /api/notifications/read-all.
- GET /api/notifications/realtime con autenticación server-side.
- NotificationHub Durable Object con WebSocket Hibernation y partición por identidad.
- Publisher realtime detrás de NotificationRealtimePort.
- Queue dedicada ecommerce-iphone-notifications.
- DLQ ecommerce-iphone-notifications-dlq.
- Persistencia de mensajes agotados en D1.
- Replay administrativo mediante notifications:replay, con auditoría.
- Bell realtime compartido y bandeja reutilizable para customer/technician.
- Admin backoffice muestra entregas y DLQ.
- Reintentos idempotentes del realtime reutilizan el mismo notificationId.
- notification_outbox versiona el evento y conserva destinatarios explícitos fuera de payload_json.

### No certificado todavía

La Fase 07 continúa amarilla hasta pasar:

- build Cloudflare del release actual;
- migraciones D1 remotas;
- verificación del Durable Object/Queue/DLQ desplegados;
- tests de autorización customer/technician/admin;
- E2E de desconexión -> catch-up;
- pruebas de deduplicación y replay;
- pruebas de carga realtime/Queue;
- métricas/alertas p95/p99;
- verify:production;
- evidencia productiva real.

EVENTS_QUEUE permanece consumiéndose temporalmente para compatibilidad con mensajes históricos; los eventos nuevos usan exclusivamente ecommerce-iphone-notifications.



### Resilience and channel state

The current implementation distinguishes provider failures into retryable and terminal classes. Retryable provider failures remain eligible for queue/outbox recovery. Terminal failures mark the outbox terminal state and are routed to the notifications DLQ for durable evidence and audited replay.

Explicit recipients use the channel-delivery ledger and channel-specific preferences. Legacy notification events that only carry an email address continue through the previous delivery ledger for backwards compatibility until all producers emit explicit recipient context.

