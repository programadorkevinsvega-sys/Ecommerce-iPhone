# Ecommerce iPhone — Roadmap

## Actualización viva — 2026-09-21

El hardening actual del bounded context technicians incluye: aislamiento de identidad respecto de admin_users, ownership server-side de órdenes, sesiones persistidas con token hash, lockout y auditoría, composición limpia de Application/Infrastructure y un portal técnico con navegación, formularios, loading/error/empty/success states y responsive coherentes con el lenguaje visual existente.

La corrección de exactOptionalPropertyTypes en StoreHeader y TechnicianHeader ya está presente en fuente. El estado de estas mejoras sigue siendo implementado/hardened, no certificado, hasta que el release pase todos los gates y exista evidencia directa de deploy/verificación productiva. La prueba autenticada del portal no se sustituye con una cuenta o dataset ficticio.

> Roadmap oficial de desarrollo. El proyecto se ejecutará por fases, manteniendo una arquitectura de monolito modular preparada para extraer bounded contexts como servicios independientes en el futuro.

## Principios de arquitectura

- DDD + Clean Architecture.
- Monolito modular con bounded contexts claramente aislados.
- Separación estricta entre Domain, Application, Infrastructure y Presentation.
- El dominio no depende de Cloudflare, proveedores de pago, Resend ni SDKs externos.
- Interfaces/ports para infraestructura y proveedores externos.
- TypeScript estricto y contratos tipados.
- Cada fase debe dejar el sistema en un estado funcional y verificable.
- Las tareas grandes se descompondrán posteriormente en sub-Issues técnicos.

## Orden de ejecución

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10
                      ↘ reparación / técnicos (transversal)
```

Las reparaciones y técnicos atraviesan Services, Admin/RBAC, Commerce y Notifications. El detalle operativo vive en `docs/PLAN-PLATAFORMA-REPARACIONES.md`.

---

## Fase 01 — Foundation

**Issue:** #1 — Foundation: Monolito modular + DDD + Clean Architecture + Cloudflare

### Objetivo
Establecer la base técnica del e-commerce como monolito modular, preparado para evolucionar posteriormente hacia servicios independientes sin reescritura del dominio.

### Alcance

- Monorepo modular.
- DDD + Clean Architecture.
- Bounded contexts.
- Cloudflare Workers.
- Cloudflare D1.
- Cloudflare R2.
- Cloudflare Queues.
- DNS/CDN/SSL/WAF.
- Development / staging / production.
- TypeScript estricto.
- ESLint, formatter y typecheck.
- Unit, integration y E2E testing base.
- GitHub Actions CI/CD.
- Seguridad inicial.
- Documentación de arquitectura.

### Criterio de salida
El proyecto debe poder clonarse, configurarse y ejecutarse desde cero, con las fronteras modulares establecidas y verificables.

---

## Fase 02 — Storefront Premium

**Issue:** #2 — Storefront premium: Home, catálogo, búsqueda y producto

### Objetivo
Construir una experiencia pública premium, mobile-first, accesible, rápida y orientada a conversión.

### Alcance

- Home.
- Catálogo.
- Categorías.
- Marcas.
- Búsqueda.
- Filtros y paginación.
- Página de producto.
- Variantes.
- Stock y precios.
- Reviews.
- FAQ.
- Productos relacionados.
- Servicios.
- Contacto.
- Responsive.
- Loading / empty / error states.
- Optimización de imágenes.
- URLs limpias y estables.
- Performance y accesibilidad.

### Criterio de salida
Storefront funcional y conectado a datos reales, sin mocks como fuente definitiva de productos.

---

## Fase 03 — Commerce Core

**Issue:** #3 — Commerce Core: clientes, carrito, checkout, pedidos e inventario

### Objetivo
Implementar el núcleo transaccional del e-commerce.

### Alcance

- Customers.
- Cart.
- Checkout.
- Orders.
- Inventory.
- Shipping base.
- Reservas de stock con expiración.
- Prevención de overselling.
- Recalculo server-side de precios.
- Máquina de estados de pedidos.
- Validación de transiciones.
- Persistencia segura.
- Tests de concurrencia.

### Regla crítica
El frontend nunca podrá marcar un pedido como pagado ni alterar unilateralmente precio o stock.

---

## Fase 04 — Payments

**Issue:** #4 — Payments: Wompi, Stripe, Mercado Pago, PayPal y Binance Pay

### Objetivo
Crear un dominio de pagos desacoplado de proveedores mediante adapters.

### Arquitectura

```text
PaymentProvider
├── WompiProvider
├── StripeProvider
├── MercadoPagoProvider
├── PayPalProvider
└── BinancePayProvider
```

### Alcance

- Create payment.
- Get status.
- Authorize/capture cuando aplique.
- Refund.
- Reconciliación.
- Webhooks.
- Idempotencia.
- Verificación de firmas.
- Validación de importe.
- Validación de moneda.
- Validación de referencia.
- Sandbox/testing.
- Feature flags por proveedor.

### Proveedores

- Wompi.
- Stripe.
- Mercado Pago.
- PayPal.
- Binance Pay cuando la operación sea elegible.

### Regla crítica
Los redirects del navegador nunca serán la fuente definitiva para confirmar un pago. La confirmación deberá basarse en mecanismos server-side y webhooks verificados.

---

## Fase 05 — Servicios

**Issue:** #5 — Servicios: desbloqueo legítimo, diagnóstico, reparación y solicitudes

### Objetivo
Crear el sistema de servicios técnicos y solicitudes de atención.

### Alcance

- Desbloqueo de operador cuando legalmente/autorizadamente proceda.
- Diagnóstico.
- Reparación.
- Configuración.
- Servicios configurables desde administración.
- Cotización.
- Pago.
- Procesamiento.
- Estados de solicitud.
- Panel administrativo.
- Notificaciones.
- Auditoría.

### Seguridad de dispositivos

- IMEI/serial tratados como información privada.
- Identificadores protegidos y enmascarados cuando se muestran.
- Nunca utilizar IMEI/serial en URLs públicas.

### Restricción
No se implementarán bypass de Activation Lock, cuentas de terceros, credenciales ajenas ni mecanismos para evadir controles de seguridad del fabricante.

---

## Fase 06 — Admin + RBAC

**Issue:** #6 — Admin: dashboard, productos, pedidos, inventario, pagos, clientes y RBAC

### Objetivo
Construir el panel administrativo completo para operar el negocio sin manipulación manual de la base de datos.

### Alcance

- Dashboard.
- Productos.
- Inventario.
- Pedidos.
- Pagos.
- Clientes.
- Servicios.
- Reviews.
- Cupones.
- Promociones.
- CMS/blog.
- SEO.
- Notificaciones.
- Usuarios y roles.
- Audit logs.
- Settings.

### Roles iniciales

- SUPER_ADMIN
- ADMIN
- MANAGER
- SALES
- SUPPORT
- INVENTORY
- FINANCE
- CONTENT_EDITOR

### Seguridad
Los permisos deberán validarse server-side por recurso y acción. Ocultar botones en el frontend no constituye autorización.

---

## Fase 07 — Notifications realtime + Email + Queues

**Issue:** #7 — Plataforma de notificaciones durable, realtime y multicanal

### Objetivo

Implementar una plataforma de notificaciones profesional, desacoplada y escalable que entregue eventos de negocio por varios canales sin bloquear las operaciones transaccionales.

### Arquitectura objetivo

```text
Business transaction
        ↓
D1 business state + notification_outbox
        ↓
Immediate Queue publish
        ↓
Cloudflare Queue
        ↓
Notification Processor
   ┌────┴─────────────┐
   ↓                  ↓
D1 notification inbox   Resend
   ↓
NotificationHub Durable Object
   ↓
WebSocket Hibernation
   ↓
Authenticated client
```

D1 es la fuente durable de verdad. Durable Objects coordinan conexiones realtime y no sustituyen el historial persistente.

### Alcance

- Outbox transaccional.
- Publicación inmediata a Queue después de confirmar la transacción.
- Cron de reconciliación.
- Inbox persistente por destinatario.
- Durable Object `NotificationHub`.
- WebSocket Hibernation.
- API de listado/catch-up.
- Cursor de reconexión.
- Read/unread y unread count.
- Preferencias de canal.
- Resend mediante adapter.
- Payloads tipados y versionados.
- Idempotencia por evento/destinatario/canal.
- Retry transitorio y clasificación terminal.
- Dead-letter queue.
- Replay seguro y auditado.
- Observabilidad de queue lag y realtime latency.
- Sin bloquear checkout, pagos, servicios o cambios de estado.

### Semántica obligatoria

El sistema no prometerá `exactly once`.

- Queue: at-least-once.
- Procesamiento: idempotente.
- D1: fuente durable.
- WebSocket: entrega de baja latencia.
- Reconexión: catch-up desde D1.
- Orden global de Queue: no asumido.

### Eventos iniciales

- `OrderCreated`
- `OrderPaid`
- `OrderStatusChanged`
- `ServiceRequestCreated`
- `ServiceStatusChanged`
- `RepairDeviceReceived`
- `RepairDiagnosisReady`
- `RepairQuoteIssued`
- `RepairApprovalRequired`
- `RepairApproved`
- `RepairStarted`
- `RepairWaitingPart`
- `RepairQualityControlStarted`
- `RepairReady`
- `RepairDelivered`
- `WarrantyCreated`
- asignación de técnico;
- alertas operativas.

### Criterio de salida

Fase 07 solo podrá declararse completa cuando la notificación sea durable, el realtime esté autenticado, exista recuperación tras desconexión, DLQ/replay funcionen, la autorización esté probada y pasen tests, build, deploy, smoke y `verify:production`.

## Fase 08 — CMS + Marketing + Reviews

**Issue:** #8 — CMS, Marketing y Reviews

**Estado previo auditado para 08.1:** 🟡 existen piezas funcionales heredadas de Fase 06 (CMS básico, promociones y reviews), pero Fase 08 no se considera iniciada/implementada hasta completar la auditoría y cerrar los gaps descritos en `docs/auditoria-fase-8.md`.

### Objetivo
Convertir el e-commerce en una plataforma administrable de contenido, marketing y reputación.

### CMS

- Páginas.
- Blog.
- Categorías.
- Banners.
- FAQs.
- Landing pages.
- Contenido destacado.

### Marketing

- Cupones.
- Descuentos.
- Promociones.
- Productos destacados.
- Campañas.
- Banners programables.
- Reglas por producto/categoría.

### Reviews

- Rating.
- Texto.
- Compra verificada.
- Moderación.
- Respuesta administrativa.
- Reportes.

### Regla crítica
Descuentos y cupones deben validarse server-side y sus eventos deben ser auditables.

---


## Fase 08 — 08.1 Auditoría de estado existente

La auditoría inicial del 2026-09-25 revisó el código real de `main` antes de reconstruir funcionalidades. Hallazgos principales:

- CMS: existe bounded context parcial (`AdminCms` + `D1CmsRepository`), API administrativa y `/admin/cms`; actualmente cubre páginas CMS básicas y activación, no el CMS completo del Issue #8 (blog, categorías, banners, FAQs, landing pages y contenido destacado).
- Marketing: existe bounded context `promotions`, `AdminPromotions`, repositorio D1, API `/api/admin/promotions` y `/admin/promotions`; cubre promociones/códigos básicos, pero no cubre todavía el modelo completo de cupones por cliente/producto/categoría, campañas, banners programables y destacados.
- Reviews: existe dominio `Review`, `ReviewService`, persistencia D1, creación condicionada a compra entregada, prevención de duplicados, API de producto y moderación administrativa con respuesta; `/admin/reviews` existe. Falta completar capacidades de reportes y endurecer/validar integralmente el flujo público y administrativo requerido por Fase 08.
- Frontend público: no se encontraron rutas dedicadas `/blog`, `/landing` o `/faq` en la estructura revisada; el contenido CMS existente no constituye todavía un sistema público completo de publicación.
- Persistencia: `cms_pages`, `promotions` y `product_reviews` ya existen en migraciones anteriores, por lo que 08.1 debe reutilizar/evolucionar el esquema en lugar de duplicarlo.
- Arquitectura: las piezas existentes respetan en general la separación Application/Infrastructure y composition root; antes de ampliar la fase deben eliminarse atajos de tipado como `any` presentes en `apps/web/app/api/admin/promotions/route.ts` y revisar validación/auditoría/concurrencia.

### 08.2 — Modelo de dominio, persistencia y contratos\n\n🟡 Backend inicial implementado en `main`: migración D1 `0035_phase08_cms_marketing_reviews.sql`, modelos/ports CMS y marketing, administración de cupones con redención atómica, reportes y moderación de reviews con auditoría, y corrección de identidad pública de reviews para usar sesión server-side. El sub-bloque no está cerrado: falta integración transaccional de cupones/aplicabilidad en checkout, CRUD completo, publicación pública, UI, tests de integración/concurrencia y verificación productiva.\n\n### Orden de implementación después de 08.2

1. Diseñar el modelo completo CMS/Marketing/Reviews y migraciones incrementales sin romper datos existentes.
2. Completar CMS Domain/Application/Infrastructure y APIs administrativas.
3. Implementar publicación pública de páginas/blog/FAQs/landing con SEO-safe rendering.
4. Construir motor de cupones/promociones server-side con reglas, límites, uso por cliente y aplicación por producto/categoría.
5. Completar campañas, banners programables y contenido destacado.
6. Completar reviews públicas, compra verificada, moderación, respuesta y reportes.
7. Integrar auditoría, RBAC, idempotencia, concurrencia y tests.
8. Build, deploy y certificación productiva.


## Fase 08 — 08.4 Certificación productiva y hardening final

**Objetivo:** convertir la implementación 08.3 en un release verificable de producción, cerrando los gates específicos de CMS, Marketing y Reviews sin introducir mocks, datos ficticios ni bypasses.

### Alcance

- Gate de arquitectura, foundation, frontend production-data, formato, lint, typecheck, tests y build.
- Aplicación y verificación remota de la migración D1 de hardening de reviews.
- Smoke tests reales contra `https://iphone.jnmtortas.com` para storefront, Blog, FAQ, APIs públicas de CMS/Marketing y respuestas 4xx esperadas.
- Verificación de aislamiento de las APIs administrativas sin sesión.
- Verificación de políticas de caché de las APIs públicas de contenido.
- Integración del gate 08.4 en el workflow de deploy para impedir declarar un release exitoso si falla el comportamiento productivo del bounded context.
- Documentación y evidencia de release antes de cerrar el Issue #8.

### Estado 08.4

🟢 **Código implementado y conectado; certificación productiva pendiente.** El build Cloudflare del 2026-09-26 ya supera compilación, typecheck, generación de 118 páginas y optimización. También se corrigió un error real del workflow de producción en el paso de verificación D1. El cierre de certificación requiere que el pipeline pase todos los gates y que exista evidencia de deploy + smoke + verify sobre producción. Los runs 1490/1491 fallaron casi inmediatamente sin steps/logs expuestos por GitHub; el run 1491 fue reintentado y volvió a fallar.

## Fase 09 — SEO Avanzado

**Issue:** #9 — SEO máximo: técnico, contenido, structured data y crecimiento orgánico

### Objetivo
Implementar SEO técnico y de contenido al máximo nivel razonable, sin prometer rankings que dependen de los algoritmos de los buscadores.

### Technical SEO

- SSR/SSG/ISR según compatibilidad.
- Metadata dinámica.
- Canonical.
- Open Graph.
- Social cards.
- Sitemap XML.
- Robots.txt.
- Redirects 301.
- 404/410.
- hreflang.
- URLs limpias.
- Breadcrumbs.
- HTML semántico.

### Structured Data

JSON-LD contextual para:

- Organization.
- WebSite.
- Product.
- Offer.
- Review cuando corresponda.
- BreadcrumbList.
- Article.
- LocalBusiness cuando realmente corresponda.
- FAQ cuando sea elegible y el contenido exista realmente.

### SEO de productos

- SEO title.
- Meta description.
- Slug.
- Canonical.
- Open Graph.
- Alt text.
- Structured data.
- Internal linking.

### SEO programático

Crear únicamente páginas con contenido útil y diferenciado. Evitar thin content, duplicados y combinaciones infinitas sin valor.

### SEO Admin

- Metadata.
- Index/noindex.
- Canonical.
- Redirect manager.
- Sitemap status.
- Robots rules permitidas.
- OG images.

---

### Fase 09 — Estado de implementación — 2026-09-28

Se inició la implementación real de Fase 09 sobre `main`.

Implementado en código:
- bounded context SEO con política central de canonical/indexability;
- metadata dinámica centralizada con canonical, robots, Open Graph y Twitter;
- Organization/WebSite/BreadcrumbList;
- Product/Offer/Review con datos reales de producto e inventario y reviews aprobadas;
- Article para blog;
- FAQ estructurado únicamente cuando existe contenido publicado;
- sitemap dinámico conectado a catálogo y CMS, con exclusión de URLs no indexables y respeto de canonical overrides;
- robots.txt production-safe;
- SSR real de la página pública de servicios;
- noindex para superficies privadas/transaccionales;
- persistencia D1 para overrides SEO y redirects 301/410;
- redirect manager administrativo protegido por RBAC;
- aplicación de redirects/410 en el Worker después de un 404 real;
- panel administrativo SEO para metadata, index/noindex, canonical, OG image, redirects y estado técnico;
- verificación productiva específica: `pnpm verify:phase09:production`;
- tests unitarios para política SEO, metadata, structured data y validación de administración.

Decisiones explícitas:
- `hreflang` no se genera mientras no existan variantes lingüísticas reales y URLs localizadas recíprocas.
- `LocalBusiness` no se genera porque el modelo público actual no aporta datos verificados suficientes.
- Las superficies de más de 50.000 URLs deberán dividirse mediante sitemaps separados cuando los datos reales del catálogo/CMS alcancen ese límite; el generador actual respeta el máximo de un sitemap.

Estado: 🟡 implementación avanzada en curso; **no certificada como cerrada** hasta ejecutar formatter, lint, typecheck, tests, build Cloudflare, migración/verificación D1, deploy del commit correcto, `verify:production`, `verify:phase09:production` y smoke real de producción.

## Fase 10 — Testing + Security + Observability + Production

**Issue:** #10 — Analytics, observabilidad, seguridad avanzada y producción

### Objetivo
Preparar la plataforma para producción real con testing completo, seguridad, observabilidad, analítica y despliegue controlado.

### Analytics

Medir el funnel completo:

```text
Visitor
  ↓
Session
  ↓
Product View
  ↓
Search
  ↓
Add to Cart
  ↓
Checkout Started
  ↓
Payment Started
  ↓
Purchase
  ↓
Revenue / Conversion
```

### Observabilidad

- Logs estructurados.
- Error tracking.
- Métricas.
- Health checks.
- Payment events.
- Webhook events.
- Email events.
- Audit events.
- Correlation/request IDs.

### Seguridad

- WAF.
- Rate limiting.
- Bot protection.
- Turnstile cuando aporte valor.
- CORS restrictivo.
- CSP.
- Security headers.
- RBAC server-side.
- MFA para administración sensible.
- Secret management.
- Input validation.
- Webhook verification.
- Idempotency.
- Audit logs.
- Protección de datos de clientes e identificadores de dispositivos.
- No secretos ni PII innecesaria en logs.

### Testing

- Unit.
- Integration.
- E2E.
- Contract tests de adapters.
- Payment sandbox tests.
- Security tests.
- Concurrency tests de inventory.
- Regression tests.

### CI/CD

```text
Lint
  ↓
Typecheck
  ↓
Tests
  ↓
Build
  ↓
Security Checks
  ↓
Deploy Staging
  ↓
Smoke Tests
  ↓
Controlled Production Deploy
```

### Producción

- Domain.
- DNS.
- SSL/TLS.
- WAF rules.
- Cache strategy.
- D1 production.
- R2 production.
- Queues production.
- Production secrets.
- Payment production keys.
- Resend production domain.
- Rollback/recovery procedure.

---

# Descomposición posterior

Las 10 fases son las **épicas principales**. No se pretende crear cientos de tareas antes de comenzar.

Cada fase se descompondrá progresivamente en sub-Issues técnicos cuando llegue su turno.

Ejemplo para la Fase 01:

```text
#1 FASE 01 — Foundation
│
├── 01.1 Monorepo
├── 01.2 DDD / Bounded Contexts
├── 01.3 Clean Architecture
├── 01.4 Cloudflare D1
├── 01.5 Cloudflare R2
├── 01.6 Cloudflare Queues
├── 01.7 Environments / Secrets
├── 01.8 CI/CD
├── 01.9 Testing Foundation
└── 01.10 Architecture Documentation
```

## Estado vivo — 2026-09-21

| Área | Estado |
|---|---|
| Foundation | 🟡 Implementada + hardening; certificación final pendiente |
| Storefront | 🟡 Implementada + hardening de navegación pública; certificación E2E/accessibility/performance/SEO pendiente |
| Commerce Core | 🟢 Implementación cerrada; certificación productiva pendiente |
| Payments | 🟡 Cinco adapters implementados; certificación real pendiente |
| Services | 🟢 Implementación + hardening; certificación pendiente |
| Admin/RBAC | 🟡 Implementación avanzada; certificación pendiente |
| Notifications | 🟡 Outbox/Queue/Resend funcional; arquitectura realtime definida; Durable Objects/WebSocket + inbox + DLQ/replay pendientes |
| Technicians | 🟡 Identidad independiente implementada; portal funcional + hardening visual/UX implementado; certificación productiva pendiente |

### Última producción certificada

Worker: `f7d67832-8598-4f59-8db9-b538f543b3ef`

Los commits posteriores están en `main`, pero no se consideran certificados hasta un nuevo build, deploy y `verify:production`.

**Base de código de aplicación revisada:** `d6962439e434d5064a339648b5ed32174c7b602b`.

Las actualizaciones documentales posteriores permanecen en `main` como commits separados.

**Histórico de build:** un ciclo anterior terminó la compilación y falló en typecheck por `exactOptionalPropertyTypes` en `apps/web/app/components/StoreHeader.tsx`. La fuente actual ya contiene la corrección; ese fallo no representa el estado actual del archivo.

# Definition of Done Global

Una fase se considera terminada únicamente cuando:

- [ ] La funcionalidad está implementada.
- [ ] Está integrada con los módulos correspondientes.
- [ ] Tiene tests adecuados.
- [ ] No rompe las fronteras de arquitectura.
- [ ] No introduce secretos en Git.
- [ ] No depende de mocks como fuente definitiva cuando requiere datos reales.
- [ ] Está documentada cuando corresponde.
- [ ] Pasa los checks automatizados.
- [ ] Está lista para que la siguiente fase pueda construirse sobre ella.

---

### Fase 08.3 — Implementación completa — 2026-09-25

- CMS completo administrable: páginas, blog, categorías, FAQs, landing pages, banners y destacados.
- Blog y landing pages públicas con metadata SEO/canonical.
- Publicación programada mediante Cloudflare Worker scheduler.
- Marketing completo: promociones, cupones, campañas, segmentación por producto/categoría y banners programables.
- Checkout aplica una única regla de descuento server-side sobre precios actuales de D1 y consume cupón atómicamente.
- Cupones soportan porcentaje, fijo, vigencia, uso máximo, uso por cliente, mínimo y activación.
- Reviews soportan compra verificada, moderación, respuesta, reportes y auditoría.
- RBAC y auditoría server-side en las mutaciones administrativas.
- Tests de dominio y persistencia para descuentos y redención.
- UI administrativa incorporada para promociones, cupones, campañas y contenido editorial.

**Estado:** 🟢 implementación de 08.2 cerrada. La certificación de release permanece separada y requiere build/deploy/verify exitoso sobre el commit final.
## Estado del roadmap

| Fase | Issue | Estado |
|---|---:|---|
| 01 — Foundation | #1 | 🟡 Implementada, certificación pendiente |
| 02 — Storefront Premium | #2 | 🟡 Implementada + hardening de navegación, certificación pendiente |
| 03 — Commerce Core | #3 | 🟢 Implementación cerrada, certificación pendiente |
| 04 — Payments | #4 | 🟡 Implementado, certificación real pendiente |
| 05 — Services | #5 | 🟢 Implementado + hardening, certificación pendiente |
| 06 — Admin + RBAC | #6 | 🟡 Implementación avanzada, certificación pendiente |
| 07 — Notifications realtime + Email | #7 | 🟡 Implementación de código completada + deploy; certificación funcional/E2E/security/load/verify pendiente |
| 08 — CMS + Marketing + Reviews | #8 | 🟢 08.4 código implementado e integrado; certificación productiva pendiente de build/deploy/verify |
| 09 — SEO | #9 | 🟡 Implementación avanzada en curso; certificación productiva pendiente |
| 10 — Production Readiness | #10 | ⬜ Pendiente |

> Este archivo es la referencia central del roadmap. El detalle operativo de cada fase vive en su Issue correspondiente y posteriormente en sus sub-Issues técnicos.


## Actualización viva — 2026-09-21

- La navegación pública fue centralizada en `apps/web/app/components/StoreHeader.tsx` con Inicio, Catálogo, Servicios, Consultar reparación, Contacto, Carrito y Mi cuenta.
- El componente de navegación compartido es compatible con las superficies Server/Client porque también se utiliza desde el portal de cliente.
- El bounded context `technicians` mantiene identidad, autenticación, sesiones, autorización por asignación, dispositivos, evidencia y perfil propios.
- `/admin/technicians` trata TÉCNICO como identidad operativa y no como rol de `admin_users`.
- El rediseño visual completo de `/technician/**` sigue pendiente.
- `/technician/**` ya utiliza una cabecera operativa compartida (`TechnicianHeader`) para la navegación técnica.
- La última versión directamente verificada en producción continúa siendo el Worker `f7d67832-8598-4f59-8db9-b538f543b3ef`; los cambios posteriores requieren un nuevo ciclo build/deploy/verify.
- El diseño realtime de notificaciones queda especificado en `docs/notifications.md` y `docs/realtime-notifications.md`.

### Evidencia de release actual — 2026-09-21

El commit actual de `main` no está certificado en producción. Los runs de `Cloudflare Production Deploy` 1074–1080 terminaron en `failure`; los runs 1079 y 1080 fallaron casi inmediatamente y el conector disponible no expone los pasos/logs internos del job. Por esa limitación no se atribuye el fallo a typecheck, tests o build sin evidencia. Además, un `Workers Builds: ecommerce-iphone` asociado al commit `0ee4522` también terminó en `failure`.

Por lo tanto, el estado oficial sigue siendo **implementado/hardening, certificación pendiente** para las fases afectadas. No se marca ningún release como productivo certificado mientras no exista evidencia de build + deploy + `verify:production` sobre `https://iphone.jnmtortas.com`.

### Build Cloudflare — hallazgo 2026-09-21 22:58 UTC

Un build de producción con Node.js 24.18.0, pnpm 12.4.1, Next.js 15.5.25 y OpenNext Cloudflare 1.20.6 compiló Next.js correctamente y falló durante typecheck por `exactOptionalPropertyTypes` en `modules/repairs/application/RepairOrderManagement.ts:102`. La causa fue pasar `diagnosisSummary` y `workSummary` opcionales como propiedades explícitas con valor `undefined`. La corrección aplicada usa propagación condicional para omitir las propiedades cuando son `undefined` y se añadió una regresión específica. `exactOptionalPropertyTypes` permanece habilitado.


## Actualización viva — 2026-09-25 — Fase 07

La Fase 07 ya no está limitada al Outbox/Queue/Resend inicial. El código actual incluye y el deployment de producción del 2026-09-25 confirmó la integración del Worker con estos recursos:

- inbox durable D1;
- cursor/catch-up;
- read/unread;
- Durable Object NotificationHub;
- WebSocket Hibernation;
- Queue dedicada de notificaciones;
- DLQ y persistencia D1 de mensajes agotados;
- replay administrativo auditado;
- autenticación de recipients customer/technician/admin;
- UI compartida de bell + inbox para customer/technician;
- preferencias de canal EMAIL/IN_APP;
- clasificación de fallos transitorios/terminales;
- ledger de entregas de canal;
- monitor administrativo de entregas y DLQ;
- smoke contract de producción sin secretos.
- frontend customer/technician/admin para bandeja y gestión de notificaciones.

Estado de código: **🟢 implementado**.

Deployment 2026-09-25: **🟢 SUCCESS**. OpenNext build, bundle y Wrangler deploy completados; Queue `ecommerce-iphone-notifications`, DLQ `ecommerce-iphone-notifications-dlq` y Durable Object `NotificationHub` quedaron provisionados/enlazados.

Certificación de fase: **🟡 pendiente** de migraciones D1 remotas verificadas, tests E2E/security/load, pruebas reales de retry/DLQ/replay/idempotencia/reconnect y `verify:production`.



### Actualización 2026-09-28 — cierre de hallazgos de trazabilidad 08.4

La auditoría profunda de rutas frontend/API detectó y corrigió los defectos concretos encontrados:

- `/api/customer/devices/[id]` ahora tiene GET real con ownership por `customerId`; PATCH/DELETE permanecen bloqueados para clientes.
- `/orders/[id]` fue tipada sin `any`, endurecida y conectada desde el listado de pedidos del portal de cliente.
- Se eliminó la copia obsoleta del flujo de pagos en el detalle de pedido.
- `/api/customer` conserva compatibilidad pero dejó de aceptar `Record<string, any>`; el body se valida como `unknown` y se transforma a tipos de dominio.
- Se añadió regresión de ownership para lectura de dispositivos.
- Las APIs legacy/indirectas no se eliminaron de forma especulativa: permanecen como compatibilidad o interfaces públicas/operativas hasta demostrar ausencia de consumidores externos.

**Estado de implementación 08.4:** 🟢 corregido e integrado a nivel de código.

**Certificación:** permanece separada de la implementación y solo se marcará como cerrada cuando el commit final pase tests, lint/typecheck, arquitectura, build Cloudflare, migraciones/verificación D1, deploy real, `verify:production` y smoke funcional contra producción.
