# Cloudflare deployment

## Actualización operativa — 2026-09-21

El dominio canónico de producción es https://iphone.jnmtortas.com. Los workflows de despliegue, verificación, performance y rollback quedan alineados con ese dominio y con pnpm 12.4.1 + Node 24.18.0, evitando que los gates consulten workers.dev distintos al Worker publicado.

El cambio solo corrige la fuente de verdad operativa y reproducibilidad del pipeline. La versión actual de main seguirá sin certificación hasta completar un ciclo íntegro de build, deploy y verify.

The repository uses a **single remote production environment** on Cloudflare Workers with OpenNext.

## Production resources

| Resource | Name |
|---|---|
| Worker | `ecommerce-iphone` |
| D1 | `ecommerce-iphone` |
| R2 | `ecommerce-iphone-media` |
| Queue | `ecommerce-iphone-events` |

There is no remote staging environment.

## Toolchain

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`
- Wrangler `4.131.1` in the latest confirmed Cloudflare build
- workerd compatibility date `2026-09-09`

## Deployment contract

```bash
pnpm db:migrate:production
pnpm build:cloudflare
wrangler deploy --env=""
pnpm verify:production
```

Shortcut:

```bash
pnpm deploy:production
```

## Bindings

- `DB` -> `ecommerce-iphone`
- `MEDIA_BUCKET` -> `ecommerce-iphone-media`
- `EVENTS_QUEUE` -> `ecommerce-iphone-events`
- `API_RATE_LIMITER` -> 120 requests / 60s
- `SENSITIVE_RATE_LIMITER` -> 20 requests / 60s
- `APP_ENV` -> production

## Current production evidence

Latest directly verified Worker before current unverified changes:

`f7d67832-8598-4f59-8db9-b538f543b3ef`

Verified:

- `/api/health/live` → 200
- `/api/health/ready` → 200
- `verify:production` → PASS

Subsequent commits require a new successful Cloudflare build/deploy/verify cycle. The current `main` contains technician-domain and shared-navigation fixes that are not yet production-certified.

## Runtime secrets

Keep secrets outside Git:

- `RESEND_API_KEY`
- `ADMIN_BOOTSTRAP_TOKEN`
- Wompi/Stripe/Mercado Pago/PayPal/Binance Pay secrets
- other operational tokens.

```bash
wrangler secret put <SECRET_NAME>
```

## Migrations

```bash
pnpm db:migrate:production
```

Never edit an applied migration. Add the next numbered migration.

## Rollback

Rollback to a known Worker version, then run `pnpm verify:production` and confirm both health endpoints.


## Cloudflare Workers Builds

Configuración canónica del Dashboard para el Worker `ecommerce-iphone`:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Build command | `pnpm install --frozen-lockfile && pnpm build:cloudflare` |
| Deploy command | `pnpm cloudflare:deploy` |
| Version command | `pnpm exec wrangler --version` |
| Root directory | vacío (raíz del repositorio) |

El Root directory debe permanecer vacío porque `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc` y `apps/web/` pertenecen al monorepo raíz.

Los equivalentes versionados en `package.json` son:

```bash
pnpm cloudflare:build
pnpm cloudflare:deploy
pnpm cloudflare:version
```

`cloudflare:build` reproduce exactamente el Build command de Workers Builds.
`cloudflare:deploy` reproduce el Deploy command de Workers Builds y aplica las migraciones D1 antes de publicar.
`cloudflare:version` reproduce exactamente el Version command de Workers Builds.

El Deploy command de Workers Builds ejecuta `pnpm cloudflare:deploy`, que aplica las migraciones D1 de producción y después publica el Worker. `pnpm deploy:production` sigue siendo el release completo manual/reproducible porque además construye y ejecuta `verify:production`.

Los cuatro campos de Workers Builds no se configuran dentro de `wrangler.jsonc`; `wrangler.jsonc` continúa siendo el contrato declarativo del Worker para rutas, D1, R2, Queues, rate limits, cron y variables no secretas.


### Fase 07 notification resources

| Resource | Name |
|---|---|
| Notifications Queue | `ecommerce-iphone-notifications` |
| Notifications DLQ | `ecommerce-iphone-notifications-dlq` |
| Durable Object | `NotificationHub` |
| D1 inbox | `notification_inbox` |
| D1 channel ledger | `notification_channel_deliveries` |
| D1 preferences | `notification_preferences` |
| D1 terminal evidence | `notification_dead_letters` |

The production deploy must apply D1 migrations before the Worker is published so the code and schema move together.

