# Foundation — Fase 1

## Objetivo

Dejar la plataforma base reproducible, aislada por entorno, gobernada por límites arquitectónicos y preparada para desplegar de forma segura en Cloudflare.

## Estado

La implementación de Foundation está cerrada a nivel de código y automatización operacional. Production ya fue desplegado correctamente mediante Cloudflare Workers Builds y el repositorio ahora contiene verificaciones automáticas de liveness, readiness, request-id y rate limiting, además de workflows manuales para staging y rollback controlado. La condición final para marcar `COMPLETE` es ejecutar con credenciales Cloudflare autorizadas la validación remota de staging y un rollback controlado, conservando la evidencia en CI/CD.

## Arquitectura

```text
HTTP / UI
   ↓
Presentation
   ↓
Application
   ↓
Domain
   ↓
Ports
   ↑
Infrastructure
   ↓
D1 / R2 / Queues / providers
```

Reglas obligatorias:

- Domain no importa Next.js, React, Cloudflare, D1, R2, Resend, clientes HTTP ni SDKs de proveedores.
- Application depende de Domain y ports, no de implementaciones concretas.
- Infrastructure implementa adapters y acceso a servicios externos.
- Presentation transforma HTTP en comandos/queries y mapea resultados.
- Un bounded context no importa internals de otro contexto.

El enforcement está centralizado en `scripts/check-architecture.mjs` y se ejecuta en CI.

## Entornos

### Development

Recursos aislados:

```text
D1: ecommerce-iphone-development
R2: ecommerce-iphone-media-development
Queue: ecommerce-iphone-events-development
```

Uso local:

```bash
pnpm db:migrate:local
pnpm dev
pnpm preview:cloudflare
```

Uso Cloudflare:

```bash
pnpm exec wrangler dev --env development
```

### Staging

Recursos aislados:

```text
D1: ecommerce-iphone-staging
R2: ecommerce-iphone-media-staging
Queue: ecommerce-iphone-events-staging
```

El workflow `.github/workflows/staging.yml` valida la existencia de D1/R2/Queue, aplica migraciones, despliega el Worker y ejecuta las pruebas de runtime. Requiere las credenciales Cloudflare de la cuenta autorizada y una URL pública del Worker de staging.

### Production

El Worker de producción usa la configuración principal de `wrangler.jsonc` para preservar el nombre y bindings existentes.

Cloudflare Workers Builds realiza el despliegue automático desde `main` mediante:

```bash
pnpm install --no-frozen-lockfile && pnpm build:cloudflare
pnpm deploy:cloudflare
```

El build `#4c5490da` confirmó un despliegue correcto del Worker, sus bindings, triggers, Queue producer/consumer y assets.

## Secrets

Nunca almacenar secretos en Git.

Archivos locales ignorados:

```text
.env
.env.*
.dev.vars
.dev.vars.*
```

El repositorio solo contiene nombres/documentación mediante `.env.example`.

Los secretos remotos deben administrarse mediante Wrangler/Cloudflare o el secret store de CI/CD.

## HTTP security baseline

`apps/web/middleware.ts` aplica la protección base para `/api/*`:

- validación de `Origin` para operaciones mutables y preflight
- CORS explícito para el mismo origen
- `Access-Control-Allow-Credentials` únicamente para el origen permitido
- `X-Request-Id` validado o generado
- `Cache-Control: no-store`

`apps/web/next.config.ts` mantiene los response headers de seguridad:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security`

## Rate limiting

La protección distribuida se ejecuta en el Worker mediante los bindings nativos de Cloudflare Rate Limiting.

Se definen dos perfiles:

```text
API_RATE_LIMITER
    120 requests / 60s

SENSITIVE_RATE_LIMITER
     20 requests / 60s
```

Las rutas sensibles incluyen, entre otras:

```text
/api/checkout
/api/customer
/api/admin
/api/services
/api/auth
/api/payment
```

El verificador `scripts/verify-production.mjs` comprueba el límite sensible mediante 21 solicitudes a una ruta no destructiva y exige observar `429`, `Retry-After` y `X-Request-Id`. Cloudflare documenta este mecanismo como eventualmente consistente y no apto para contabilidad exacta. citeturn951125search1

## Observability baseline

El Worker mantiene Cloudflare Observability habilitado.

Las respuestas API reciben `X-Request-Id` y la aplicación debe conservar ese identificador al generar logs/eventos.

Los eventos de negocio deben conservar sus identificadores propios, por ejemplo:

```text
request_id
correlation_id
event_id
order_id
payment_id
customer_id
```

## Health checks

El Worker expone dos estados distintos:

```text
GET /api/health/live
GET /api/health/ready
```

### Liveness

Confirma que el proceso/Worker responde. No comprueba dependencias externas.

### Readiness

Comprueba D1 mediante una consulta mínima:

```sql
SELECT 1 AS ok
```

Si D1 no está disponible, devuelve `503` para que el runtime pueda retirar la instancia del tráfico sin confundir una caída de dependencia con un proceso muerto.

## Quality gates

La CI ejecuta, como mínimo:

```bash
pnpm install --frozen-lockfile
pnpm foundation:check
pnpm architecture:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm db:migrate:local
pnpm test:e2e
```

Además, `.github/workflows/production-verification.yml` ejecuta `pnpm verify:production` contra el Worker público de producción después de cada push a `main`.

`foundation:check` verifica archivos, environments, bindings de rate limiting, endpoints de health, protección de secretos, workflow operacional y ausencia de SQL directo en la ruta administrativa auditada.

## Migrations

Todas las migraciones de D1 viven versionadas en el repositorio.

Reglas:

- Nunca modificar silenciosamente una migración ya aplicada en producción.
- Las migraciones nuevas deben ser backward-compatible cuando sea necesario para despliegues progresivos.
- CI debe probar las migraciones contra D1 local.
- Staging debe recibir las migraciones antes de validar el release.
- Production debe aplicar migraciones como paso controlado del despliegue.

## Rollback

El procedimiento está documentado en `docs/rollback.md` y automatizado de forma controlada mediante `.github/workflows/rollback.yml`.

El workflow requiere explícitamente el `version_id` que debe activarse y, después del rollback, ejecuta la misma verificación de health y rate limiting.

Cloudflare soporta rollback de una versión publicada mediante `wrangler rollback`; el rollback crea inmediatamente un nuevo deployment con la versión seleccionada y no modifica los recursos vinculados. citeturn951125search0turn951125search2

## Definition of Done — Foundation

La Fase 1 puede marcarse `COMPLETE` cuando:

- development, staging y production estén definidos y aislados.
- CI utilice instalación reproducible con lockfile congelado.
- `foundation:check` pase.
- `architecture:check` pase.
- lint/typecheck/unit/build/OpenNext/E2E pasen en CI.
- secrets no estén versionados.
- seguridad HTTP esté aplicada.
- rate limiting distribuido esté activo para rutas sensibles.
- liveness/readiness estén separados.
- migrations puedan reproducirse desde un estado limpio.
- staging haya sido desplegado y verificado.
- production tenga un procedimiento de rollback probado.
- las rutas API permanezcan delgadas y la lógica de negocio se mantenga fuera de Presentation.

## Evidencia operativa

### Ya verificado

- Cloudflare Workers Build `#4c5490da`: compilación y despliegue de producción correctos.
- Worker con D1, R2, Queue producer/consumer, cron y rate-limit bindings activos.
- `deploy:cloudflare` operativo.
- Verificación automática de producción incorporada al repositorio.

### Pendiente de ejecución con acceso Cloudflare

1. Ejecutar `.github/workflows/staging.yml` con la URL pública de staging y credenciales Cloudflare.
2. Ejecutar `.github/workflows/rollback.yml` sobre un deployment de staging/entorno de validación y conservar la evidencia del rollback.

Hasta completar esas dos pruebas externas, Foundation debe considerarse `IMPLEMENTED / PENDING OPERATIONAL SIGN-OFF`, no `COMPLETE`.
