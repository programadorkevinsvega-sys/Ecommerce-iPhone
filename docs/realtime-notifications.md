# Realtime notifications — technical design

## Purpose

This document defines the production implementation for realtime notifications on Cloudflare Workers.

Goals:
- low-latency in-app notifications;
- durable delivery while clients are offline;
- horizontal scalability;
- strict recipient isolation;
- idempotent processing;
- retries, DLQ and replay;
- compatibility with DDD + Clean Architecture.

## Non-goals

- WebSocket as the only persistence layer;
- exactly-once delivery;
- coupling business domains to Cloudflare APIs;
- fake providers in production;
- sensitive secrets in realtime payloads.

## Architecture

```text
Business command
    ↓
Domain state + notification event
    ↓
Application notification port
    ↓
D1 notification_outbox
    ↓
Immediate publish to Queue
    ↓
Notification Processor
    ├── D1 notification inbox
    ├── realtime publisher
    └── email provider
            ↓
      NotificationHub DO
            ↓
       WebSocket Hibernation
            ↓
         Client UI
```

Durable Objects are the coordination layer for live WebSocket sessions. D1 remains the canonical notification history.

## Identity partitioning

Use one Durable Object instance per recipient identity:

```text
notification:customer:{customerId}
notification:technician:{technicianId}
notification:admin:{adminUserId}
```

This avoids a single global realtime hot spot and gives the authorization boundary the same partition as the recipient.

Never create the object using an untrusted recipient id from the browser.

## Authentication

WebSocket handshake:

1. validate request Origin;
2. validate the authenticated session;
3. resolve the real recipient identity server-side;
4. calculate the Durable Object id from that identity;
5. attach the WebSocket.

Reject:

- unauthenticated connections;
- invalid Origin;
- expired/revoked sessions;
- recipient mismatch;
- excessive connection attempts;
- excessive active connections per identity.

## Durable state

D1 canonical records:

- notification inbox;
- read state;
- delivery attempts;
- replay/audit evidence;
- preferences.

Durable Object state:

- active socket registry;
- ephemeral connection metadata;
- transport cursor information.

Important business/application state must survive Durable Object hibernation and restart.

## Notification inbox

Recommended schema:

```text
notifications
  id                  TEXT PRIMARY KEY
  event_id            TEXT NOT NULL
  event_type          TEXT NOT NULL
  event_version       INTEGER NOT NULL
  recipient_type      TEXT NOT NULL
  recipient_id        TEXT NOT NULL
  title               TEXT NOT NULL
  body                TEXT NOT NULL
  payload_json        TEXT NOT NULL
  created_at          TEXT NOT NULL
  read_at             TEXT
  expires_at          TEXT
  dedupe_key          TEXT NOT NULL
```

Uniqueness:

```text
(event_id, recipient_type, recipient_id)
```

Required indexes:

- recipient + created_at;
- recipient + read_at;
- recipient + created_at + id;
- dedupe key.

## Queue strategy

Current generic queue:

- `ecommerce-iphone-events`

Target notification-specific resources:

```text
ecommerce-iphone-notifications
ecommerce-iphone-notifications-dlq
```

The dedicated notification queue isolates notification backpressure from unrelated domain processing.

Cloudflare Queues uses at-least-once delivery and can retry or route exhausted messages to a DLQ. It does not guarantee publication order.

## Immediate publish + reconciliation

After the business transaction commits:

1. publish the outbox id to the notification queue;
2. if publishing succeeds, mark the outbox record as queued;
3. if publishing fails, leave it pending/failed;
4. Cron scans pending/failed rows and republishes them;
5. duplicate queue messages are safe because processing is idempotent.

This removes the one-minute Cron from the normal latency path while preserving recovery.

## Processor idempotency

Queue message should remain compact:

```json
{
  "eventId": "uuid",
  "schemaVersion": 1
}
```

The processor loads the durable event from D1.

Per-recipient key:

```text
eventId:recipientType:recipientId
```

Per-channel key:

```text
notificationId:channel
```

## Projection order

1. validate event envelope;
2. resolve recipients;
3. insert notification inbox rows with uniqueness checks;
4. publish realtime to connected recipients;
5. process independent channel adapters;
6. write delivery ledger;
7. acknowledge Queue processing only when the message is fully processed.

If WebSocket delivery fails after the inbox write, retrying must not create another notification row.

## Realtime protocol

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

ACK is transport telemetry only. Read state uses an authenticated application command.

## Catch-up API

```text
GET /api/notifications?cursor=<opaque>
GET /api/notifications/unread-count
PATCH /api/notifications/:id/read
POST /api/notifications/read-all
GET /api/notifications/realtime
```

WebSocket is never the only way to consume notifications.

## Client reconnection

Recommended backoff:

```text
base: 500ms
cap: 30s
full jitter
reset after stable connection
```

Reconnect flow:

1. restore authenticated session;
2. fetch catch-up from cursor;
3. deduplicate already processed ids;
4. establish WebSocket;
5. continue live events.

## Ordering

Do not assume Queue order.

UI ordering uses durable `created_at` + `id`.

If an aggregate needs causal ordering, include `aggregateVersion` and reject stale updates.

## Retry and DLQ

Transient:

- `429`;
- `5xx`;
- timeout;
- temporary infrastructure failure.

Retry with exponential backoff, bounded jitter and preserved idempotency keys.

Terminal:

- malformed event;
- unsupported schema version;
- permanently invalid recipient;
- invalid provider configuration;
- authorization violation.

Terminal failures must be persisted, audited and sent to DLQ.

## Replay

Replay requires:

- explicit administrative permission;
- original event id preserved;
- replay counter;
- audit actor/time;
- bounded batch size;
- rate limit;
- real notification pipeline.

Replay must never fabricate delivery success.

## Observability

Metrics:

- queue depth;
- queue lag;
- outbox age;
- projection latency;
- realtime p50/p95/p99;
- active sockets;
- reconnect rate;
- failure rate;
- duplicate suppression;
- unread query latency;
- email provider latency;
- DLQ size;
- replay count.

Correlation fields:

- request id;
- event id;
- notification id;
- aggregate id;
- recipient id;
- channel;
- attempt.

Never log passwords, session tokens, payment secrets, full device identifiers or unnecessary PII.

## Security tests

- customer isolation;
- technician isolation;
- admin authorization;
- Origin validation;
- expired/revoked session rejection;
- recipient spoofing rejection;
- replay authorization;
- connection rate limiting;
- PII minimization.

## Load tests

Use real Workers/Queues/Durable Objects:

- sustained active WebSocket connections;
- notification bursts;
- offline recipients;
- reconnect storms;
- Queue backlog;
- concurrent fan-out;
- multiple sessions for one identity.

Record p50/p95/p99 latency, Queue lag, D1 pressure, active connections, error rate and duplicate rate.

## Definition of Done

- D1 inbox migration deployed;
- notification Queue + DLQ deployed;
- `NotificationHub` deployed;
- authenticated WebSocket endpoint live;
- catch-up API live;
- read/unread API live;
- retry classification implemented;
- replay tool permissioned and audited;
- metrics and alerts present;
- unit/integration/security/E2E/load tests passing;
- production verification passes;
- no mocks/fake providers in the production notification path.