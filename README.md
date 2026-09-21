# Ecommerce iPhone

## Estado vivo — 2026-09-21

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
| 07 — Notifications + Queues | 🟡 Implementación funcional | Falta DLQ/retry/replay final |
| Reparaciones / Técnico | 🟡 Implementación operativa | Falta cierre funcional, visual y certificación |

Una fase no se considera 100% terminada solo porque compile. El cierre exige implementación, integración, tests, seguridad, reproducibilidad, despliegue y evidencia operativa.

## Estado de producción

La última versión de Cloudflare que quedó **verificada directamente en producción** antes de los cambios recientes de navegación, técnicos y documentación corresponde al Worker:

`f7d67832-8598-4f59-8db9-b538f543b3ef`

con:

- `/api/health/live` → `200`
- `/api/health/ready` → `200`
- `verify:production` → PASS.

Los commits posteriores están en `main` y requieren una ejecución de build/deploy exitosa antes de considerarse certificados en producción.

Commit funcional de referencia para el estado documentado:

`6a462a44d6869765f6542a5f7287aed136642ec3`

Los commits de documentación posteriores no cambian este código funcional de referencia.

Este commit y los sucesores permanecen sin certificación productiva hasta un nuevo build/deploy/verify exitoso.

Un build remoto reciente falló por secuencias `\\n` literales inválidas en `modules/technicians/domain/TechnicianUser.ts`; esa fuente ya fue corregida. Posteriormente el build alcanzó `Compiled successfully` y detectó incompatibilidades de `exactOptionalPropertyTypes` en las cabeceras compartidas; `StoreHeader` y `TechnicianHeader` ya fueron ajustados. El estado actual continúa sin certificación productiva hasta un nuevo build/deploy/verify exitoso.

## Toolchain actual

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.25`
- `@opennextjs/cloudflare` `1.20.6`
- Wrangler `4.131.1` en la última build Cloudflare verificada
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

La navegación contextual usa `aria-current` y mantiene el conjunto estándar Inicio, Catálogo, Servicios, Consultar reparación, Contacto, Carrito y Mi cuenta.

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

```text
Business operation
    ↓
notification_outbox
    ↓
Cloudflare Queue
    ↓
Resend
    ↓
notification_deliveries
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

## Documentación canónica

- `roadmap.md`
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
