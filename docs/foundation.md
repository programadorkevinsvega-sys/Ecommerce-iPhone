# Foundation — Fase 1

## Política de entornos

El proyecto opera con **un único entorno remoto permanente: producción**.

Los tests pueden usar D1 local/emulado, fixtures o mocks. Eso no crea un entorno operativo adicional. No se usa staging remoto para aceptar releases.

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

Reglas obligatorias:

- Domain no depende de Next.js, React, Cloudflare, D1, R2 ni SDKs externos.
- Application depende de Domain y ports, no de implementaciones concretas.
- Infrastructure implementa adapters y acceso externo.
- Presentation transforma HTTP en comandos/queries y mapea resultados.
- Las rutas no ejecutan SQL/D1 directamente.
- La composición de infraestructura ocurre en composition roots.
- `scripts/check-architecture.mjs` es el enforcement automático de estos límites.

## Build

Versiones base conocidas del build productivo del 2026-09-11:

- pnpm `10.15.0`;
- Node.js `24.18.0`;
- Next.js `15.5.25`;
- `@opennextjs/cloudflare 1.20.6`.

El build produjo correctamente el bundle OpenNext, completó lint/typecheck, generó 25/25 páginas estáticas y publicó el Worker.

## Producción

El Worker usa únicamente la configuración principal de `wrangler.jsonc`:

```text
Worker: ecommerce-iphone
D1: ecommerce-iphone
R2: ecommerce-iphone-media
Queue: ecommerce-iphone-events
APP_ENV=production
```

Rate limiting:

```text
API_RATE_LIMITER       120 requests / 60s
SENSITIVE_RATE_LIMITER  20 requests / 60s
```

Health:

```text
GET /api/health/live  -> proceso disponible
GET /api/health/ready -> proceso + D1 disponible
```

## Migraciones

Las migraciones son versionadas y nunca se reescriben después de aplicarse en producción.

Aplicación remota:

```bash
pnpm db:migrate:production
```

Durante el deploy del 2026-09-11 quedaron aplicadas `0012_inventory_reservation_cleanup.sql` y `0013_inventory_reservation_order_link.sql`. La migración `0014_order_item_variant_link.sql` está versionada y debe quedar aplicada en el siguiente deploy que contenga esta línea de código.

## Reproducibilidad

`package.json` fija pnpm `10.15.0`, pero **no se declara reproducibilidad total mientras `pnpm-lock.yaml` no esté versionado y el build no use `pnpm install --frozen-lockfile`**.

Este es un gate real de cierre, no una condición que pueda marcarse como completada solo por documentación.

## Seguridad base

- secrets fuera de Git;
- cookies de sesión seguras en producción;
- validación de `Origin` para mutaciones;
- `Cache-Control: no-store` en APIs;
- headers de seguridad;
- request-id;
- rate limiting;
- autorización server-side;
- protección de recursos por propietario;
- idempotencia para checkout;
- health checks separados.

## Criterio de aceptación

La aceptación final del proyecto se basa en:

1. código en `main`;
2. checks locales reproducibles;
3. build Cloudflare real;
4. migraciones D1 remotas correctas;
5. deploy real;
6. verificación de producción;
7. pruebas funcionales y de seguridad correspondientes.

**GitHub Actions no es el criterio de aceptación del proyecto.**
