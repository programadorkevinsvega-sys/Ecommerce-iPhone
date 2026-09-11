# Development

## Política de entornos

El proyecto mantiene **un único entorno remoto/operativo: producción**.

El desarrollo y las pruebas locales pueden usar Next.js, Vitest, Playwright y D1 local/emulado, pero no existe un entorno Cloudflare remoto de development o staging.

## Requirements

- Node.js 22+
- pnpm 10.15.0
- Cloudflare account for production Workers/D1/R2/Queues

## Local

```bash
pnpm install
pnpm dev
```

Para una ejecución local del Worker/OpenNext:

```bash
pnpm build:cloudflare
pnpm preview:cloudflare
```

## Quality checks

```bash
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

Estos comandos son gates de desarrollo y validación; la aceptación operativa se realiza contra producción.

## Producción

```bash
pnpm deploy:production
pnpm verify:production
```

El despliegue aplica primero las migraciones D1 remotas, genera el bundle OpenNext, publica el Worker y posteriormente puede ejecutarse la verificación de producción.

No usar comandos `--env staging` o `--env development`: esos entornos remotos ya no forman parte de la arquitectura operativa.

## D1 migrations

Local:

```bash
pnpm db:migrate:local
```

Producción:

```bash
pnpm db:migrate:production
```

Nunca modificar una migración ya aplicada en producción. Crear siempre una nueva migración versionada.

## Secrets

Usar Wrangler secrets o el secret store de la plataforma de despliegue. No poner secretos en `wrangler.jsonc`, código, `.env.example` ni Git.
