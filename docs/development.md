# Development

## Requirements

- Node.js 22+
- pnpm 10.15.0
- Cloudflare account for Workers/D1/R2/Queues workflows

## Local Next.js

```bash
pnpm install
pnpm dev
```

## Quality checks

```bash
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Cloudflare preview

```bash
pnpm build:cloudflare
pnpm exec wrangler dev --env development
```

The development environment uses separate Cloudflare resource names. Replace the development D1/R2/Queue placeholders in `wrangler.jsonc` with real resource identifiers when using remote development.

## Cloudflare environments

```bash
pnpm exec wrangler deploy --env staging
pnpm exec wrangler deploy --env production
```

Production and staging credentials must be supplied through Cloudflare/GitHub secrets. Never commit API keys or payment credentials.

## D1 migrations

Local:

```bash
pnpm exec wrangler d1 migrations apply DB --local
```

Remote environments should apply migrations deliberately during deployment/change management after the correct D1 binding is configured.

## Cloudflare secrets

Use Wrangler secrets or the deployment platform's secret store. Do not put secrets in `wrangler.jsonc`, `vars`, GitHub source, or `.env.example`.
