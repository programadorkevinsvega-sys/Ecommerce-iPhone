# Foundation — Fase 1

## Actualización de foundation — 2026-09-21

La base mantiene strict TypeScript, exactOptionalPropertyTypes, DDD/Clean Architecture, frontend:data:check, foundation:check y architecture:check. El portal técnico fue ajustado para respetar los boundaries también en sus rutas de órdenes, dispositivos, perfil y evidencia.

El estado sigue siendo implementación + hardening. Ningún gate pendiente se convierte en PASS por el mero hecho de que una fuente compile; la evidencia de CI/CD y producción sigue siendo necesaria.

## Política de entornos

El proyecto opera con **un único entorno remoto permanente: producción**.

Los tests locales pueden usar D1 local/emulado, fixtures o mocks. Eso no crea un entorno operativo remoto adicional.

## Arquitectura

```text
HTTP / UI
   ↓
Presentation
   ↓
Application
   ↓
Domain
   ↑
Ports
   ↑
Infrastructure
   ↓
D1 / R2 / Queues / providers
```

Reglas:

- Domain no depende de Next.js, React, Cloudflare, D1, R2 ni SDKs externos.
- Application depende de Domain y ports.
- Infrastructure implementa adapters y acceso externo.
- Presentation transforma HTTP en comandos/queries y mapea resultados.
- Las rutas no ejecutan SQL/D1 directamente.
- La composición ocurre en composition roots.
- `architecture:check` mantiene el enforcement.
- `frontend:data:check` bloquea datasets de negocio falsos en producción.

## Toolchain actual

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`
- Wrangler `4.131.1` en la última build Cloudflare confirmada
- workerd compatibility date `2026-09-09`

## Producción

Worker:

`ecommerce-iphone`

Bindings:

```text
DB               -> ecommerce-iphone
MEDIA_BUCKET     -> ecommerce-iphone-media
EVENTS_QUEUE     -> ecommerce-iphone-events
API_RATE_LIMITER -> 120 requests / 60s
SENSITIVE_RATE_LIMITER -> 20 requests / 60s
APP_ENV          -> production
```

Health:

```text
GET /api/health/live  -> proceso disponible
GET /api/health/ready -> proceso + D1 disponible
```

Último Worker directamente verificado antes de los cambios recientes:

`f7d67832-8598-4f59-8db9-b538f543b3ef`

Los commits posteriores requieren un nuevo build/deploy directo de Cloudflare para certificarse.

## Reproducibilidad

```text
packageManager = pnpm@12.4.1
engine node     = 24.18.0
```

Contrato:

```bash
pnpm install --frozen-lockfile
pnpm build:cloudflare
```

## Seguridad base

- secrets fuera de Git;
- cookies seguras;
- validación de Origin;
- no-store en APIs sensibles;
- CSP y security headers;
- request-id;
- rate limiting;
- server-side authorization;
- ownership checks;
- idempotencia;
- health checks.

## Aceptación

1. código en `main`;
2. instalación reproducible;
3. foundation/architecture checks;
4. tests;
5. build Cloudflare;
6. migraciones D1 remotas;
7. deploy;
8. verificación de producción.

La documentación no convierte un gate pendiente en PASS.
