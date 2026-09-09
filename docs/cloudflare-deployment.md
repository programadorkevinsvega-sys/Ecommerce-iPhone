# Cloudflare deployment

The repository is prepared for a **single production environment** on Cloudflare Workers using OpenNext.

## Production resources

| Resource | Name |
| --- | --- |
| Worker | `ecommerce-iphone-production` |
| D1 | `ecommerce-iphone` |
| R2 | `ecommerce-iphone-media` |
| Queue | `ecommerce-iphone-events` |

There is no staging environment.

## GitHub Actions

`.github/workflows/ci.yml` performs architecture checks, linting, typechecking, unit tests, builds and E2E validation.

`.github/workflows/deploy.yml` deploys production after architecture checks, typechecking, unit tests and the OpenNext Cloudflare build. It applies remote D1 migrations and then deploys the Worker. Deployments are serialized.

The Wrangler configuration is root-level production-only; there are no staging deployment flags.

## Required GitHub environment secrets

Create one GitHub Environment named `production` and add:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token should be scoped to the target Cloudflare account and only the permissions required for this deployment.

## Cloudflare bindings

The repository expects:

- D1 binding `DB` -> `ecommerce-iphone`
- R2 binding `MEDIA_BUCKET` -> `ecommerce-iphone-media`
- Queue producer/consumer binding `EVENTS_QUEUE` -> `ecommerce-iphone-events`

Replace `REPLACE_WITH_PRODUCTION_DATABASE_ID` in `wrangler.jsonc` with the real D1 UUID from the Cloudflare account before the first remote deployment.

## Notifications

The Worker also requires:

- `RESEND_API_KEY` as a Cloudflare secret
- `EMAIL_FROM` as a Worker variable

The notification outbox is stored in D1. A Cron Trigger dispatches pending records to the Queue and the same Worker consumes the Queue and calls Resend. Cloudflare supports configuring Queue consumers directly in Wrangler and scheduled handlers through Cron Triggers.

## Admin bootstrap secret

Set the first-admin bootstrap secret directly in Cloudflare, never in Git:

`wrangler secret put ADMIN_BOOTSTRAP_TOKEN`

Then call `POST /api/admin/auth/bootstrap` with `X-Admin-Bootstrap-Token`, email, name, role and a password of at least 12 characters. After the first administrator is created, rotate/remove `ADMIN_BOOTSTRAP_TOKEN`.

## Provider secrets

Payment and email provider secrets are runtime secrets and must remain outside Git.

## First production deployment

1. Verify D1/R2/Queue names.
2. Put the real D1 database ID in `wrangler.jsonc`.
3. Create the GitHub `production` Environment.
4. Add the Cloudflare GitHub secrets.
5. Configure `RESEND_API_KEY` and `EMAIL_FROM`.
6. Configure other provider secrets.
7. Configure `ADMIN_BOOTSTRAP_TOKEN` temporarily.
8. Run the production workflow manually.
9. Bootstrap the first administrator.
10. Rotate/remove the bootstrap secret.
11. Configure the production custom domain.

A successful Git commit alone does not prove that the production Worker is live; the external GitHub Actions and Cloudflare execution must complete successfully.
