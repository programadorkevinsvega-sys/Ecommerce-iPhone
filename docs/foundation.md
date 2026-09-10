# Foundation — Fase 1

## Objetivo

Dejar la plataforma base reproducible, aislada por entorno, gobernada por límites arquitectónicos y preparada para desplegar de forma segura en Cloudflare.

## Estado

Foundation está implementada en su mayor parte. Esta fase debe considerarse cerrada únicamente cuando todos los invariantes de este documento pasen en CI y los recursos remotos de staging estén provisionados y verificados.

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

Worker/environment:

```text
ecommerce-iphone-development
```

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

Worker/environment:

```text
ecommerce-iphone-staging
```

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

Antes del primer despliegue remoto se debe confirmar que los recursos de staging están creados en la cuenta correcta y que las credenciales usadas por CI tienen permisos mínimos necesarios.

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
- `Cache-Control: no-store` para APIs

`apps/web/next.config.ts` mantiene los response headers de seguridad:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security`

## Observability baseline

El Worker mantiene Cloudflare Observability habilitado.

Toda API debe poder correlacionarse mediante:

```text
X-Request-Id
request_id
correlation_id
```

Los eventos de negocio deben conservar sus identificadores propios, por ejemplo `order_id`, `payment_id` o `event_id`.

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

`foundation:check` verifica archivos y contratos estructurales esenciales.

## Rate limiting

El dominio no debe implementar límites mediante estado global en memoria del proceso. La arquitectura debe consumir un port de rate limiting y delegar el enforcement distribuido al runtime/edge.

Las rutas prioritarias son:

```text
login
customer/session
checkout
payment webhooks
admin authentication
service request creation
```

El rate limiting debe ser adicional a autenticación/autorización, nunca un sustituto.

## Health checks

La aplicación dispone de un endpoint de health básico:

```text
GET /api/health
```

En una fase posterior debe diferenciarse entre:

```text
liveness
readiness
```

para que una dependencia crítica caída pueda provocar un estado de no-readiness sin indicar que el proceso está muerto.

## Migrations

Todas las migraciones de D1 viven versionadas en el repositorio.

Reglas:

- Nunca modificar silenciosamente una migración ya aplicada en producción.
- Las migraciones nuevas deben ser backward-compatible cuando sea necesario para despliegues progresivos.
- CI debe probar las migraciones contra D1 local.
- Production debe aplicar migraciones como paso controlado del despliegue.
- Staging debe recibir las migraciones antes de validar el release.

## Definition of Done — Foundation

La Fase 1 puede marcarse `COMPLETE` cuando:

- development, staging y production estén definidos y aislados.
- CI utilice instalación reproducible con lockfile congelado.
- `foundation:check` pase.
- `architecture:check` pase.
- lint/typecheck/unit/build/OpenNext/E2E pasen en CI.
- secrets no estén versionados.
- seguridad HTTP esté aplicada.
- migrations puedan reproducirse desde un estado limpio.
- staging haya sido desplegado y verificado.
- production tenga un procedimiento de rollback documentado.
- las rutas API permanezcan delgadas y la lógica de negocio se mantenga fuera de Presentation.

## Pendientes específicos que bloquean el 100%

1. Verificar en CI/runner real todos los comandos; esta auditoría no sustituye la ejecución.
2. Provisionar y validar los recursos remotos de staging.
3. Implementar/enchufar el rate limiter distribuido para las rutas sensibles.
4. Separar de forma completa liveness/readiness.
5. Seguir reduciendo SQL y lógica de negocio directa en API routes, especialmente en administración.
6. Definir y probar rollback de Worker + D1 antes de declarar producción completamente cerrada.
