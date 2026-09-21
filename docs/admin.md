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
