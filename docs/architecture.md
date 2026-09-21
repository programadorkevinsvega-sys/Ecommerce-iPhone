# Architecture

## Actualización de boundary técnico — 2026-09-21

Las rutas HTTP de técnicos ya no consultan repositorios de reparación ni acceden directamente a R2/runtime adapters. Ownership, transiciones, ficha técnica y evidencia pasan por Application, ports y adapters compuestos desde apps/web/lib/technicianApplication.ts.

La identidad técnica continúa aislada de admin_users y no se introduce un segundo RBAC administrativo. Esta corrección refuerza el mismo contrato de Clean Architecture utilizado por los demás bounded contexts.

## Style

Ecommerce iPhone is a modular monolith using Domain-Driven Design and Clean Architecture.

Dependency direction:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↑
Ports
    ↑
Infrastructure
    ↓
D1 / R2 / Queue / Durable Objects / external providers
```

Domain code never imports Next.js, React, Cloudflare bindings, D1 clients, payment SDKs, email SDKs or HTTP clients.

## Bounded contexts

Current contexts include:

- auth
- users
- customers
- catalog
- inventory
- cart
- checkout
- orders
- payments
- shipping
- unlock
- services
- reviews
- coupons
- promotions
- notifications
- email
- seo
- analytics
- cms
- support
- admin
- **technicians**

### Notifications

`notifications` is the cross-cutting bounded context for user-facing delivery of business events.

It owns notification persistence, delivery orchestration, deduplication, retries, replay and channel adapters. It does not own business state.

Realtime delivery uses a Cloudflare Durable Object `NotificationHub` to coordinate authenticated WebSocket sessions. D1 remains the canonical notification history.

### Technicians

`technicians` is an independent operational identity context.

A technician is **not** an `admin_users` RBAC role.

The context owns:

- `TechnicianUser`
- technician authentication
- technician sessions
- technician password/token hashing
- technician device operations
- technician audit events.

Persistence uses D1 through repositories and ports.

Presentation is isolated under:

```text
apps/web/app/technician/**
apps/web/app/api/technician/**
```

Authorization is based on `technician_session` and assignment ownership. A technician cannot use this identity to access administrative operations.

## Cross-module communication

Modules communicate through public application contracts and domain events. A module must not import another module's internal domain entities, repositories, infrastructure adapters or direct database implementation.

A future Queue/microservice extraction should replace transport/infrastructure boundaries without rewriting the domain.

## Persistence

D1 is an infrastructure detail. SQL migrations live at the repository root and are versioned with code.

R2 is used for media and protected repair evidence according to the access policy.

Durable Objects are used for realtime coordination, not canonical business history. Important notification state remains in D1.

## Realtime notification flow

```text
Domain event
    ↓
Application notification port
    ↓
D1 notification_outbox
    ↓
Queue
    ↓
Notification Processor
    ├── D1 notification inbox
    ├── EmailProvider -> Resend
    └── RealtimeNotificationPublisher
             ↓
      NotificationHub Durable Object
             ↓
        WebSocket Hibernation
             ↓
      authenticated browser
```

Immediate Queue publication is the latency path. Cron reconciliation repairs outbox records that could not be published immediately.

Consistency model:

- D1 business state is durable.
- Outbox publication is durable.
- Queue delivery is at-least-once.
- Processing is idempotent.
- Notification inbox is durable.
- WebSocket delivery is low-latency and reconnectable.
- Global Queue ordering is not assumed.

## Presentation rules

HTTP routes are adapters. They validate request shape at the boundary, resolve the application composition root and map application/domain errors to safe HTTP responses.

No production route should:

- execute SQL directly;
- instantiate repositories to bypass Application;
- mutate Domain entities ad hoc;
- implement a second authorization flow.

Public storefront navigation is centralized in:

```text
apps/web/app/components/StoreHeader.tsx
```

The technical workspace uses a shared operational navigation component:

```text
apps/web/app/technician/TechnicianHeader.tsx
```

The shared storefront navigation is client-compatible because it is reused by server-rendered storefront pages and the client-side customer account surface.

Technician pages use `TechnicianHeader` for the shared operational navigation. A broader visual-system consolidation for `/technician/**` remains part of the pending technician UI hardening and is not marked complete.

Administrative navigation/loading patterns are centralized through the existing Admin components.

## Extraction path

A future microservice extraction should move a complete bounded context behind its application contract/event boundary. The goal is to replace transport/infrastructure adapters, not rewrite the domain model.
