# Ecommerce iPhone

Production-oriented e-commerce platform for smartphones and legitimate device services.

## Architecture

- Modular monolith
- Domain-Driven Design (DDD)
- Clean Architecture
- Next.js + TypeScript
- Cloudflare Workers + OpenNext
- Cloudflare D1 (single production database)
- Cloudflare R2
- Cloudflare Queues
- Explicit application ports/adapters
- Bounded contexts prepared for future service extraction

## Phase status

### FASE 01 — Foundation
Implemented: modular boundaries, shared domain kernel, catalog vertical slice, Cloudflare/OpenNext runtime, D1/R2/Queues bindings, security headers, test setup, CI and controlled deployment workflow.

### FASE 02 — Storefront + Catalog
Implemented: responsive storefront, D1-backed catalog, product domain model, search/filter/pagination, inventory visibility, product detail pages, iPhone SEO URLs, redirects, dynamic metadata, canonical URLs, Product structured data and sitemap.

### FASE 03 — Commerce Core
Implemented: customer aggregate and addresses, guest/customer session cookies, persistent D1 cart, quantity validation, server-side price/stock validation, checkout flow, order aggregate/state machine, order snapshots, stock allocation, 15-minute inventory reservations, expired-reservation release, order events, protected order lookup and commerce UI/tests.

### FASE 04 — Payments
Implemented in the architecture plan as a provider-agnostic payment boundary. Production validation requires real provider credentials and webhook configuration.

### FASE 05 — Device Services
Implemented: configurable legitimate device-service catalog; service-request aggregate and workflow; D1 persistence; audit ledger; customer API/form; quote/assignment/status/completion application ports; identifier privacy controls retaining only IMEI/serial suffixes.

### FASE 06 — Admin + Backoffice + RBAC
Implemented: secure admin sessions, password hashing, login lockout, RBAC/permissions, administrator management, dashboard metrics, product/order/customer/service backoffice APIs, service-type administration, audit trail and admin observability.

### FASE 07 — Email + Notifications
Implemented: transactional notification outbox, D1 delivery ledger, Cloudflare Queue consumer, one-minute outbox dispatcher, Resend adapter, idempotent email delivery, order/service events, admin delivery observability and production configuration documentation.

## Data model boundary

Production uses a single D1 database containing tables for the bounded contexts. Code boundaries remain independent through repositories and application contracts. A module can be extracted to its own service/database later without redesigning the domain model.

## Cloudflare provisioning boundary

Production resources are external account resources. The repository contains their bindings and migrations; the real D1 ID and runtime secrets must remain outside Git.

## Commands

```bash
pnpm install
pnpm db:migrate:production
pnpm dev
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm test:e2e
```

## Commerce API

- `GET /api/cart` — read the current guest cart
- `POST /api/cart` — add/update a cart item
- `DELETE /api/cart` — remove a cart item
- `POST /api/checkout` — validate cart, create customer/address, allocate stock and create a pending-payment order
- `GET /api/customer` — read the current customer session
- `POST /api/customer` — create/reuse a customer and optionally save an address
- `GET /api/orders/:id` — read an order only for its customer session
- `GET /api/services` — service catalog and current customer's requests
- `POST /api/services` — create a service request
- `GET /api/services/:id` — read a service request only for its customer session
- `GET /api/admin/notifications` — admin-only notification delivery/outbox observability

## Documentation

- `docs/architecture.md` — architecture and bounded-context rules
- `docs/development.md` — local and Cloudflare workflow
- `docs/security.md` — security baseline
- `docs/payments.md` — payment boundary
- `docs/services.md` — service workflow and device-data privacy
- `docs/notifications.md` — Resend, outbox and Queue architecture
- `modules/README.md` — module boundary overview

## Security

No credentials, payment secrets, email provider secrets or Cloudflare secrets belong in Git. Use local environment files and Cloudflare/GitHub secret stores. Browser redirects are never payment confirmation. Device identifiers are private and never exposed in full.
