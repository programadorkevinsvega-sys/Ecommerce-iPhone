# Core Web Vitals: medición de campo y laboratorio

## Campo (RUM)

`apps/web/app/components/WebVitalsReporter.tsx` usa `useReportWebVitals` desde `next/web-vitals` para LCP, INP y CLS; no sustituye INP por FID ni por tiempos de carga. El cliente envía solo nombre permitido, ID de métrica, valor, ruta normalizada y clase de dispositivo aproximada.

El endpoint `POST /api/analytics/web-vitals` limita el cuerpo, valida allowlist y rango, normaliza el rating en servidor, aplica `SENSITIVE_RATE_LIMITER` y guarda en D1. La IP se utiliza únicamente como entrada de hash para la clave de limitación; no se persiste. Se descartan query strings, URLs completas, cookies, datos de formulario e identificadores de usuario. `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` controla muestreo y tiene valor predeterminado 0.1.

Los agregados p75, conteos por rating y tendencia semanal se consultan mediante `GET /api/admin/analytics/web-vitals?days=28`, que requiere sesión admin y permiso `audit:read`. Los períodos admitidos son 1–90 días; la tabla aplica deduplicación por ID y retención de 180 días, con purga programada por Worker.

## Umbrales

| Métrica | Buena | Necesita mejora | Deficiente |
|---|---:|---:|---:|
| LCP | <= 2.5 s | <= 4 s | > 4 s |
| INP | <= 200 ms | <= 500 ms | > 500 ms |
| CLS | <= 0.1 | <= 0.25 | > 0.25 |

LCP e INP se expresan en milisegundos y CLS no tiene unidad. El p75 debe interpretarse junto con el conteo del grupo; muestras pequeñas no son representativas.

## Laboratorio

El workflow `Storefront Lighthouse baseline` ejecuta tres recorridos Lighthouse por ruta contra el Worker local de OpenNext y publica los informes como artefacto CI. Rutas: home, catálogo, producto, carrito, checkout y login admin. La primera ejecución establece una baseline del runner; no se establecen presupuestos duros arbitrarios antes de inspeccionar estos resultados.

Lighthouse mide un entorno sintético; no produce ni se mezcla con los registros RUM de producción. Los resultados de laboratorio, datos sintéticos de E2E y datos de campo se deben informar por separado.

## Evidencia y configuración externa

El código de captura y agregación no demuestra todavía que exista muestra real en producción. Para recibir datos, Cloudflare debe desplegar la migración 0046 en su mecanismo normal de despliegue y mantener la variable pública `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` configurada en el build de producción. Después del despliegue, revisar que haya muestras y tamaño suficiente por grupo antes de interpretar p75. GitHub Actions no ejecuta migraciones D1 remotas.


`NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` is a Next.js **build-time** variable, with a default of `0.1` when unset. Set it in the Cloudflare Workers Build environment, not only in Wrangler runtime vars. The Lighthouse workflow sets it to `0` during its build so synthetic lab visits do not populate the D1 field dataset.
