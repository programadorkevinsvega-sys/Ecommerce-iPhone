# Cloudflare deployment

## Production environment

Canonical production domain: https://iphone.jnmtortas.com.

The repository uses one remote production environment in Cloudflare Workers. There is no remote staging environment yet.

| Resource     | Name                      |
| ------------ | ------------------------- |
| Worker       | `ecommerce-iphone`        |
| D1           | `ecommerce-iphone`        |
| R2           | `ecommerce-iphone-media`  |
| Events Queue | `ecommerce-iphone-events` |

Toolchain:

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.28`
- `@opennextjs/cloudflare 1.20.14`
- Wrangler `4.155.0`
- workerd compatibility date `2026-09-09`

## CI/CD ownership

**GitHub Actions owns all validation and production deployment. Cloudflare Workers Builds is build-only.**

### GitHub Actions — CI before merge

The workflow `.github/workflows/payment-consistency.yml` runs on pull requests to `main` and pushes to `main`. It performs:

1. Reproducible install with `pnpm install --frozen-lockfile`.
2. Complete dependency audit with `pnpm audit` (production, development and optional dependencies).
3. Prettier on changed files.
4. Repository foundations, frontend production-data and architecture checks.
5. ESLint and TypeScript.
6. Complete Vitest unit/integration suite.
7. A local-only fixture bootstrap for legacy product parent rows required by migration `0009`, then the complete D1 migration history in local mode.
8. Playwright against local Wrangler using `wrangler dev --local`.
9. Cloudflare Worker build as a CI gate, without deploying.

Pull-request CI has no Cloudflare or production credentials. The E2E database is local, initialized from repository migrations and their test/catalog seed data.

### GitHub Actions — CD after merge

The `deploy-production` job in the same workflow runs **only** when:

- the event is `push`;
- the ref is `refs/heads/main`;
- runner diagnostics and the complete quality job both succeeded.

The deployment job rebuilds the Worker, then runs `pnpm cloudflare:deploy:production`. This command checks that the active Git branch/ref is `main`, applies production D1 migrations and runs `wrangler deploy`. After deployment, GitHub Actions verifies D1 migration state, health/rate limiting, Phase 08 public content and authorization boundaries, Phase 09 SEO, and notification authorization boundaries.

The job requires GitHub Repository Secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Configure an optional required reviewer on the GitHub `production` environment if a human approval gate is desired.

The workflow `.github/workflows/production-verification.yml` separately runs scheduled/manual post-deploy smoke checks. Deeper Phase 10.2–10.5 probes, which write synthetic analytics/cart rows and clean them up, are opt-in via `workflow_dispatch`. Authenticated admin/RBAC verification is also opt-in and uses dedicated GitHub Secrets.

The existing `.github/workflows/performance.yml` runs Playwright performance smoke checks from GitHub Actions on a schedule or manually.

### Cloudflare Workers Builds — build only, no deploy

Configure **Workers & Pages → ecommerce-iphone → Settings → Build**:

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Production branch | `main`                                                    |
| Build command     | `pnpm install --frozen-lockfile && pnpm build:cloudflare` |
| Deploy command    | `pnpm cloudflare:deploy`                                  |
| Root directory    | empty (monorepo root)                                     |

The Cloudflare Build command only invokes `opennextjs-cloudflare build`. It does not run audits, lint, typecheck, Vitest, Playwright, E2E or smoke tests.

The Cloudflare Deploy command `pnpm cloudflare:deploy` is intentionally a no-op. It exists as a safe hook for Workers Builds and cannot apply migrations or publish a Worker. The real deployment is performed by the guarded GitHub Actions `deploy-production` job after successful CI on `main`.

This prevents a Cloudflare Workers Builds run for a feature branch or Pull Request from publishing to production, even if the dashboard branch setting is temporarily incorrect. Still configure `main` as the production branch in the dashboard.

### Previews for non-production branches

The repository currently has no isolated remote staging resources. Therefore, keep Cloudflare Preview Builds disabled until separate Preview bindings exist for D1, R2, Queues, Durable Objects and any required secrets. Never connect preview code to production resources.

Pull-request E2E runs locally in GitHub Actions with `wrangler dev --local`; a remote preview is not required to validate each PR.

## Versioned commands

- `pnpm build:cloudflare`: compile the Worker bundle; no tests and no deploy.
- `pnpm cloudflare:build`: build-only alias for Workers Builds.
- `pnpm cloudflare:deploy`: intentionally does not deploy; safe no-op for Workers Builds.
- `pnpm cloudflare:deploy:production`: main-only guard, production D1 migrations, then Wrangler deploy.
- `pnpm deploy:production`: local/manual build followed by the same main-only guarded production deploy.
- `pnpm db:migrate:local`: apply migrations to local D1.
- `pnpm db:prepare:e2e`: create local-only legacy parent rows needed by historical migrations, then apply the complete D1 migration history for E2E.
- `pnpm test`: Vitest.
- `pnpm test:e2e`: Playwright against local Wrangler.

## Production bindings

- `DB` → `ecommerce-iphone`
- `MEDIA_BUCKET` → `ecommerce-iphone-media`
- `EVENTS_QUEUE` → `ecommerce-iphone-events`
- `NOTIFICATIONS_QUEUE` → `ecommerce-iphone-notifications`
- `NOTIFICATIONS_DLQ_QUEUE` → `ecommerce-iphone-notifications-dlq`
- `API_RATE_LIMITER` → 120 requests / 60s
- `SENSITIVE_RATE_LIMITER` → 20 requests / 60s
- `APP_ENV` → `production`

## Secrets

Keep Worker secrets out of Git and CI logs:

- `RESEND_API_KEY`
- `ADMIN_BOOTSTRAP_TOKEN`
- payment provider credentials.

Configure Worker secrets with `wrangler secret put <SECRET_NAME>`. Configure secrets used by the Actions deploy/verification jobs as repository secrets, available only to workflows that need them.

## Migrations and rollback

Production migrations are applied as part of the GitHub Actions deployment job immediately before publishing the Worker. Never edit an applied migration; add a new numbered migration.

Rollback remains manual through `.github/workflows/rollback.yml` and must be followed by a passing `pnpm verify:production`.
