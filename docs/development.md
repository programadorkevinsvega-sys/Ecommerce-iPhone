# Development

## Actualización de reproducibilidad — 2026-09-21

El contrato de release mantiene pnpm 12.4.1 y Node 24.18.0 tanto para el despliegue como para los workflows de verificación y performance. El endpoint canónico de producción es https://iphone.jnmtortas.com.

La corrección del typecheck de StoreHeader/TechnicianHeader está en fuente y no se desactiva exactOptionalPropertyTypes. El release queda certificado únicamente después de ejecutar los gates estructurales, tests, build Cloudflare, deploy y verify contra producción.

## Política de entornos

El proyecto mantiene **un único entorno remoto/operativo: producción**.

Desarrollo y pruebas pueden usar Next.js, Vitest, Playwright y D1 local/emulado, pero no existe un entorno Cloudflare remoto de development/staging.

## Toolchain

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`

## Local

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Worker/OpenNext local:

```bash
pnpm build:cloudflare
pnpm preview:cloudflare
```

## Quality checks

```bash
pnpm frontend:data:check
pnpm architecture:check
pnpm foundation:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm test:e2e
```

## Production

```bash
pnpm deploy:production
pnpm verify:production
```

El deploy aplica migraciones D1 remotas, construye OpenNext, publica el Worker y ejecuta la verificación.

## D1 migrations

```bash
pnpm db:migrate:local
pnpm db:migrate:production
```

Nunca modificar una migración ya aplicada en producción.

## Secrets

Secrets únicamente mediante Wrangler/secret store. Nunca en código, Git, `.env.example` ni documentación.

## Release rule

Un commit posterior a la última versión productiva verificada no se considera certificado hasta que complete build, deploy y verificación directos contra producción.
