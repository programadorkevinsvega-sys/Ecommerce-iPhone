# Cloudflare deployment

The repository uses a **single remote production environment** on Cloudflare Workers with OpenNext.

## Production resources

| Resource | Name |
| --- | --- |
| Worker | `ecommerce-iphone` |
| D1 | `ecommerce-iphone` |
| R2 | `ecommerce-iphone-media` |
| Queue | `ecommerce-iphone-events` |

There is no remote staging environment.

## Deployment contract

Production deployment is:

```bash
pnpm db:migrate:production
pnpm build:cloudflare
wrangler deploy --env=""
pnpm verify:production
```

The actual acceptance criterion is the Cloudflare build/deploy plus direct production verification. GitHub Actions is auxiliary automation and is not the acceptance criterion.

## Cloudflare bindings

The Worker expects:

- D1 binding `DB` -> `ecommerce-iphone`
- R2 binding `MEDIA_BUCKET` -> `ecommerce-iphone-media`
- Queue producer/consumer `EVENTS_QUEUE` -> `ecommerce-iphone-events`
- `API_RATE_LIMITER` -> 120 requests / 60s
- `SENSITIVE_RATE_LIMITER` -> 20 requests / 60s

The production D1 UUID is already present in `wrangler.jsonc`.

## Runtime secrets

Secrets remain outside Git and are configured directly in Cloudflare, including when applicable:

- `RESEND_API_KEY`
- `ADMIN_BOOTSTRAP_TOKEN`
- payment-provider credentials once Payments is implemented.

Use:

```bash
wrangler secret put <SECRET_NAME>
```

Never commit credentials to the repository.

## Health verification

After deployment:

```bash
pnpm verify:production
```

The production verifier checks the public Worker, including liveness/readiness and configured runtime invariants.

## D1 migrations

Migrations are versioned in `migrations/` and applied remotely only to production:

```bash
pnpm db:migrate:production
```

Never edit a migration that has already been applied to production. Add the next numbered migration instead.

## Rollback

Rollback must target a known Cloudflare Worker version ID. After rollback, execute the production verification again and confirm both health endpoints before considering the rollback complete.
