# Ecommerce iPhone

Production-oriented e-commerce platform for smartphones and legitimate device services.

## Architecture

- Modular monolith
- Domain-Driven Design (DDD)
- Clean Architecture
- Next.js + TypeScript
- Cloudflare Workers + OpenNext
- Cloudflare D1 (one database per environment, not one per module)
- Cloudflare R2
- Cloudflare Queues
- Explicit application ports/adapters
- Bounded contexts prepared for future service extraction

## Phase status

### FASE 01 — Foundation
Implemented: modular boundaries, shared domain kernel, catalog vertical slice, Cloudflare/OpenNext runtime, D1/R2/Queues bindings, environment separation, security headers, RBAC/audit/rate-limit ports, unit/E2E test setup, CI and controlled deployment workflow.

### FASE 02 — Storefront + Catalog
Implemented: premium responsive storefront, D1-backed catalog, product domain model, search/filter/pagination, inventory visibility, product detail pages, clean iPhone SEO URLs, legacy redirects, dynamic metadata, canonical URLs, Product structured data, sitemap integration, D1 migration/seed data and Cloudflare-runtime Playwright setup.

### FASE 03 — Commerce Core
Implemented: customer aggregate and addresses, guest/customer session cookies, persistent D1 cart, quantity validation, server-side price/stock validation, checkout flow, order aggregate/state machine, order snapshots, atomic stock allocation, 15-minute inventory reservations, expired-reservation release routine, order events, protected order lookup, cart/checkout/order UI and commerce domain tests.

### FASE 04 — Payments
Implemented: provider-agnostic payment ledger and state machine, idempotency, webhook event deduplication, Wompi/Stripe/Mercado Pago/PayPal/Binance Pay adapters, server-side amount validation, hosted checkout/payment intents, refunds boundary and protected payment confirmation flow. Production validation still requires real provider sandbox credentials and webhook configuration.

### FASE 05 — Device Services
Implemented: legitimate carrier-unlock, diagnostics, repair and configuration catalog; service-request aggregate with explicit workflow; D1 persistence; audit ledger; customer request API; private request lookup; customer service request form; quote/assignment/status/completion application ports; identifier privacy controls that retain only IMEI/serial suffixes; tests and documentation.

## Data model boundary

Production uses a single D1 database containing tables for the bounded contexts. Code boundaries remain independent through repositories and application contracts. A module can be extracted to its own service/database later without redesigning the domain model.

## Cloudflare provisioning boundary

Cloudflare resource identifiers and secrets are intentionally not committed. Before staging/production deployment, provision the D1 databases, R2 buckets and Queues from `wrangler.jsonc`, replace the D1 placeholder IDs, apply migrations and configure the application domain/secrets in the deployment environment.

The source tree is ready for that provisioning step; the repository connector cannot create or authenticate Cloudflare account resources on the user's behalf.

## Commands

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm test:e2e
```

Remote D1 migration commands are also available:

```bash
pnpm db:migrate:staging
pnpm db:migrate:production
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

## Documentation

- `docs/architecture.md` — architecture and bounded-context rules
- `docs/development.md` — local, Cloudflare and migration workflow
- `docs/security.md` — security baseline
- `docs/payments.md` — payment provider architecture and webhook boundaries
- `docs/services.md` — service workflow and device-data privacy
- `modules/README.md` — module boundary overview

## Security

No credentials, payment secrets or Cloudflare secrets belong in Git. Use environment variables locally and Cloudflare/GitHub secret stores for deployment. Browser redirects are never treated as payment confirmation. Device identifiers are private and never exposed in full.
