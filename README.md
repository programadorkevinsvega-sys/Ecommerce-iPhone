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

## Foundation status

FASE 01 foundation is implemented in the repository: architecture boundaries, shared domain kernel, initial catalog vertical slice, Cloudflare configuration, environment separation, security baseline, RBAC/audit/rate-limit ports, tests, CI and controlled deployment workflow.

Cloudflare resource identifiers and secrets are intentionally not committed. They must be configured per environment before remote deployment.

## Commands

```bash
pnpm install
pnpm dev
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
```

## Documentation

- `docs/architecture.md` — architecture and bounded-context rules
- `docs/development.md` — local, Cloudflare and migration workflow
- `modules/README.md` — module boundary overview

## Security

No credentials, payment secrets or Cloudflare secrets belong in Git. Use environment variables locally and Cloudflare/GitHub secret stores for deployment.
