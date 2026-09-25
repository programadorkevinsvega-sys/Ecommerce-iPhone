# Auditoría Fase 08 — CMS + Marketing + Reviews

## 08.1 — Auditoría de estado existente

**Fecha:** 2026-09-25 UTC  
**Rama:** `main`  
**Objetivo:** inspeccionar el código existente antes de implementar Fase 08, evitando reconstrucción innecesaria y evitando declarar como completo lo que solo existe de forma parcial.

## Resultado ejecutivo

Fase 08 **no está implementada como épica completa**. El repositorio ya contiene piezas funcionales construidas durante Fase 06/Storefront:

- CMS administrativo básico.
- Promociones administrativas básicas.
- Reviews públicas y moderación administrativa.

Estas piezas deben **evolucionarse**, no reemplazarse sin necesidad.

## Matriz 08.1

| Área | Estado observado | Fase 08 requerida | Acción |
|---|---|---|---|
| CMS páginas | 🟢 Parcial funcional | Páginas completas | Evolucionar |
| Blog | 🔴 No encontrado como ruta pública dedicada | Blog + categorías | Implementar |
| Banners | 🟡 Existe editor específico de home-carousel | Banners programables/generalizados | Evolucionar |
| FAQs | 🔴 No existe superficie CMS pública dedicada | FAQs | Implementar |
| Landing pages | 🔴 No encontrada | Landing pages | Implementar |
| Contenido destacado | 🟡 Existe soporte parcial de contenido/home | Gestión general | Evolucionar |
| Promociones | 🟢 Parcial funcional | Promociones completas | Endurecer/evolucionar |
| Cupones | 🟡 Código de promoción básico existe | Uso por cliente, productos/categorías, límites y reglas | Implementar |
| Campañas | 🔴 No existe bounded context dedicado | Campañas | Implementar |
| Productos destacados | 🟡 Soporte parcial relacionado con CMS/home | Gestión explícita | Implementar |
| Reviews | 🟢 Parcial funcional | Flujo completo | Endurecer/evolucionar |
| Compra verificada | 🟢 Existe comprobación contra orden DELIVERED | Mantener y ampliar pruebas | Validar |
| Moderación | 🟢 Existe | Moderación completa | Endurecer |
| Respuesta admin | 🟢 Existe | Respuesta auditada | Validar |
| Reportes | 🔴 No encontrado | Reporte de reviews | Implementar |
| Auditoría | 🟢 Integrada en comandos administrativos existentes | Todos los eventos de marketing | Extender |
| RBAC | 🟢 Integrado en APIs admin existentes | Matriz completa por acción | Validar |
| Tests | 🟡 Existen tests puntuales | Cobertura de dominio/API/concurrencia | Ampliar |

## Evidencia de código existente

### CMS

Existe:

- `modules/cms/application/AdminCms.ts`
- `modules/cms/infrastructure/D1CmsRepository.ts`
- `apps/web/app/admin/cms/page.tsx`
- `apps/web/app/api/admin/cms/route.ts`
- tabla D1 `cms_pages`.

El flujo actual permite listar, crear/editar páginas, definir SEO básico y activar/desactivar contenido. La validación incluye slug, título, tamaño de contenido y canonical HTTPS. También existe validación específica para el contenido del home carousel.

**Gap:** esto no representa todavía blog, categorías de blog, FAQs, landing pages, banners generalizados, programación editorial ni un modelo completo de contenido publicable.

### Marketing / promociones

Existe:

- `modules/promotions/application/AdminPromotions.ts`
- `modules/promotions/infrastructure/D1PromotionRepository.ts`
- `apps/web/app/admin/promotions/page.tsx`
- `apps/web/app/api/admin/promotions/route.ts`
- tabla D1 `promotions`.

Actualmente se soportan código, nombre, porcentaje/valor fijo, mínimo de subtotal, máximo de usos, ventana temporal y activación.

**Gaps:** el Issue #8 exige uso máximo por cliente, aplicabilidad por producto/categoría, cupones como capacidad explícita, campañas, banners programables y productos destacados. También debe revisarse la atomicidad del consumo y la aplicación real de reglas en checkout.

### Reviews

Existe:

- `modules/reviews/domain/Review.ts`
- `modules/reviews/application/ReviewRepository.ts`
- `modules/reviews/application/AdminReviews.ts`
- `modules/reviews/infrastructure/D1ReviewRepository.ts`
- `modules/reviews/infrastructure/D1AdminReviewRepository.ts`
- `apps/web/app/api/products/[id]/reviews/route.ts`
- `apps/web/app/api/admin/reviews/route.ts`
- `apps/web/app/admin/reviews/page.tsx`
- tabla D1 `product_reviews`.

El flujo público exige sesión customer, comprueba que la orden esté en estado `DELIVERED`, comprueba que exista el producto en la orden y evita una segunda review para la misma combinación cliente/producto/orden. Las reviews se crean `PENDING` y el administrador puede aprobar/rechazar y registrar una respuesta.

**Gaps:** reportes de reviews, pruebas exhaustivas de ownership/IDOR, reglas de transición de moderación, auditoría completa, límites/rate limiting específicos, pruebas de concurrencia y revisión de la exposición de PII en el panel.

## Hallazgos técnicos que deben corregirse al entrar en implementación

1. `apps/web/app/api/admin/promotions/route.ts` utiliza `any` al leer el JSON. Debe reemplazarse por parsing/validación tipada sin desactivar strictness.
2. El modelo actual de `promotions` no contiene relaciones de aplicabilidad por producto/categoría ni uso por cliente.
3. CMS está centrado en `cms_pages`; el Issue #8 requiere un modelo de contenido más amplio.
4. No se debe duplicar `product_reviews` ni `promotions`; las nuevas capacidades deben evolucionar el esquema mediante migraciones incrementales.
5. La existencia de UI administrativa no equivale a funcionalidad completa: cada mutación debe seguir pasando por Application + ports + Infrastructure y tener autorización/auditoría server-side.
6. No deben introducirse datos demo, mocks, proveedores fake, fixtures de negocio ni implementaciones temporales.

## Criterio de salida de 08.1

- [x] Se inspeccionó el roadmap oficial y el Issue #8.
- [x] Se inspeccionaron las superficies existentes de CMS.
- [x] Se inspeccionaron promociones.
- [x] Se inspeccionaron reviews.
- [x] Se identificaron rutas y repositorios existentes.
- [x] Se identificaron capacidades reutilizables.
- [x] Se identificaron gaps funcionales.
- [x] Se identificó un bypass de tipado `any` que debe corregirse.
- [x] Se definió el orden de implementación siguiente.

## 08.2 — Modelo de dominio, persistencia y contratos implementados\n\nEstado: 🟡 implementación backend inicial realizada; falta integración completa con storefront/admin para considerar el sub-bloque cerrado.\n\nImplementado en `main`:\n- Migración incremental `0035_phase08_cms_marketing_reviews.sql` que preserva/evoluciona `cms_pages`, `promotions` y `product_reviews` y añade blog/categorías, FAQs, landing pages, banners, destacados, campañas, aplicabilidad producto/categoría, cupones, redenciones, reportes y eventos de moderación.\n- Contratos y tipos DDD para CMS en `modules/cms/domain/Content.ts` y `modules/cms/application/CmsPorts.ts`.\n- Modelo de marketing en `modules/promotions/domain/Marketing.ts` y ports en `MarketingPorts.ts`.\n- Administración de cupones con validación server-side y redención atómica en `AdminCoupons` + `D1CouponRepository`.\n- API administrativa real `/api/admin/coupons`, protegida por `requireAdmin(PERMISSIONS.promotionsWrite)`.\n- Reportes de reviews y transiciones de moderación condicionadas al estado actual, con persistencia atómica y auditoría.\n- La identidad de creación de reviews públicas ahora proviene de la sesión server-side mediante `currentCustomerId()`, no de un cookie de identidad manipulable.\n- Tests de invariantes de marketing y moderación.\n\nPendiente para cerrar 08.2/continuar 08.x:\n- Integrar cupones/aplicabilidad en el checkout transaccional sin duplicar lógica de descuentos.\n- Completar CRUD administrativo de todo el CMS/marketing y APIs públicas de publicación.\n- Completar resolución de banners/destacados/campañas y programación editorial.\n- Completar UI admin y storefront público.\n- Tests de integración/concurrencia sobre D1 y checkout, build y verificación productiva.\n\n## Siguiente bloque — 08.3

1. Modelo de dominio y contratos CMS: páginas, blog, categorías, FAQs, landing pages, banners y contenido destacado.
2. Modelo de marketing: cupones, reglas, aplicabilidad, campañas y productos destacados.
3. Modelo de reviews: reportes y endurecimiento del ciclo de moderación.
4. Migraciones D1 incrementales, preservando `cms_pages`, `promotions` y `product_reviews`.
5. Ports/Application/Infrastructure sin acceso directo desde Presentation.
6. Validación server-side, RBAC, auditoría, idempotencia y concurrencia desde el primer incremento.
7. Tests antes de considerar cada sub-bloque cerrado.

**Regla de la Fase 08:** lo existente se reutiliza únicamente donde cumpla los requisitos de producción; lo incompleto se endurece y amplía. No se utilizarán mocks, fake providers, datos de ejemplo ni placeholders.
