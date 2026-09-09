# Cloudflare deployment

The repository is prepared for a **single production environment** on Cloudflare Workers using OpenNext.

## Production resources

| Resource | Name |
| --- | --- |
| Worker | `ecommerce-iphone-production` |
| D1 | `ecommerce-iphone` |
| R2 | `ecommerce-iphone-media` |
| Queue | `ecommerce-iphone-events` |

Development uses local tooling and local D1 for tests. There is no staging environment in this project.

## GitHub Actions

`.github/workflows/ci.yml` performs architecture checks, linting, typechecking, unit tests, Next.js/OpenNext builds and local D1/E2E validation.

`.github/workflows/deploy.yml` is production-only:

- every push to `main` -> production deployment;
- manual `workflow_dispatch` -> production deployment;
- architecture and type checks before deployment;
- unit tests before deployment;
- OpenNext Cloudflare build;
- remote D1 migrations before Worker deployment;
- serialized production deployments.

The workflow does not bypass failed quality checks.

## Required GitHub environment secrets

Create one GitHub Environment named `production` and add:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token should have only the permissions required to deploy Workers and manage the D1/R2/Queues resources used by this project.

## Cloudflare resources required once

Create these resources in the target Cloudflare account:

- D1 database: `ecommerce-iphone`
- R2 bucket: `ecommerce-iphone-media`
- Queue: `ecommerce-iphone-events`
- Worker: `ecommerce-iphone-production`

Put the real D1 database ID in `wrangler.jsonc` in place of `REPLACE_WITH_PRODUCTION_DATABASE_ID`.

GitHub cannot safely invent account-specific resource IDs.

## Provider secrets

Payment provider secrets are runtime secrets and must be configured in the production Worker environment, not committed to Git:

- Wompi
- Stripe
- Mercado Pago
- PayPal
- Binance Pay
- any future provider adapters

The exact variables are documented in `.env.example` and `docs/payments.md`.

## Domain

The production origin is intentionally not hardcoded until the real domain is selected. Configure the Cloudflare custom domain/route and then set the corresponding production origin policy in the Worker configuration.

## First production deployment

1. Create the production D1 database.
2. Create the production R2 bucket.
3. Create the production Queue.
4. Put the real D1 ID in `wrangler.jsonc`.
5. Create the GitHub `production` Environment.
6. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets.
7. Configure payment provider secrets in the Cloudflare Worker.
8. Configure the production custom domain.
9. Run the production workflow manually once to validate the initial deployment.
10. After that, normal pushes to `main` deploy production automatically.

## Important limitation

A GitHub commit does not mean the application is already deployed. Actual Cloudflare account provisioning, the D1 database ID, custom domain and secrets require authorization to the target Cloudflare account.
