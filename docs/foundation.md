# Foundation — Fase 1

## Objetivo

Dejar la plataforma base reproducible, aislada por entorno, gobernada por límites arquitectónicos y preparada para desplegar de forma segura en Cloudflare.

## Estado

Foundation tiene implementada la base de arquitectura, environments, CI, seguridad HTTP, rate limiting distribuido y health checks. El cierre final depende de validar los recursos remotos de staging y ejecutar el pipeline completo en CI.

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

Despliegue:

```bash
pnpm deploy:staging
```

Staging debe estar provisionado en la misma cuenta Cloudflare o en la cuenta de validación autorizada y utilizar secretos independientes de producción.

### Production

El Worker de producción continúa usando la configuración principal de `wrangler.jsonc` para preservar el nombre y los bindings existentes.

Despliegue:

```bash
pnpm deploy:production
```

El script ejecuta las migraciones remotas de D1 antes del despliegue del Worker.

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

La clave combina el origen de cliente observado por Cloudflare con la ruta. En producción, esta capa debe complementarse con reglas WAF/edge para ataques volumétricos y no sustituye autenticación ni autorización.

Cloudflare documenta el Rate Limiting API como una protección de ejecución en Worker, de baja latencia y eventualmente consistente; por ello no debe utilizarse como contador financiero exacto ni como mecanismo de inventario. citeturn287224search0

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

La CI debe ejecutar, como mínimo:

```bash
pnpm install --frozen-lockfile
pnpm foundation:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:cloudflare
pnpm db:migrate:local
pnpm test:e2e
```

`foundation:check` verifica archivos, environments, bindings de rate limiting, endpoints de health, protección de secretos y contratos de CI.

## Migrations

Todas las migraciones de D1 viven versionadas en el repositorio.

Reglas:

- Nunca modificar silenciosamente una migración ya aplicada en producción.
- Las migraciones nuevas deben ser backward-compatible cuando sea necesario para despliegues progresivos.
- CI debe probar las migraciones contra D1 local.
- Staging debe recibir las migraciones antes de validar el release.
- Production debe aplicar migraciones como paso controlado del despliegue.

## Rollback

El procedimiento está documentado en `docs/rollback.md`.

Regla principal:

```text
Aplicación reversible
+
Migraciones backward-compatible
+
Rollback de Worker
```

No se debe hacer rollback de código cuando una migración destructiva ya impida que la versión anterior funcione. Las migraciones deben diseñarse con expansión/contracción cuando exista riesgo de incompatibilidad.

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

## Pendientes específicos que bloquean el 100%

1. Ejecutar y verificar el pipeline completo en CI después de estos cambios.
2. Provisionar y validar los recursos remotos de staging.
3. Probar `429`, liveness y readiness en un Worker desplegado.
4. Finalizar la extracción de SQL/lógica de negocio de `/api/admin/resources` y cualquier route equivalente.
5. Ejecutar un rollback controlado de staging para validar el procedimiento antes de producción.
