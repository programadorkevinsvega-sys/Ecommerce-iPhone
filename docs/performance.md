# Performance cuantitativa — Storefront

## Baseline del build

El build de producción de Next.js/OpenNext genera estos tamaños de First Load JS:

| Ruta | First Load JS |
|---|---:|
| `/` | 106 kB |
| `/catalog` | 111 kB |
| `/iphone/[slug]` | 113 kB |
| `/cart` | 107 kB |
| `/checkout` | 107 kB |
| `/contacto` | 106 kB |

El bundle compartido entre las rutas es de aproximadamente **102 kB** y middleware de **34.6 kB**.

Estos valores sirven como baseline de bundle; no representan por sí solos TTFB, LCP ni bytes transferidos de una visita completa.

## Smoke cuantitativo de producción

El script `scripts/performance-smoke.mjs` mide contra una URL real:

- TTFB (`responseStart`)
- DOMContentLoaded
- tiempo de `load`
- bytes transferidos de recursos
- cantidad de recursos
- HTTP status

Rutas medidas:

```text
/
/catalog
/iphone/iphone-17-pro-max
/cart
/contacto
```

Umbrales iniciales del gate:

| Métrica | Umbral |
|---|---:|
| TTFB | <= 800 ms |
| DOMContentLoaded | <= 2500 ms |
| Load | <= 4000 ms |
| HTTP status | 2xx/3xx |

Los umbrales son **gates internos del proyecto**, no una afirmación de estándar universal.

## Ejecución

Localmente:

```bash
PERF_BASE_URL=https://TU-DOMINIO pnpm performance:production
```

También existe el workflow manual:

```text
GitHub Actions → Storefront performance → Run workflow
```

Introducir como `perf_base_url` la URL de producción.

## Criterio de Fase 2

La implementación de Fase 2 puede considerarse cuantitativamente instrumentada porque ya existe:

1. baseline de bundle obtenido del build real;
2. script reproducible de performance;
3. métricas explícitas;
4. umbrales explícitos;
5. workflow para medir producción.

La **medición de TTFB/DOMContentLoaded/load de producción debe ejecutarse desde GitHub Actions o una máquina con acceso de red al dominio**. Este entorno de trabajo no pudo resolver directamente el hostname de Cloudflare, por lo que no se inventan valores de latencia.


## Core Web Vitals de campo y laboratorio

La instrumentación RUM usa `useReportWebVitals` para LCP, INP y CLS y envía datos mínimos a `POST /api/analytics/web-vitals`. El endpoint valida el esquema, limita frecuencia y persiste en una tabla D1 dedicada con retención de 180 días. Los p75, distribuciones por rating y tendencias se consultan mediante un endpoint administrativo con permiso `audit:read`.

La evidencia de campo de producción solo estará disponible después de aplicar la migración 0046 mediante el despliegue de Cloudflare y recibir visitas reales. Ninguna medición de laboratorio o E2E debe etiquetarse como muestra RUM.

El workflow `Storefront Lighthouse baseline` ejecuta tres recorridos de laboratorio para cada ruta crítica y publica los informes como artefacto CI. La primera ejecución medirá la baseline del runner; no se fija un presupuesto duro arbitrario antes de revisar esos resultados.
