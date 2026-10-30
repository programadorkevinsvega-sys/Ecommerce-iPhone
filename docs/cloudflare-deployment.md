# Cloudflare deployment

## Entorno y recursos de producción

El dominio canónico es https://iphone.jnmtortas.com. El repositorio utiliza un único entorno remoto de producción en Cloudflare Workers; no existe un entorno remoto de staging configurado.

| Recurso | Nombre |
|---|---|
| Worker | `ecommerce-iphone` |
| D1 | `ecommerce-iphone` |
| R2 | `ecommerce-iphone-media` |
| Queue de eventos | `ecommerce-iphone-events` |

Toolchain fijada:

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.28`
- `@opennextjs/cloudflare 1.20.14`
- Wrangler `4.155.0`
- workerd compatibility date `2026-09-09`

## Separación CI/CD

**GitHub Actions es la autoridad para validar el código. Cloudflare Workers Builds solo compila y despliega.**

### GitHub Actions — CI antes del merge

El workflow `.github/workflows/payment-consistency.yml` se ejecuta en Pull Requests hacia `main` y en pushes a `main`. Ejecuta:

1. Instalación reproducible con `pnpm install --frozen-lockfile`.
2. Auditoría completa `pnpm audit` (producción, desarrollo y dependencias opcionales).
3. Prettier sobre los archivos cambiados.
4. Checks de foundations, datos de producción del frontend y arquitectura.
5. ESLint y TypeScript.
6. Suite completa Vitest.
7. Migraciones D1 **locales** y aisladas para las pruebas E2E.
8. Playwright contra Wrangler local usando `wrangler dev --local`.
9. Build de Cloudflare como comprobación de compilación, sin publicar.

No se entregan credenciales de Cloudflare ni de producción al job de CI de Pull Requests. El D1 de E2E se crea localmente y usa las migraciones del repositorio, incluida la semilla de catálogo existente.

### GitHub Actions — verificaciones posteriores al despliegue

`.github/workflows/production-verification.yml` ejecuta los smoke tests contra el dominio de producción desde GitHub Actions: salud, rate limiting, contenido público, SEO y límites de autorización de notificaciones.

Las pruebas profundas Phase 10.2–10.5 modifican temporalmente registros sintéticos de analytics/carrito y consultan D1 remoto; por seguridad son opt-in mediante `workflow_dispatch` con `run_deep_checks=true`. Requieren los GitHub Secrets `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`. Los scripts generan identificadores únicos y realizan cleanup. La validación administrativa autenticada es opt-in con `run_admin_checks=true` y requiere `ADMIN_RBAC_ALLOWED_EMAIL`, `ADMIN_RBAC_ALLOWED_PASSWORD`, `ADMIN_RBAC_DENIED_EMAIL` y `ADMIN_RBAC_DENIED_PASSWORD`.

El workflow `.github/workflows/performance.yml` ya ejecuta las pruebas de rendimiento con Playwright desde GitHub Actions, contra la URL productiva, en ejecución programada o manual.

### Cloudflare Workers Builds — build y deploy únicamente

Configuración esperada en **Workers & Pages → ecommerce-iphone → Settings → Build**:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Build command | `pnpm install --frozen-lockfile && pnpm build:cloudflare` |
| Deploy command | `pnpm cloudflare:deploy` |
| Root directory | vacío (raíz del monorepo) |

El build ejecuta únicamente `opennextjs-cloudflare build`. No ejecuta auditorías, linters, TypeScript, Vitest, Playwright ni smoke tests.

El deploy ejecuta únicamente:
```bash
pnpm db:migrate:production
pnpm db:verify:production
pnpm exec wrangler deploy --env=""
```

Las migraciones D1 y la publicación del Worker son operaciones de release, no pruebas de calidad. Todos los smoke tests y pruebas funcionales posteriores se ejecutan desde GitHub Actions.

### Previews de ramas no productivas

La rama de producción de Workers Builds debe ser `main`. Los builds de ramas distintas no deben ejecutar `wrangler deploy`.

Worker Previews pueden usar `pnpm exec wrangler preview`, pero **no se deben habilitar hasta configurar bindings de Preview aislados**: una base D1 diferente, un bucket R2 diferente, colas y cualquier otro recurso necesario. Este repositorio no dispone actualmente de un staging remoto; nunca se deben conectar previews a D1/R2/colas de producción.

Las pruebas E2E de Pull Requests se ejecutan localmente en GitHub Actions con `wrangler dev --local`, de modo que no necesitan un preview remoto ni tocan recursos productivos.

## Comandos versionados

- `pnpm build:cloudflare`: compila la aplicación Worker; no ejecuta tests ni despliega.
- `pnpm cloudflare:build`: alias build-only para Workers Builds.
- `pnpm cloudflare:deploy`: aplica/verifica migraciones remotas y publica el Worker. Se usa después del build de Cloudflare.
- `pnpm deploy:production`: compila y después ejecuta el deploy de producción.
- `pnpm db:migrate:local`: aplica migraciones a D1 local para E2E.
- `pnpm test`: Vitest.
- `pnpm test:e2e`: Playwright con Wrangler local.

## Bindings de producción

- `DB` → `ecommerce-iphone`
- `MEDIA_BUCKET` → `ecommerce-iphone-media`
- `EVENTS_QUEUE` → `ecommerce-iphone-events`
- `NOTIFICATIONS_QUEUE` → `ecommerce-iphone-notifications`
- `NOTIFICATIONS_DLQ_QUEUE` → `ecommerce-iphone-notifications-dlq`
- `API_RATE_LIMITER` → 120 requests / 60s
- `SENSITIVE_RATE_LIMITER` → 20 requests / 60s
- `APP_ENV` → `production`

## Secrets

Los secretos operativos deben permanecer fuera de GitHub y del código:

- `RESEND_API_KEY`
- `ADMIN_BOOTSTRAP_TOKEN`
- credenciales de Wompi, Stripe, Mercado Pago, PayPal y otros proveedores.
- tokens de operación de Cloudflare.

Configurar los secretos del Worker con `wrangler secret put <SECRET_NAME>` y los secretos que necesitan Actions mediante GitHub Repository Secrets, limitados a los workflows que los usan.

## Migraciones y rollback

Las migraciones de producción se aplican antes de publicar el Worker:

```bash
pnpm db:migrate:production
pnpm db:verify:production
```

Nunca edites una migración ya aplicada; agrega una nueva migración numerada.

El rollback se ejecuta manualmente mediante `.github/workflows/rollback.yml` y debe terminar con `pnpm verify:production` satisfactorio.
