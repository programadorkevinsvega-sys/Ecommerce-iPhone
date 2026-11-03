# Ecommerce iPhone

## Estado actual — 2026-11-03

- `main` contiene el merge de PR #39 (`ba0b9d484c6fbdba95a650ed008d0fa4a3ccad6d`), que integra logging estructurado de Fase 10.6.
- Repository CI del merge: PASS. PR #39: 86 archivos de pruebas/357 tests, 23 E2E, audit sin vulnerabilidades conocidas y verificación de artefactos Cloudflare aprobada. Lighthouse: 18 informes verificados. La aceptación de Cloudflare Observability (retención y acceso) sigue pendiente.
- Fase 10.4 y 10.5 están implementadas y sus verificadores read-only están en `main` (PR #38), pero la aceptación productiva actual sigue pendiente de ejecución protegida con muestras reales.
- El Production Verification del 2026-11-03 falló antes de los probes autenticados porque el monitor no pudo resolver el host `workers.dev` (HTTP 401; `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` estaba vacío y el token no pudo consultar el subdominio). Los verificadores 10.4/10.5 quedaron `skipped`; no se declara certificación productiva nueva. Ver [`docs/phase10-operational-acceptance.md`](docs/phase10-operational-acceptance.md).
- Próxima subfase de implementación: 10.7 — Correlation IDs y request tracing.

## Nota histórica — estado revisado el 2026-09-21

La revisión del código de main y del ciclo de hardening confirma que la corrección de exactOptionalPropertyTypes en StoreHeader y TechnicianHeader ya está aplicada en fuente. El portal técnico mantiene identidad independiente de admin_users y ahora incluye hardening de UX, estados de carga/error, prevención de dobles operaciones y una composición de aplicación que evita acceso directo de las rutas a repositorios y adaptadores.

El rediseño de /technician/** queda implementado a nivel de código, pero la certificación productiva sigue condicionada a frontend:data:check, foundation:check, architecture:check, formatter, lint, typecheck, tests, build Cloudflare, deploy y verificación de producción. La validación autenticada del workspace técnico requiere evidencia con una cuenta técnica real; no se considera certificada con datos inventados.

Plataforma e-commerce orientada a producción para smartphones y servicios legítimos de dispositivos.

## Arquitectura

- Monolito modular.
- Domain-Driven Design (DDD).
- Clean Architecture.
- Next.js 15 + TypeScript.
- Cloudflare Workers + OpenNext.
- Cloudflare D1.
- Cloudflare R2.
- Cloudflare Queues.
- Puertos/adapters explícitos.
- Bounded contexts preparados para extracción futura como servicios independientes.
- Entorno remoto operativo único: **producción**.

## Estado de las fases

| Fase | Estado actual | Cierre |
|---|---|---|
| 01 — Foundation | 🟡 Implementada + hardening | Falta certificación final de gates/evidencia |
| 02 — Storefront Premium | 🟡 Implementada + hardening | Falta E2E/accessibility/performance/SEO final |
| 03 — Commerce Core | 🟢 Implementación cerrada | Falta certificación exhaustiva en producción |
| 04 — Payments | 🟡 Multi-provider implementado | Falta certificación real de los 5 providers |
| 05 — Services | 🟢 Implementación + hardening | Falta certificación final |
| 06 — Admin + RBAC | 🟡 Implementación avanzada | Falta certificación de seguridad/gates |
| 07 — Notifications + Queues | 🟡 Implementación de código completada + deploy | Falta certificación funcional/E2E/security/load/verify de producción |
| 08 — CMS + Marketing + Reviews | 🟡 Código integrado | Certificación completa de release pendiente |
| 09 — SEO | 🟢 Certificada en producción (2026-09-29) | La evidencia certifica aquel release, no automáticamente commits posteriores |
| 10 — Production Readiness | 🟡 En ejecución | 10.1–10.3 completadas/certificadas según evidencia histórica; 10.4–10.5 aceptación productiva pendiente; 10.6 CI/merge verde con aceptación Cloudflare pendiente; siguiente 10.7 |
| Reparaciones / Técnico | 🟡 Implementación operativa | Falta cierre funcional, visual y certificación |

Una fase no se considera 100% terminada solo porque compile. El cierre exige implementación, integración, tests, seguridad, reproducibilidad, despliegue y evidencia operativa.

## Estado de producción

El último commit integrado en `main` y verificado mediante Repository CI es `ba0b9d484c6fbdba95a650ed008d0fa4a3ccad6d` (PR #39). El workflow de Production Verification de ese commit no terminó: el job `smoke` falló en el paso de resolución del monitor Worker por HTTP 401 y por la ausencia de `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN`. Las pruebas autenticadas posteriores y los verificadores 10.4/10.5 quedaron omitidos. Este resultado no permite declarar la salud integral del runtime ni una nueva certificación productiva; tampoco demuestra por sí solo que el storefront esté caído.

La configuración del monitor debe corregirse mediante la variable de repositorio `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` (solo el subdominio, sin protocolo) o concediendo al token el permiso mínimo `Workers Scripts Read`, y luego debe repetirse el workflow protegido. No se deben desactivar WAF/Bot Protection ni ejecutar migraciones D1 desde CI.

## Toolchain actual

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.28`
- `@opennextjs/cloudflare` `1.20.14`
- Wrangler `4.155.0`
- workerd compatibility date `2026-09-09`

Build:

```bash
pnpm install --frozen-lockfile
pnpm build:cloudflare
```

Deploy:

```bash
pnpm deploy:production
```

## Storefront

La navegación pública utiliza un único componente compartido y compatible con las superficies Server/Client:

`apps/web/app/components/StoreHeader.tsx`

Las rutas públicas mantienen:

- Inicio
- Catálogo
- Servicios
- Consultar reparación
- Contacto
- Carrito
- Mi cuenta

La navegación contextual usa `aria-current` e incluye Inicio, Catálogo, Servicios, Consultar reparación, Blog, Preguntas frecuentes, Contacto, Carrito y Mi cuenta.\n\nLas superficies públicas de marketing/CMS consumen datos reales de D1: banners programados, contenido destacado y FAQs publicados. No se agregaron datos de demostración ni proveedores fake.

## Clientes

Implementado:

- registro;
- login/logout;
- recuperación;
- perfil;
- direcciones;
- dispositivos;
- portal de cliente;
- reparaciones;
- pedidos;
- garantías;
- comunicaciones.

Los recursos protegidos se resuelven server-side contra la identidad del cliente.

## Servicios y reparaciones

Implementado:

- catálogo configurable de servicios;
- solicitudes;
- workflow;
- presupuestos;
- seguimiento público;
- órdenes de reparación;
- asignación de técnico;
- dispositivos recibidos;
- evidencia fotográfica;
- repuestos;
- auditoría;
- RBAC administrativo.

## Técnicos

El técnico es una **identidad operativa independiente**, no un rol administrativo.

Persistencia:

- `technician_users`
- `technician_sessions`
- `technician_audit_events`

Rutas:

- `/technician/login`
- `/technician`
- `/technician/orders`
- `/technician/devices`
- `/technician/profile`

Las cuentas técnicas se crean exclusivamente desde `/admin/technicians`. No existe auto-registro público. El rediseño visual completo de `/technician/**` permanece pendiente.

## Admin + RBAC

Roles administrativos:

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `SALES`
- `SUPPORT`
- `INVENTORY`
- `FINANCE`
- `CONTENT_EDITOR`

**`TECHNICIAN` no es un rol de `admin_users`.** El técnico pertenece al bounded context `technicians`.

## Payments

Existe implementación multi-provider con adapters independientes para Wompi, Stripe, Mercado Pago, PayPal y Binance Pay.

Los webhooks se verifican server-side y convergen en la misma máquina de estados. La certificación final de Fase 04 aún requiere evidencia real por provider.

## Notifications

La Fase 07 está implementada a nivel de código y desplegada en Cloudflare. Incluye inbox durable D1, realtime mediante `NotificationHub`, WebSocket Hibernation, Queue dedicada, DLQ, retry/clasificación terminal, replay auditado, preferencias, idempotencia y delivery ledger.

```text
Business operation
    ↓
notification_outbox
    ↓
Cloudflare Queue
    ↓
Notification Processor
   ├── D1 notification inbox
   ├── NotificationHub / WebSocket
   └── Resend
```

## Seguridad

Existe:

- CSP.
- HSTS.
- security headers.
- COOP/CORP.
- request-id.
- rate limiting.
- sesiones HttpOnly/Secure/SameSite.
- validación server-side.
- idempotencia.
- RBAC server-side.
- auditoría.
- ownership checks.
- hardening de imágenes y URLs.

La certificación global permanece pendiente hasta completar regresiones y evidencia productiva.

## Fase 08 — CMS + Marketing + Reviews

**08.3 — 🟢 implementación completa en código; certificación final pendiente del release.** Incluye CMS administrable, blog y landing pages públicas SEO-friendly, FAQs públicas, banners y destacados públicos, navegación Blog/FAQ, publicación programada, promociones, cupones con límites y segmentación, campañas, aplicación server-side en checkout, reviews verificadas, moderación concurrente, reportes con protección IDOR, auditoría, RBAC y pruebas de concurrencia. El pipeline de producción incluye verificación remota de la migración D1 0036 antes del deploy. El cierre 100% exige que el build Cloudflare final, migración remota, deploy y `verify:production` pasen sobre el mismo release.

## Documentación canónica

- `roadmap.md`
- `docs/auditoria-fase-8.md`
- `docs/auditoria-fases-1-7.md`
- `docs/PLAN-PLATAFORMA-REPARACIONES.md`
- `docs/architecture.md`
- `docs/foundation.md`
- `docs/security.md`
- `docs/admin.md`
- `docs/payments.md`
- `docs/payment-providers.md`
- `docs/services.md`
- `docs/notifications.md`
- `docs/cloudflare-deployment.md`
- `modules/README.md`
- `modules/technicians/README.md`

**Regla:** cualquier cambio funcional importante debe actualizar la documentación en la misma iteración.
