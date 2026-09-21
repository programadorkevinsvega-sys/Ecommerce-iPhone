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
| Technicians | 🟡 Identidad independiente implementada; portal funcional con rediseño visual pendiente y certificación productiva pendiente |

### Última producción certificada

Worker: `f7d67832-8598-4f59-8db9-b538f543b3ef`

Los commits posteriores están en `main`, pero no se consideran certificados hasta un nuevo build, deploy y `verify:production`.

**Base de código de aplicación revisada:** `d6962439e434d5064a339648b5ed32174c7b602b`.

Las actualizaciones documentales posteriores permanecen en `main` como commits separados.

**Último ciclo de build observado:** la aplicación completó la compilación de producción y falló en el typecheck por `exactOptionalPropertyTypes` en `apps/web/app/components/StoreHeader.tsx`; el ciclo actual requiere corrección, build, deploy y `verify:production` antes de certificarse.

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

## Estado del roadmap

| Fase | Issue | Estado |
|---|---:|---|
| 01 — Foundation | #1 | 🟡 Implementada, certificación pendiente |
| 02 — Storefront Premium | #2 | 🟡 Implementada + hardening de navegación, certificación pendiente |
| 03 — Commerce Core | #3 | 🟢 Implementación cerrada, certificación pendiente |
| 04 — Payments | #4 | 🟡 Implementado, certificación real pendiente |
| 05 — Services | #5 | 🟢 Implementado + hardening, certificación pendiente |
| 06 — Admin + RBAC | #6 | 🟡 Implementación avanzada, certificación pendiente |
| 07 — Notifications realtime + Email | #7 | 🟡 Base Outbox/Queue/Resend implementada; realtime/Durable Objects/inbox/DLQ/replay pendientes |
| 08 — CMS + Marketing + Reviews | #8 | ⬜ Pendiente |
| 09 — SEO | #9 | ⬜ Pendiente |
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
