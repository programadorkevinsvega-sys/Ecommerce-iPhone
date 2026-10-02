# Admin / Backoffice

## Actualización técnica — 2026-09-21

El bounded context de técnicos permanece separado de admin_users. El hardening reciente conserva las capacidades administrativas existentes y mueve la superficie técnica hacia un composition root compartido, manteniendo RBAC administrativo independiente.

El bounded context administrativo mantiene autorización server-side mediante permisos efectivos. Los overrides por usuario se resuelven en sesión y los Application use cases que aplican autorización usan ese conjunto efectivo; no dependen únicamente del rol base. La certificación de Fase 06 continúa pendiente solamente por la ejecución/evidencia de los gates finales.

## Scope

Phase 06 provides the protected administrative backoffice for commerce, services, repairs, inventory, payments and administration.

## Administrative roles

Only these roles belong to `admin_users`:

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `SALES`
- `SUPPORT`
- `INVENTORY`
- `FINANCE`
- `CONTENT_EDITOR`

**TECHNICIAN is not an administrative role.** Technical identities live in `technician_users` under the `technicians` bounded context.

## Security

- HttpOnly + Secure + SameSite=Strict admin session cookie.
- Session tokens are stored only as SHA-256 hashes.
- Sessions expire and can be revoked.
- Successful login revokes previous sessions.
- Passwords use PBKDF2-HMAC-SHA-256 with random salt.
- Five consecutive failed attempts lock the account for 15 minutes.
- Unknown-account authentication executes a password-verification path to reduce timing enumeration differences.
- RBAC is enforced server-side using effective role + per-user permissions.
- Security-sensitive admin operations are audited.
- Device identifiers are masked where exposed to admin views.

## Current permissions

```text
dashboard:read
products:read
products:write
categories:read
categories:write
orders:read
orders:write
customers:read
customers:write
services:read
services:write
repair_orders:read
repair_orders:write
refunds:create
payments:void
payments:read
service_types:write
admins:manage
audit:read
inventory:read
inventory:write
reviews:write
promotions:write
cms:write
settings:write
technicians:manage
notifications:replay
```

Per-user permission overrides are supported. A user cannot change their own permissions, and non-`SUPER_ADMIN` users cannot grant permissions they do not effectively possess.

## Technician administration

Administration manages technical identities at:

```text
/admin/technicians
/api/admin/technicians
```

The form creates an operational `TÉCNICO` account. It does not assign an admin RBAC role. The interface explicitly communicates that the technician identity is operational and separate from administrative RBAC.

Technical capabilities are limited to:

- assigned orders;
- diagnosis/technical record;
- allowed technical status transitions;
- received-device registration/update for assigned orders;
- repair evidence;
- own profile.

## Backoffice loading UI

The recent admin hardening standardized resource loading through:

`apps/web/app/admin/AdminLoadingState.tsx`

It is used across dashboard/resource/table views instead of inconsistent full-page or ad-hoc loading patterns.

## Main endpoints

- `/api/admin/auth/login`
- `/api/admin/auth`
- `/api/admin/auth/bootstrap`
- `/api/admin/dashboard`
- `/api/admin/resources`
- `/api/admin/service-types`
- `/api/admin/users`
- `/api/admin/users/:id/permissions`
- `/api/admin/technicians`
- repair-order, inventory, payment, notification, CMS, promotions, reviews and audit routes.

## Certification

Implementation/hardening is complete for the identified F6 code gaps, but Phase 06 remains **not certified 100%** until the final architecture/security tests, production smoke matrix and release evidence pass.


## Current UI hardening — 2026-09-21

- Admin resource loading has been standardized with `AdminLoadingState` across the recently hardened resource pages.
- `/admin/technicians` exposes the operational TÉCNICO identity and capabilities without introducing a TECHNICIAN role into `admin_users`.
- The management form provides real create/update and activate/deactivate operations; the capability panel is descriptive and does not create administrative RBAC permissions.
- Final Phase 06 certification remains pending until the current build, architecture/RBAC gates and production evidence pass.
- `AdminLoadingState` is the shared loading pattern across the recently hardened resource pages.
- The technical identity remains separated from `admin_users`.
- Effective permission authorization is now consumed by admin resources and categories.
- Audit viewer, Promotions and Reviews are composed through `adminApplication`; HTTP routes no longer instantiate those D1 repositories directly.
- Payment list/detail routes require `payments:read`.
- `pnpm verify:admin:production` is the repeatable real-production RBAC/session smoke gate.

## Backoffice UI surfaces

The administrative API capabilities are grouped into business-facing pages rather than one page per permission.

Current dedicated administrative pages:

| Surface | Route | Main permissions |
|---|---|---|
| Dashboard | `/admin` | `dashboard:read` |
| Pedidos | `/admin/orders` | `orders:read`, `orders:write` |
| Productos | `/admin/products` | `products:read`, `products:write` |
| Categorías | `/admin/categories` | `categories:read`, `categories:write` |
| Clientes | `/admin/customers` | `customers:read`, `customers:write` |
| Dispositivos de clientes | `/admin/customer-devices` | `customers:read`, `customers:write` |
| Servicios ofrecidos | `/admin/service-types` | `service_types:write` |
| Carrusel de inicio | `/admin/home-carousel` | `cms:write` |
| CMS | `/admin/cms` | `cms:write` |
| Solicitudes | `/admin/services` | `services:read`, `services:write` |
| Técnicos | `/admin/technicians` | `technicians:manage` |
| Administradores y roles | `/admin/users` | `admins:manage` |
| Órdenes de reparación | `/admin/repair-orders` | `repair_orders:read`, `repair_orders:write` |
| Repuestos de taller | `/admin/repair-parts` | `inventory:read`, `inventory:write` |
| Inventario | `/admin/inventory` | `inventory:read`, `inventory:write` |
| Pagos | `/admin/payments` | `payments:read`, `payments:void`, `refunds:create` |
| Auditoría | `/admin/audit` | `audit:read` |
| Reseñas | `/admin/reviews` | `reviews:write` |
| Promociones | `/admin/promotions` | `promotions:write` |
| Configuración | `/admin/settings` | `settings:write` |
| Notificaciones | `/admin/notifications` | `dashboard:read` |

The following admin APIs remain auxiliary and intentionally do not create duplicate sidebar pages:

- `/api/admin/media`: upload adapter used by product, category, CMS and service editors.
- `/api/admin/permissions/catalog`: permission catalog consumed by the administrator/roles editor.
- `/api/admin/users/:id/permissions`: permission management embedded in the administrator editor.
- `/api/admin/repair-orders/:id/*`: repair-order detail, assignment, evidence and operation endpoints consumed by the repair-order workflow.
- `/api/admin/repair-orders/technicians`: technician selector data for repair-order assignment.


## Shared backoffice UI components

The administrative pages use a shared visual/component layer under `apps/web/app/admin/`:

- `AdminPageShell`: shell + sidebar + page header.
- `AdminPageHeader`: canonical administrative heading.
- `AdminPanel`: shared panel surface.
- `AdminSectionHeading`: panel heading and metadata/actions.
- `AdminToolbar`: shared filters/actions toolbar.
- `AdminTable`: shared table structure.
- `AdminLoadingState`: shared loading state.
- `AdminEmptyState`: shared empty state.

New operational surfaces and the existing technician/repair-parts surfaces reuse these primitives instead of introducing independent page styling.


## Permission catalog extension — Notifications

Se añadió el permiso administrativo:

notifications:replay

La capacidad está reservada por defecto a SUPER_ADMIN y ADMIN porque permite reenviar mensajes terminales del DLQ mediante el pipeline real. La consulta del monitor de notificaciones continúa bajo dashboard:read.



## Catálogo — acciones administrativas 2026-10-02

- Productos, categorías y servicios ofrecidos muestran la acción de estado según el valor persistido: **Desactivar** cuando están activos y **Activar** cuando están inactivos.
- Las tres superficies incluyen **Editar**, cambio de estado y **Eliminar**.
- La eliminación de productos está protegida contra referencias de carritos, reservas, pedidos o reseñas; si existe historial comercial, la API responde conflicto y se conserva el registro.
- La eliminación de servicios ofrecidos está protegida contra solicitudes históricas que usen ese código; en ese caso se conserva el servicio y se debe utilizar Desactivar.
- La eliminación de categorías elimina la entidad y sus relaciones dependientes mediante las restricciones ON DELETE CASCADE.
- Activar/desactivar y eliminar requieren los permisos administrativos de escritura correspondientes y registran auditoría.
