# Auditoría viva — Fases 1 a 7

## Actualización viva — 2026-09-21

La fuente actual ya contiene la corrección de exactOptionalPropertyTypes para StoreHeader/TechnicianHeader; el fallo histórico de typecheck queda documentado como antecedente, no como estado actual del código. El contexto technicians mantiene identidad, sesión, lockout, auditoría y ownership por orden, y las rutas técnicas fueron ajustadas para pasar por Application/Composition Root en lugar de acceder directamente a repositorios, R2 o runtime adapters.

El portal técnico /technician/** quedó con hardening visual/UX de navegación, formularios, loading, empty/error/success states, control de concurrencia de acciones de interfaz y responsive existente. Esto es implementación/hardening, no certificación productiva. La certificación autenticada continúa pendiente hasta completar los gates del release y la verificación con una identidad técnica real.

StoreHeader continúa siendo la fuente única de navegación pública y mantiene Inicio, Catálogo, Servicios, Consultar reparación, Contacto, Carrito y Mi cuenta.

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**Base de código de aplicación revisada:** `d6962439e434d5064a339648b5ed32174c7b602b`  
**Última actualización:** 2026-09-21 UTC
La documentación ha sido actualizada en `main` mediante commits separados de la base de código.  
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
| 06 Admin + RBAC | 🟡 Application consolidada + hardening final de RBAC, auth, auditoría y boundaries | Pendiente ejecución de gates, smoke productivo y evidencia final |
| 07 Notifications + Queues | 🟢 Implementación de código completada + deploy 2026-09-25 | Certificación funcional/E2E/security/load/verify pendiente |

El trabajo reciente corresponde al hardening de **Fase 01 — eliminación de datos/mock de negocio en frontend**, al cierre de código de **Fase 06** y a la consolidación de navegación pública y del bounded context `technicians`.

El portal técnico dispone actualmente de login, dashboard, órdenes, dispositivos y perfil funcionales. Su rediseño visual/UX está implementado en código y no se considera certificado hasta verificarlo en producción. Un fallo histórico de typecheck por `exactOptionalPropertyTypes` en `StoreHeader.tsx` ya fue corregido en fuente; el ciclo de build/deploy/verify continúa pendiente.

---

## 1.1 Notifications realtime

La Fase 07 mantiene el Outbox/Queue/Resend existente y define como objetivo el inbox durable en D1, `NotificationHub` con Durable Object/WebSocket Hibernation, catch-up por API, idempotencia at-least-once, DLQ, replay y observabilidad.

Detalle: `docs/notifications.md` y `docs/realtime-notifications.md`.

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

**🟡 Implementación y hardening de código F6 completados; certificación productiva aún pendiente.**

La auditoría de cierre detectó y corrigió en `main` los bypasses de autorización efectiva, composition-root, auditoría y granularidad de permisos que impedían considerar el código F6 terminado.

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
- Inventory / Products / Customers / Orders: 🟡 certificación funcional y seguridad pendiente
- Promotions / Reviews: 🟢 Application + AuditPort; certificación productiva pendiente

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

1. `foundation:check`, `architecture:check`, format, lint, typecheck y suite completa después de los últimos cambios;
2. matriz API 401/403/2xx con identidades administrativas reales;
3. IDOR/BOLA y privilege escalation vertical/horizontal con requests reales;
4. auditoría sin secretos y regresiones de operaciones sensibles;
5. concurrencia/idempotencia final de operaciones administrativas críticas;
6. `pnpm verify:admin:production` con dos identidades reales: autorizada y restringida;
7. nuevo build/deploy Cloudflare de `main`;
8. health + `verify:production`;
9. evidencia final y certificación.

## 8.12 Gates F6

### Código ya cerrado en `main`
- [x] RBAC efectivo role + overrides en sesiones;
- [x] autorización efectiva en AdminResources/Categories;
- [x] protección de privilege escalation en gestión de permisos;
- [x] auth/session/lockout/timing hardening;
- [x] expiración de sesión comparada con `datetime()` en D1;
- [x] audit viewer detrás de composition root;
- [x] Promotions/Reviews detrás de Application + AuditPort;
- [x] payment list/detail con `payments:read`;
- [x] smoke gate reproducible `pnpm verify:admin:production`.

### Gates aún sin evidencia del nuevo release
- [ ] foundation:check
- [ ] architecture:check
- [ ] format
- [ ] lint
- [ ] typecheck
- [ ] unit tests
- [ ] integration/API tests
- [ ] build Cloudflare posterior a PR #14
- [ ] production deploy posterior a PR #14
- [ ] health live/ready del nuevo release
- [ ] verify:production
- [ ] verify:admin:production con credenciales reales

## 8.13 Correcciones de cierre de código — 2026-09-21

Se corrigieron y se integraron en `main` los hallazgos concretos detectados en la auditoría:

- `AdminResources` y `AdminCategories` autorizan con el conjunto efectivo de permisos de la sesión, respetando grants/denies por usuario.
- `AdminAuditViewer` se compone desde `adminApplication`; la route ya no instancia `D1AdminAuditRepository`.
- Promotions y Reviews se componen desde `adminApplication` y registran sus mutaciones mediante `AuditPort`.
- `/api/admin/payments` y `/api/admin/payments/:id` requieren `payments:read`.
- La resolución de sesión compara `datetime(expires_at)` con `CURRENT_TIMESTAMP`.
- Se añadieron regresiones para grants, denies, lockout, escalamiento de permisos y auditoría.
- Se añadió `pnpm verify:admin:production` para validar en producción 401, 200, 403 y revocación real de sesión.

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

## Estado de implementación

**🟢 Código implementado y deployment de Cloudflare exitoso — 2026-09-25.**

El release desplegado confirmó:

- D1 notification inbox y catch-up;
- NotificationHub Durable Object;
- WebSocket Hibernation;
- Queue dedicada `ecommerce-iphone-notifications`;
- DLQ `ecommerce-iphone-notifications-dlq`;
- retry y clasificación de fallos;
- persistencia D1 de dead letters;
- replay administrativo auditado;
- preferencias de canal;
- delivery ledger;
- idempotencia;
- APIs customer/technician/admin;
- frontend de bandeja/notificaciones;
- integración Resend.

El build pasó TypeScript/lint, generación de 110 páginas, OpenNext bundle y Wrangler deploy. Cloudflare reportó los bindings de Queue, DLQ y Durable Object y finalizó con `Success! Build completed.`

## Certificación pendiente

La implementación de código no se confunde con certificación. Continúan pendientes:

- migraciones D1 remotas verificadas;
- pruebas E2E de desconexión/catch-up;
- autorización customer/technician/admin con identidades reales;
- deduplicación e idempotencia bajo concurrencia;
- retry/DLQ/replay reales;
- pruebas de carga realtime/Queue;
- métricas/alertas p95/p99;
- `verify:production` y evidencia funcional productiva.

El deployment exitoso constituye evidencia de integración del release, no evidencia por sí solo de todos los escenarios funcionales anteriores.

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

Pendiente: build/deploy/verify, validación visual y funcional en producción y certificación final de `/technician/login`, `/technician`, `/technician/orders`, `/technician/devices` y `/technician/profile`.

## Evidencia operativa actual — 2026-09-21

`main` contiene ahora los cierres de código de Fase 06 integrados por PR #13 y PR #14. La certificación productiva del nuevo estado todavía no se infiere automáticamente: debe existir un build/deploy Cloudflare posterior al commit `79f1d7afd63d6ebcdd3a49a2176d576caf16be02`, seguido de los health checks, `verify:production` y `verify:admin:production`.

Los runs 1074–1080 de `Cloudflare Production Deploy` corresponden a evidencia histórica anterior a estos cambios y no deben usarse como prueba del estado actual ni como prueba de fallo del código nuevo.

El chequeo estático actual de las 9 rutas HTTP del bounded context `technicians` no encuentra imports directos de infraestructura, dominio interno, runtime adapters Cloudflare ni SQL. Esto confirma el boundary arquitectónico del código, pero no sustituye el gate de CI/build/deploy.

El Worker publicado tampoco se considera verificado desde este entorno porque el endpoint productivo no es accesible al mecanismo externo disponible. En consecuencia, Fase 06 sigue en 🟡 hasta obtener evidencia productiva del nuevo release; las certificaciones de Fase 01/02/03/04/05 tampoco se derivan de estos cambios.

### Evidencia adicional de build — 2026-09-21 22:58 UTC

El build Cloudflare más reciente proporcionado durante la auditoría compiló Next.js correctamente y falló posteriormente en typecheck en `modules/repairs/application/RepairOrderManagement.ts:102`. El error fue exactamente `exactOptionalPropertyTypes`: el use case construía un objeto con propiedades opcionales presentes como `undefined`. Se corrigió en Application mediante propagación condicional y se añadió un test de regresión. Este hallazgo reemplaza como bloqueo técnico activo al antiguo fallo de `StoreHeader`; el fallo de `StoreHeader` permanece únicamente como histórico ya corregido.
