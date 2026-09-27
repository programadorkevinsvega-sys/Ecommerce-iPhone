# Auditoría Fase 08 — CMS + Marketing + Reviews

## 08.1 — Auditoría de estado existente

**Fecha:** 2026-09-25 UTC  
**Rama:** `main`  
**Objetivo:** inspeccionar el código existente antes de implementar Fase 08.

## 08.2 — Implementación completa

Estado de implementación: 🟢 **completa**.

Implementado: CMS administrable, blog, categorías, FAQs, landing pages, banners, destacados, publicación programada, marketing, promociones, cupones, campañas, aplicabilidad por producto/categoría, checkout server-side, reviews verificadas, moderación, reportes, auditoría y RBAC. La compilación de producción reciente completó TypeScript, generación de 118 páginas y optimización de rutas.

## 08.3 — Hardening, frontend público y certificación

Estado de implementación: 🟢 **completa en código**. Estado de certificación: 🟡 **pendiente de evidencia del release final**.

### Hardening aplicado

- La edición administrativa de cupones ya no sobrescribe el contador real de redenciones `used_count`; el contador solo cambia mediante consumo transaccional.
- Checkout acepta explícitamente `couponCode` y rechaza el uso simultáneo de promoción y cupón.
- La creación de reviews mantiene compra verificada y utiliza inserción condicional server-side para evitar carreras.
- Las respuestas públicas de reviews ya no exponen `customerId` ni `orderId`.
- La moderación administrativa valida la transición contra el estado persistido y actualiza con condición de estado, evitando transiciones concurrentes ciegas.
- Los reportes validan que la review exista, evitan reportes repetidos por cliente/review y aplican un límite persistente de cinco reportes por cliente/hora.
- La API de reportes valida explícitamente sus estados y diferencia validación, conflicto, ausencia y rate limit.
- El repositorio de reportes usa mapeo tipado de filas D1.
- CMS incorpora validaciones de ventanas editoriales, banners, destacados, IDs, prioridades, URLs y estados de publicación.
- Se añadió `migrations/0036_phase08_review_hardening.sql` con reportes y eventos de moderación durables, claves foráneas, índices, restricciones y unicidad cliente/review.
- Se añadieron pruebas del dominio de moderación, concurrencia de redención de cupones, concurrencia de moderación/reportes e invariantes RBAC.
- El storefront público incorpora banners, destacados y FAQs desde D1, además de navegación pública a Blog y Preguntas frecuentes.
- Las APIs públicas de CMS/marketing y las rutas editoriales fueron llevadas a la capa Application/Infrastructure para conservar las fronteras de Clean Architecture.
- Se añadió una verificación remota de D1 para la migración 0036, incluyendo registro de migración, tablas y claves foráneas, ejecutada como gate previo al deploy.
- Se corrigió la persistencia de `used_count` para que una edición administrativa nunca lo reinicie.

### Gates de certificación pendientes

- [ ] Suite completa de tests.
- [ ] Lint y architecture checks.
- [ ] Migraciones D1 remotas aplicadas y verificadas.
- [ ] Verificación de 0036 en producción.
- [ ] Pruebas reales CMS público/admin.
- [ ] Pruebas reales de cupones, promociones, campañas y checkout.
- [ ] Pruebas concurrentes de redención y reviews.
- [ ] Pruebas RBAC/IDOR.
- [ ] Build Cloudflare sobre el commit final.
- [ ] Deploy real.
- [ ] `verify:production` exitoso.
- [ ] Verificación funcional sobre `https://iphone.jnmtortas.com`.
- [ ] Actualización y cierre del Issue #8 únicamente con evidencia de release.

**Regla:** 08.3 no se considera certificada por compilar. No se utilizarán mocks, fake providers, datos de ejemplo, simulaciones ni placeholders.

## 08.4 — Certificación productiva y hardening final

Estado de código: 🟢 **implementación completa**. Certificación productiva: 🟡 **pendiente de evidencia del pipeline/runtime**.

Se incorporó un gate productivo específico en `scripts/verify-phase08-production.mjs` que verifica contra la URL real:

- storefront y superficies públicas de CMS;
- APIs públicas de blog, categorías, FAQs, banners, destacados y landing;
- respuestas 400/404 esperadas para entradas inválidas/no existentes;
- políticas públicas de caché de las APIs de contenido;
- aislamiento de las APIs administrativas sin sesión.

El workflow de producción ejecuta este gate después del deploy, junto con `verify:production`, y mantiene la verificación remota de la migración 0036 antes del deploy.

Durante la preparación de 08.4 se detectó y corrigió un defecto del workflow `.github/workflows/deploy.yml`: el paso de verificación D1 contenía secuencias literales de salto de línea dentro del YAML. La corrección se realizó sin cambiar dependencias ni desactivar ningún gate.

### Criterio de cierre 08.4

- [ ] install reproducible y lockfile íntegro;
- [ ] audit de dependencias;
- [ ] foundation/architecture/frontend-data checks;
- [ ] format/lint/typecheck;
- [ ] suite de tests;
- [ ] build Cloudflare;
- [ ] migraciones D1 remotas;
- [ ] verificación D1 0036;
- [ ] deploy real;
- [ ] `verify:production`;
- [ ] smoke 08.4 real;
- [ ] performance gate;
- [ ] evidencia final y cierre del Issue #8.

No se aceptan mocks, fake providers, datos de ejemplo, simulaciones ni placeholders como sustitutos de estas verificaciones.

**Evidencia CI actual:** los runs 1490 y 1491 de `Cloudflare Production Deploy` terminan casi inmediatamente con `failure` y el job no expone steps/logs mediante la integración disponible. El run 1491 fue reintentado y volvió a fallar antes de exponer ejecución. No se atribuye ese fallo al código de Fase 08 sin evidencia del job.

## Regla global de Fase 08

Lo existente se reutiliza únicamente donde cumple requisitos de producción. Las capacidades pasan por Domain/Application/Ports/Infrastructure y las superficies administrativas permanecen protegidas server-side por RBAC.
