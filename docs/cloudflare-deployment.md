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

**GitHub Actions owns CI and automated tests. Cloudflare Workers Builds owns production D1 migrations and Worker deployment.**

### GitHub Actions — CI before merge

The workflow `.github/workflows/payment-consistency.yml` runs on pull requests to `main` and pushes to `main`. It performs:

1. Reproducible install with `pnpm install --frozen-lockfile`; the install lifecycle runs `scripts/verify-install.mjs`, and CI runs it again as an explicit named gate.
2. Complete dependency audit with `pnpm audit` (production, development and optional dependencies).
3. Prettier on changed files.
4. Repository foundations, frontend production-data and architecture checks.
5. ESLint and TypeScript as dedicated CI gates.
6. Complete Vitest unit/integration suite.
7. A local-only fixture bootstrap for legacy product parent rows required by migration `0009`, then the complete D1 migration history in local mode.
8. Playwright against local Wrangler using `wrangler dev --local`.
9. The exact OpenNext build command, `pnpm cloudflare:build`, as a CI gate before merge. This runs Next.js production compilation, static page generation and Worker bundling.
10. `pnpm verify:cloudflare:build` checks that the build produced the Next.js prerender manifest, static HTML pages, OpenNext Worker bundle and assets directory.

Pull-request CI has no Cloudflare or production credentials. The E2E database is local, initialized from repository migrations and their test/catalog seed data. CI never applies remote D1 migrations and never deploys a Worker.

### Cloudflare Workers Builds — production CD

Every push to the configured production branch `main` triggers Workers Builds. Cloudflare runs the configured Build command, then the Deploy command. The repository's Deploy command is `pnpm cloudflare:deploy`, which delegates to `pnpm cloudflare:deploy:production` and performs these operations in order:

1. Verify that Cloudflare Workers Builds reports `WORKERS_CI_BRANCH=main` (non-main branches are rejected).
2. Apply unapplied production D1 migrations with `pnpm db:migrate:production`.
3. Publish the Worker with `pnpm exec wrangler deploy --env=""`.

The production migration and Worker deployment therefore execute inside Cloudflare Workers Builds, using the API token configured for that Worker in Cloudflare. GitHub Actions does not need `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` to deploy.

**Required Cloudflare token permission:** the automatically generated Workers Builds token does not include D1 access by default. In Cloudflare, open **My Profile → API Tokens**, edit the token selected under the Worker’s **Settings → Build → API token**, and grant **Account → D1 → Edit**. Keep the existing Workers Scripts edit permission required to deploy the Worker. Without D1 Edit, the migration step will fail even though Worker upload permissions are correct.

The workflow `.github/workflows/production-verification.yml` separately runs scheduled/manual HTTP smoke checks after deployment. Deeper Phase 10.2–10.5 probes, which write synthetic analytics/cart rows and clean them up, are opt-in via `workflow_dispatch`. Authenticated admin/RBAC verification is also opt-in and uses dedicated GitHub Secrets.

The existing `.github/workflows/performance.yml` runs Playwright performance smoke checks from GitHub Actions on a schedule or manually.

### Cloudflare Workers Builds — build and deploy

Configure **Workers & Pages → ecommerce-iphone → Settings → Build**:

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Production branch | `main`                                                    |
| Build command     | `pnpm install --frozen-lockfile && pnpm build:cloudflare` |
| Deploy command    | `pnpm cloudflare:deploy`                                  |
| Root directory    | empty (monorepo root)                                     |

GitHub Actions runs `pnpm cloudflare:build` and verifies its generated static pages and Worker artifacts before merge. Cloudflare must still run the build command to create the deployable Worker artifact in its own build environment; this is artifact production, not a replacement for the GitHub CI gates. The Cloudflare build does not run the repository audit, full Vitest suite, local D1 bootstrap, Playwright E2E suite or production smoke probes.

The Deploy command is the only production deployment path. It runs the main-branch guard, applies remote D1 migrations, and publishes the Worker. Keep `main` as the production branch in the Cloudflare dashboard. The guard reads the `WORKERS_CI_BRANCH` variable injected by Workers Builds, so builds from any other branch are rejected.

**Important:** production Deploy and non-production Preview builds are independent controls. Cloudflare uses a separate Preview command when Preview Builds are enabled; it defaults to `npx wrangler preview`. See the [Cloudflare Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [branch control guide](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

### Previews for non-production branches

The repository currently has no isolated remote staging resources. Therefore, in **Workers & Pages → ecommerce-iphone → Settings → Build → Branch control**, leave **Enable Preview Builds** unchecked until separate Preview bindings exist for D1, R2, Queues, Durable Objects and any required secrets. The current top-level Wrangler bindings point to production resources; do not enable remote previews against those bindings.

If remote previews are enabled in the future, configure the separate Preview command and Preview-specific bindings, variables and secrets first. Do not use the production resources as a fallback. The `previews` block in `wrangler.jsonc` defines Preview runtime settings; its presence alone does not turn the dashboard's Preview Builds switch off.

Pull-request E2E runs locally in GitHub Actions with `wrangler dev --local`; a remote preview is not required to validate each PR.

## Versioned commands

- `pnpm build:cloudflare`: compile the Worker bundle; no tests and no deploy.
- `pnpm cloudflare:build`: OpenNext production build; run as a CI validation gate and again in Cloudflare to produce the deployable Worker artifact.
- `pnpm verify:cloudflare:build`: verify that Next.js static-page output, the OpenNext Worker bundle and static assets were generated.
- `pnpm cloudflare:deploy`: Workers Builds production hook; main-only guard, production D1 migrations, then Wrangler deploy.
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

Configure Worker secrets with `wrangler secret put <SECRET_NAME>`. Configure only the secrets actually required by production verification (such as dedicated admin/RBAC test credentials) as GitHub repository secrets. The Cloudflare deploy token is managed by Workers Builds in Cloudflare, not stored in GitHub Actions.

## Migrations and rollback

Production migrations are applied by the Cloudflare Workers Builds Deploy command immediately before publishing the Worker. Never edit an applied migration; add a new numbered migration.

Rollback remains manual through `.github/workflows/rollback.yml` and must be followed by a passing `pnpm verify:production`.
