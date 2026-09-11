# Ecommerce iPhone

Production-oriented e-commerce platform for smartphones and legitimate device services.

## Architecture

- Modular monolith
- Domain-Driven Design (DDD)
- Clean Architecture
- Next.js + TypeScript
- Cloudflare Workers + OpenNext
- Cloudflare D1
- Cloudflare R2
- Cloudflare Queues
- Explicit application ports/adapters
- Bounded contexts prepared for future service extraction

## Phase status

### FASE 01 — Foundation
Foundation is implemented as the platform baseline: modular boundaries, shared domain kernel, catalog vertical slice, Cloudflare/OpenNext runtime, D1/R2/Queues bindings, HTTP security baseline, request tracing, CI quality gates and production deployment. Final closure still requires lockfile-based reproducibility and the remaining certification gates.

### FASE 02 — Storefront + Catalog
Implemented: responsive storefront, D1-backed catalog, product domain model, search/filter/pagination, inventory visibility, product detail pages, iPhone SEO URLs, redirects, dynamic metadata, canonical URLs, Product structured data and sitemap. Final certification still requires complete E2E/accessibility/performance evidence.

### FASE 03 — Commerce Core
Implemented: customer aggregate and addresses, guest/customer session cookies, persistent D1 cart, quantity validation, server-side price/stock validation, checkout flow, order aggregate/state machine, order snapshots, stock allocation, inventory reservations, expired-reservation release, order events, protected order lookup/listing and commerce UI/tests.

### FASE 04 — Payments
**Real production integration implemented in code.** The current provider adapter is Wompi Colombia and uses the real Web Checkout, server-generated integrity signatures, authenticated payment intents, D1 payment persistence/idempotency, signed production webhooks, provider transaction reconciliation, payment ledger/audit records, concurrency-safe order/payment transitions and inventory reservation consume/release integration. No fake provider, mock payment response or simulated transaction is used by the runtime.

Production activation requires only the real Wompi production credentials/secrets to be configured outside Git and the real Wompi webhook URL to be registered in the merchant dashboard. The final phase certification additionally requires real production evidence and provider capability validation for refund/void operations.

### FASE 05 — Device Services
Implemented: configurable legitimate device-service catalog; service-request aggregate and workflow; D1 persistence; audit ledger; customer API/form; quote/assignment/status/completion application ports; identifier privacy controls retaining only IMEI/serial suffixes.

### FASE 06 — Admin + Backoffice + RBAC
Implemented: secure admin sessions, password hashing, login lockout, RBAC/permissions, administrator management, dashboard metrics, product/order/customer/service backoffice APIs, service-type administration, audit trail and admin observability.

### FASE 07 — Email + Notifications
Implemented: transactional notification outbox, D1 delivery ledger, Cloudflare Queue consumer, one-minute outbox dispatcher, Resend adapter, idempotent email delivery, order/service events, admin delivery observability and production configuration documentation.

## Data model boundary

D1 contains tables for the bounded contexts. Code boundaries remain independent through repositories and application contracts. A module can be extracted to its own service/database later without redesigning the domain model.

## Cloudflare provisioning boundary

Cloudflare resources are external account resources. The repository contains their bindings and migrations; runtime secrets stay outside Git. Workers Builds should use the repository's pnpm workspace explicitly because the monorepo is standardized on pnpm.

Production is the only remote operational environment. Local Next.js/Vitest/Playwright/D1 emulation is development tooling, not a second deployed environment.

Recommended production build configuration:

```text
Build command:
pnpm install --frozen-lockfile && pnpm build:cloudflare

Deploy command:
pnpm deploy:production

Root directory:
/
```

Production deployment applies pending remote D1 migrations before deploying the Worker:

```text
pnpm db:migrate:production
pnpm build:cloudflare
pnpm exec wrangler deploy
```

Do not use `npm run build` + `npx wrangler deploy` for the production Worker, because the first command runs the regular Next.js build rather than the OpenNext Cloudflare build.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm foundation:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm test:e2e
pnpm deploy:production
```

## Commerce API

- `GET /api/cart` — read the current guest cart
- `POST /api/cart` — add/update a cart item
- `DELETE /api/cart` — remove a cart item
- `POST /api/checkout` — validate cart, create customer/address, allocate stock and create a pending-payment order
- `POST /api/payments/intent` — create/reuse a real Wompi payment intent for the authenticated order
- `POST /api/payments/webhooks/wompi` — receive and verify signed Wompi production transaction events
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
- `docs/foundation.md` — Fase 1 Foundation implementation and closure checklist
- `docs/security.md` — security baseline
- `docs/payments.md` — real Wompi payment integration, lifecycle, webhooks and production activation
- `docs/services.md` — service workflow and device-data privacy
- `docs/notifications.md` — Resend, outbox and Queue architecture
- `modules/README.md` — module boundary overview
- `docs/auditoria-fases-1-7.md` — deep audit and master implementation plan

## Security

No credentials, payment secrets, email provider secrets or Cloudflare secrets belong in Git. Use local environment files and Cloudflare/GitHub secret stores. Browser redirects are never payment confirmation. Device identifiers are private and never exposed in full.
