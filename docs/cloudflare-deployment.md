# Cloudflare deployment

The repository is prepared for GitHub Actions deployment to Cloudflare Workers using OpenNext, with one D1 database per environment.

## Environments

| Environment | Worker | D1 | R2 | Queue |
| --- | --- | --- | --- | --- |
| development | `ecommerce-iphone-development` | `ecommerce-iphone-development` | `ecommerce-iphone-development-media` | `ecommerce-iphone-development-events` |
| staging | `ecommerce-iphone-staging` | `ecommerce-iphone-staging` | `ecommerce-iphone-staging-media` | `ecommerce-iphone-staging-events` |
| production | `ecommerce-iphone-production` | `ecommerce-iphone` | `ecommerce-iphone-media` | `ecommerce-iphone-events` |

## GitHub Actions

`.github/workflows/ci.yml` performs architecture checks, linting, typechecking, unit tests, Next.js/OpenNext builds and local D1/E2E validation.

`.github/workflows/deploy.yml` supports:

- push to `main` -> production deployment;
- manual deployment -> staging or production;
- architecture and type checks before deployment;
- unit tests before deployment;
- OpenNext Cloudflare build;
- remote D1 migrations before Worker deployment;
- serialized deployments per environment.

The workflow does not bypass failed quality checks.

## Required GitHub environment secrets

Create `staging` and `production` GitHub Environments and add these secrets to each environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token should have only the permissions required to deploy Workers and manage the D1/R2/Queues resources used by this project.

## Cloudflare resources required once

Create the following resources in the Cloudflare account and put their real D1 IDs in `wrangler.jsonc`:

- `ecommerce-iphone-development`
- `ecommerce-iphone-staging`
- `ecommerce-iphone`

Also create the R2 buckets and Queues named in `wrangler.jsonc`.

GitHub cannot safely invent these account-specific IDs. They must correspond to real resources in the target Cloudflare account.

## Provider secrets

Payment provider secrets are runtime secrets and should be configured in the corresponding Cloudflare Worker environment, not committed to Git:

- Wompi
- Stripe
- Mercado Pago
- PayPal
- Binance Pay
- any future provider adapters

The exact variables are documented in `.env.example` and `docs/payments.md`.

## Domains

Replace the placeholder `ALLOWED_ORIGIN` values in `wrangler.jsonc` with the real staging and production origins before enabling public traffic. Configure custom domains/routes in Cloudflare after the real domains are known.

## First deployment sequence

1. Create the three D1 databases.
2. Create the R2 buckets.
3. Create the Queues.
4. Replace the three D1 placeholder IDs in `wrangler.jsonc`.
5. Configure GitHub `staging` and `production` environment secrets.
6. Configure Cloudflare runtime secrets for payment providers.
7. Deploy `staging` manually from GitHub Actions.
8. Verify D1 migrations and application behavior.
9. Configure the production domain.
10. Push to `main` for the production deployment.

## Important limitation

The repository and workflows can be prepared from GitHub, but actual Cloudflare account provisioning, D1 IDs, custom domains and secrets require authorization to the target Cloudflare account. A successful GitHub commit is therefore not evidence that the application is already deployed in Cloudflare.
