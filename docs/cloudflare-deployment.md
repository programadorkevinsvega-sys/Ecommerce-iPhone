# Cloudflare deployment

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
