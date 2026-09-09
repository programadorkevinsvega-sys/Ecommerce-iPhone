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

The Wrangler configuration is root-level production-only; there are no `--env production` or staging deployment flags.

## Required GitHub environment secrets

Create one GitHub Environment named `production` and add:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token should be scoped to the target Cloudflare account and only the permissions required for this deployment.

## Cloudflare bindings

The repository expects:

- D1 binding `DB` -> `ecommerce-iphone`
- R2 binding `MEDIA_BUCKET` -> `ecommerce-iphone-media`
- Queue producer binding `EVENTS_QUEUE` -> `ecommerce-iphone-events`

Replace `REPLACE_WITH_PRODUCTION_DATABASE_ID` in `wrangler.jsonc` with the real D1 UUID from the Cloudflare account before the first remote deployment.

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
5. Configure provider secrets in the Worker.
6. Configure `ADMIN_BOOTSTRAP_TOKEN` temporarily.
7. Run the production workflow manually.
8. Bootstrap the first administrator.
9. Rotate/remove the bootstrap secret.
10. Configure the production custom domain.

A successful Git commit alone does not prove that the production Worker is live; the external GitHub Actions and Cloudflare execution must complete successfully.
