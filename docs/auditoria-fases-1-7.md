# Auditoría viva — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**Código revisado actual:** `6a462a44d6869765f6542a5f7287aed136642ec3`  
**Última actualización:** 2026-09-21 UTC  
**Entorno remoto operativo:** producción únicamente.

> Una fase no se declara 100% por compilar. El cierre exige código, pruebas, seguridad, reproducibilidad, deploy y evidencia operativa.

---

# 1. Estado

| Fase | Estado | Certificación |
|---|---|---|
| 01 Foundation | 🟡 Implementada + hardening | Pendiente certificación final |
| 02 Storefront | 🟡 Implementada + navegación pública centralizada | Pendiente E2E/performance/accessibility/SEO final y certificación productiva |
| 03 Commerce Core | 🟢 Implementación cerrada | Pendiente certificación exhaustiva en producción |
| 04 Payments | 🟡 Implementada + hardening | Pendiente certificación real de proveedores |
| 05 Services | 🟢 Implementación + hardening | Pendiente gates/certificación |
| 06 Admin + RBAC | 🟡 Application consolidada + hardening UI/RBAC/loading/técnicos | Pendiente gates de seguridad, certificación y validación final del portal técnico |
| 07 Notifications + Queues | 🟡 Implementación funcional | DLQ/retry/replay pendiente |

El trabajo reciente corresponde al hardening de **Fase 01 — eliminación de datos/mock de negocio en frontend**, al hardening de **Fase 06** y a la consolidación de navegación pública y del bounded context `technicians`.

El portal técnico dispone actualmente de login, dashboard, órdenes, dispositivos y perfil funcionales. Su rediseño visual completo sigue pendiente y no se considera certificado. El último build ya supera la compilación, pero el ciclo de typecheck/deploy/verify todavía está pendiente.

---

# 2. Arquitectura obligatoria

```text
HTTP Route
   ↓
HTTP Adapter
   ↓
Application / Use Case
   ↓
Domain
   ↑
Application Ports
   ↑
Infrastructure
   ↓
D1 / R2 / Queue / Cloudflare
```

Reglas:

- Presentation no ejecuta SQL/D1.
- Presentation no construye entidades de Domain para resolver casos de uso.
- `apps/web/lib/api/*` no contiene SQL ni `repo.audit()`.
- Application no depende de Next.js, Cloudflare ni Infrastructure.
- Infrastructure implementa ports.
- Auditoría de comandos administrativos vive dentro de Application mediante `AuditPort`.
- `apps/web/lib/adminAuth.ts` queda como adapter/composition layer para cookies, headers y Cloudflare context.
- `architecture:check` mantiene el enforcement.
- El frontend de producción no contiene datasets mock/demo ni repositorios in-memory en su camino ejecutable.

---

# 3. Foundation

Implementado: monorepo modular, DDD + Clean Architecture, bounded contexts, D1/R2/Queues, OpenNext + Workers, cron, observabilidad, health live/ready, rate limiting, request-id, security headers y enforcement arquitectónico.

## Reproducibilidad

- Node `24.18.0`.
- pnpm `12.4.1`.
- `pnpm install --frozen-lockfile`.
- lockfile versionado.
- `.node-version` / `.nvmrc` fijados.
- `engine-strict` y guard de instalación activos.
- build Cloudflare limpio confirmado.
- OpenNext completo.

## Deploy más reciente informado

- Build: **SUCCESS**.
- Typecheck/lint: **SUCCESS**.
- Static pages: `40/40`.
- OpenNext: **SUCCESS**.
- D1: `No migrations to apply!`.
- Worker deploy: **SUCCESS**.
- Version ID: `d1405ac6-71a1-4db8-8454-2db575bad847`.
- `/api/health/live`: `200`.
- `/api/health/ready`: `200`.
- `verify:production`: **PASS**.
- Rate limit smoke: warning por consistencia eventual, no fallo de deploy.

## 3.1 Fase 01 — Frontend: eliminación de mocks y datos de demostración

### Alcance auditado

Se inspeccionaron como superficie de producción:

- `apps/web/app/**`
- `apps/web/components/**`
- `apps/web/lib/**`

La comprobación cubre marcadores y patrones de:

```text
mock / mocks
 demo
 fake
 dummy
 fixture
 sample
 seed
 hardcoded
 InMemory
 TODO
```

Además detecta identificadores de datos de negocio falsos, credenciales/test data evidentes, imports de `InMemoryProductRepository` y literales numéricos usados directamente como campos de precio de negocio en frontend.

### Gate permanente

Se creó `scripts/check-frontend-production-data.mjs` y el script raíz:

```text
pnpm frontend:data:check
```

El deploy de producción ejecuta este gate antes de arquitectura, formato, lint, typecheck, tests y build.

### Datos reales

El catálogo productivo de frontend se compone mediante `D1ProductRepository`, `D1ProductVariantRepository` y casos de uso de Application; no utiliza `InMemoryProductRepository` para resolver catálogo. `apps/web/lib/catalog.ts` instancia el repositorio D1 y delega búsqueda/variantes a Application.

### InMemoryProductRepository

`modules/catalog/infrastructure/InMemoryProductRepository.ts` existe únicamente como adapter de soporte para pruebas del contrato del repositorio y su test asociado. No forma parte del código de `apps/web` ni del camino real del frontend. El gate de producción bloquea cualquier importación accidental desde las rutas/componentes/libs de producción.

### Checkout / precios

Se eliminó del frontend el precio de envío `$15.000` y el texto comercial `gratis` que estaban hardcodeados en el selector de checkout. La UI ahora envía únicamente el método de envío; el cálculo efectivo del pedido continúa siendo responsabilidad server-side.

### Resultado del estado de código

- `mockProducts[]`: no encontrado en la superficie frontend auditada.
- `fakeUser`: no encontrado en la superficie frontend auditada.
- `demoOrder`: no encontrado en la superficie frontend auditada.
- credenciales demo evidentes: no encontradas en la superficie frontend auditada.
- import productivo de `InMemoryProductRepository`: no encontrado en la superficie frontend auditada.
- precio de envío hardcodeado en checkout frontend: eliminado.

**Fase 01 frontend data hardening: 🟡 IMPLEMENTADO, pendiente ejecución del gate/build y certificación final.**

---

# 4. Storefront Premium

Implementado: catálogo, búsqueda, filtros, ordenamiento, paginación, variantes, reviews, FAQ, relacionados, galería, inventario, SEO metadata, canonical/Open Graph, JSON-LD, sitemap/robots y separación por capas.

Pendiente: E2E, accesibilidad, LCP/CLS reales, SEO sobre URLs reales y regresiones responsive.

---

# 5. Commerce Core

Implementado y endurecido:

- sesión customer server-side;
- guest cart + claim ownership;
- ownership por customer;
- `Idempotency-Key` obligatoria;
- precios server-side;
- producto/variante activa;
- stock atómico;
- batch D1;
- order `PENDING_PAYMENT`;
- reservas de 15 minutos;
- release/consume idempotentes;
- expiración programada;
- promociones server-side y consumo atómico;
- pedidos filtrados por `customer_id`.

Pendiente: certificación funcional exhaustiva contra producción.

---

# 6. Payments — FASE 04

Implementado: aggregate/state machine, ports, Wompi, Stripe, Mercado Pago, PayPal, Binance Pay, webhook verification, deduplicación/out-of-order, ledger/reconciliation, idempotencia de intent/webhook/refund, refunds y locks concurrentes, void y RBAC.

Persistencia versionada: `0017_payment_refunds.sql`, `0018_payment_refund_locks.sql`.

Pendiente: pruebas reales con proveedores productivos y certificación de refund/void/webhook/race conditions.

---

# 7. Services — FASE 05

Implementado: ownership server-side, workflow, quote, technician, completion, RBAC y auditoría.

## Application administrativa

`AdminServiceQuery` gobierna listados. `AdminServiceDetails` gobierna detalle. `ServiceWorkflowService` gobierna las mutaciones. `D1ServiceRequestRepository` queda detrás de `ServiceRequestRepository`.

## Service Types

`AdminServiceTypes` gobierna list/create, normalización, construcción de `ServiceTypeDefinition`, persistencia y auditoría mediante `AuditPort`. `D1ServiceTypeRepository` y `D1ServiceTypeAuditPort` son Infrastructure.

---

# 8. Admin + RBAC — FASE 06

## 8.1 Estado

**🟡 Arquitectura Application consolidada + hardening avanzado. F6 no certificada todavía.**

## 8.2 Admin Users

`AdminUserManagement` es el único flujo administrativo y gobierna:

- `list`
- `create`
- `update`
- `activate`
- `deactivate`
- `changeRole`
- `resetPassword`

Ports:

- `AdminUserRepository`
- `PasswordHasher`
- `SessionRepository`
- `AuditPort`

Reglas centralizadas en Application/Domain:

- self deactivation;
- self role change;
- last `SUPER_ADMIN` protection;
- transición crítica de `SUPER_ADMIN` mediante escritura condicional atómica;
- email duplicado;
- password hashing;
- revocación de sesiones;
- auditoría.

El DTO de listado excluye `passwordHash`.

`AdminManagementHardening` ya no actúa como flujo paralelo desde `apps/web/lib/api/adminUsers.ts`.

## 8.3 Dashboard / Notifications

`AdminDashboardService` y `AdminNotificationsService` gobiernan las consultas; `apps/web/lib/api` solamente adapta HTTP/Application.

## 8.4 Payments administrativos

Consultas, refund y void administrativos están detrás de Application use cases y ports. No existe SQL ni `repo.audit()` en `apps/web/lib/api`.

## 8.5 Audit

Lectura: `AdminAuditViewer` + `D1AdminAuditRepository`.

Escritura:

```text
Application command
 ├── validar
 ├── ejecutar operación
 └── AuditPort.audit(...)
```

CMS y Settings ya registran auditoría dentro de `AdminCms` / `AdminSettings`. Las routes ya no ejecutan `repo.audit()` después del caso de uso. `D1AuditPort` implementa el port.

## 8.6 CMS / Settings / Inventory

`AdminCms`, `AdminSettings` y `AdminInventory` encapsulan operación y auditoría mediante Application + ports. Las routes solo adaptan HTTP/composición y no instancian repositorios D1 para ejecutar lógica de negocio.

## 8.7 Admin Auth

`adminAuth.ts` fue reducido a adapter/composition para:

- `cookies()`;
- `headers()`;
- `getCloudflareContext()`.

Application cases:

- `AuthenticateAdminAtomic`;
- `CreateAdminSession`;
- `LogoutAdmin`;
- `BootstrapAdmin`;
- `ResolveCurrentAdmin`;
- `RequireAdmin`.

Ports:

- `AdminRepository`;
- `AdminSessionRepository`;
- `PasswordHasher`;
- `AuditPort`.

El login, logout, bootstrap, resolución del admin actual y autorización ya no hacen acceso D1 directo desde HTTP. `AuthenticateAdminAtomic` delega creación de sesión a `CreateAdminSession`.

### Lockout concurrente

El registro de fallos de login usa una mutación D1 condicional/atómica sobre `failed_login_count` y `locked_until`, evitando carreras que pudieran perder incrementos concurrentes. El éxito limpia el estado de lockout en una única actualización.

### Timing de usuario inexistente

Se eliminó la salida temprana que permitía distinguir fácilmente entre email existente e inexistente por coste de password verification. `PasswordHasher` expone `verifyUnknownAccount(password)` y el adapter D1 ejecuta una verificación PBKDF2-SHA256 precomputada con el mismo coste criptográfico base que una contraseña administrativa real.

El caso inexistente:

1. busca el usuario;
2. ejecuta `verifyUnknownAccount(password)`;
3. registra el intento fallido;
4. devuelve exactamente `INVALID_CREDENTIALS`.

No crea sesión, no modifica ninguna cuenta y no revela si el email existe.

### Session security

- el token de sesión se genera aleatoriamente;
- solo se persiste su hash;
- cookies administrativas son `httpOnly`, `secure`, `sameSite=strict` y `path=/`;
- la resolución exige sesión activa, no revocada, no expirada y usuario activo;
- logout revoca la sesión;
- operaciones de cambio/reset de credenciales revocan sesiones según el caso de uso.

### Rate limiting

El Worker aplica el rate limiting nativo de Cloudflare antes del árbol de autenticación para rutas API sensibles. `/api/admin/*` utiliza `SENSITIVE_RATE_LIMITER`; la autenticación por cuenta dispone además de lockout por `admin_users`.

### Limpieza de artefactos experimentales

Se eliminaron los artefactos no usados del intento anterior de rate limiting D1:

- `modules/admin/application/AdminLoginRateLimitPort.ts`;
- `migrations/0019_admin_login_rate_limit.sql`.

La búsqueda del repositorio no mantiene referencias al port ni a la tabla experimental. No forman parte del flujo activo ni de las migraciones de producción.

## 8.8 Composition root

`apps/web/lib/adminApplication.ts` y la composición específica de auth construyen los grafos de Application + Infrastructure. `apps/web/lib/api/*` no debe instanciar repositorios para ejecutar lógica administrativa.

## 8.9 Backoffice

- Dashboard: 🟢
- Notifications: 🟢
- Services / Service Types: 🟢
- Payments / Refunds / Void: 🟢
- Admin Users: 🟢
- CMS/SEO: 🟢 + AuditPort
- Settings: 🟢 + AuditPort
- Audit viewer: 🟢
- Admin Auth: 🟢 Application + adapter + hardening de timing/lockout
- Inventory / Products / Customers / Orders: 🟡 revisión/certificación final pendiente
- Promotions / Reviews: 🟡 implementación existente, certificación pendiente

## 8.10 Anti-bypass permanente

Nunca debe existir:

```text
route → D1Repository
route → Domain Entity
apps/web/lib/api → SQL
apps/web/lib/api → repo.audit()
HTTP → flujo administrativo paralelo a Application
Application → Next.js / Cloudflare / Infrastructure
```

## 8.11 Pendientes para cerrar F6

1. build de producción posterior a toda la refactorización;
2. `foundation:check`;
3. `architecture:check`;
4. unit/integration tests de Application + Domain;
5. matriz RBAC completa;
6. privilege escalation vertical/horizontal;
7. IDOR/BOLA;
8. auth/session/lockout/rate limiting administrativo: **hardening implementado; falta evidencia de pruebas/certificación**;
9. audit + ausencia de secretos en payloads;
10. concurrencia/idempotencia de operaciones críticas;
11. refund/void regression;
12. regresión Services/Inventory/Commerce/Payments;
13. deploy production + health + `verify:production`;
14. evidencia final y certificación.

## 8.12 Gates F6

- [ ] foundation:check
- [ ] architecture:check
- [ ] format
- [ ] lint
- [ ] typecheck posterior a la refactorización
- [ ] unit tests
- [ ] integration tests
- [x] build Cloudflare reproducible
- [x] build limpio
- [x] production migrations
- [x] production deploy
- [x] health live/ready
- [x] verify:production

## 8.13 Criterio de cierre F6

F6 será 🟢 100% solamente cuando todos los módulos administrativos relevantes estén gobernados por Application, RBAC/auth/sesiones estén certificados, no existan bypasses, las operaciones sensibles tengan auditoría interna al use case, pasen tests/gates y exista evidencia productiva completa.

**Estado actual: 🟡 NO CERTIFICADA.**

---

# 8.14 Technical Identity / Technician Bounded Context

El contexto de técnicos ya está implementado en código y separado de `admin_users`.

### Persistencia

- `technician_users`
- `technician_sessions`
- `technician_audit_events`
- migración `0030_technician_accounts.sql`

### Aplicación y dominio

- `TechnicianUser`
- `TechnicianAuthService`
- `TechnicianManagement`
- `TechnicianDeviceService`
- password/token hashing
- repositorio de usuarios y sesiones.

### Superficie web

- `/technician/login`
- `/technician`
- `/technician/orders`
- `/technician/devices`
- `/technician/profile`

### Seguridad operacional

- cuenta creada únicamente por Administración;
- sin auto-registro público;
- sesión independiente `technician_session`;
- lifetime de 12 horas;
- revocación de sesiones anteriores al login exitoso;
- lockout tras 5 fallos durante 15 minutos;
- auditoría de login/logout;
- acceso limitado a órdenes asignadas;
- sin acceso al backoffice administrativo.

**Estado:** 🟡 implementado; pendiente build Cloudflare exitoso y certificación funcional/visual del workspace técnico.

## 8.15 Recent storefront/admin consistency work

Se consolidó la navegación pública en `apps/web/app/components/StoreHeader.tsx` con:

`Inicio · Catálogo · Servicios · Consultar reparación · Contacto · Carrito · Mi cuenta`

También se estandarizó el loading administrativo mediante `AdminLoadingState`.

Estos cambios están en `main` pero todavía no deben marcarse como certificados en producción hasta completar un build/deploy Cloudflare posterior.

# 9. Notifications + Queues — FASE 07

Implementado: notification ports, NotificationService, templates, D1 outbox/deliveries, Resend, Queue, cron, IDs deterministas, claim atómico de deliveries/outbox.

Pendiente: DLQ explícita, retry definitivo, replay y auditoría de fallos terminales.

---

# 10. Gates transversales restantes

## Reproducibilidad

- [x] lockfile versionado;
- [x] frozen install;
- [x] Node `24.18.0`;
- [x] pnpm `12.4.1`;
- [x] build limpio;
- [x] producción desplegada y verificada.

## Seguridad

- [ ] auditoría exhaustiva de APIs;
- [ ] validación completa de input;
- [ ] autorización server-side completa;
- [ ] CORS/Origin;
- [ ] CSRF donde corresponda;
- [ ] secrets/dependencias;
- [ ] abuso/rate-limit;
- [ ] regresiones de seguridad.

Estos gates no se convierten en PASS por documentación.

---

# 11. Criterio general de cierre

```text
Código + Pruebas + Seguridad + Reproducibilidad + Deploy + Verificación = 100%
```

No se usa `compila = 100%`, `CI verde = 100%` ni `documentado = 100%`.

---

# 12. Orden inmediato

1. ejecutar `pnpm frontend:data:check` y resolver cualquier hallazgo real;
2. build de producción posterior al hardening frontend/F6;
3. `foundation:check` + `architecture:check`;
4. tests Application/Domain/RBAC/auth/audit;
5. IDOR/BOLA + privilege escalation;
6. concurrencia/idempotencia crítica;
7. regresión Payments/Commerce/Services/Inventory;
8. deploy production;
9. health + verify:production;
10. certificación F6 y F1 con evidencia exacta.

**Regla permanente:** este documento debe actualizarse en la misma iteración de cada cambio relevante de código.


## Actualización — navegación y técnicos — 2026-09-21

### Navegación pública

La navegación pública quedó centralizada en `apps/web/app/components/StoreHeader.tsx`. El conjunto estándar es: Inicio, Catálogo, Servicios, Consultar reparación, Contacto, Carrito y Mi cuenta. El componente es client-compatible porque también se consume desde el portal de cliente.

### Técnicos

El bounded context `technicians` sigue siendo una identidad operativa independiente de Admin/RBAC. La gestión administrativa permanece en `/admin/technicians` y la operación en `/technician/**`.

Ya implementado: autenticación, sesiones, lockout, revocación de sesiones previas, autorización por asignación, diagnóstico, estados técnicos permitidos, dispositivos recibidos, evidencia fotográfica, perfil propio y auditoría.

Pendiente: rediseño visual completo de `/technician/login`, `/technician`, `/technician/orders`, `/technician/devices` y `/technician/profile`, más build/deploy/verify y certificación final.
