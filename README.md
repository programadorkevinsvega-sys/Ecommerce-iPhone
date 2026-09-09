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

Implemented in the repository: modular boundaries, shared domain kernel, catalog vertical slice, Cloudflare/OpenNext runtime, D1/R2/Queues bindings, environment separation, security headers, RBAC/audit/rate-limit ports, unit/E2E test setup, CI and controlled deployment workflow.

### FASE 02 — Storefront + Catalog

Implemented: premium responsive storefront, D1-backed catalog, product domain model, search/filter/pagination, inventory visibility, product detail pages, clean iPhone SEO URLs, legacy URL redirects, dynamic metadata, canonical URLs, Product structured data, sitemap integration, D1 migration/seed data, Cloudflare-runtime Playwright setup and catalog E2E coverage.

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

## Documentation

- `docs/architecture.md` — architecture and bounded-context rules
- `docs/development.md` — local, Cloudflare and migration workflow
- `docs/security.md` — security baseline
- `modules/README.md` — module boundary overview

## Security

No credentials, payment secrets or Cloudflare secrets belong in Git. Use environment variables locally and Cloudflare/GitHub secret stores for deployment.
