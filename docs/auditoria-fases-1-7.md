# Auditoría viva — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD auditado:** `499ef7ac4583a8515be0711ea61d67c882f8758a`  
**Última actualización:** 2026-09-12/13 UTC  
**Entorno remoto operativo:** producción únicamente.

> Una fase no se declara 100% por compilar. El cierre exige código, pruebas, seguridad, reproducibilidad, deploy y evidencia operativa.

---

# 1. Estado

| Fase | Estado | Certificación |
|---|---|---|
| 01 Foundation | 🟢 Implementada | Pendiente auditoría final |
| 02 Storefront | 🟢 Implementada | Pendiente E2E/performance/accessibility |
| 03 Commerce Core | 🟢 Implementación cerrada | Pendiente certificación exhaustiva en producción |
| 04 Payments | 🟡 Implementada + hardening | Pendiente certificación real de proveedores |
| 05 Services | 🟢 Implementación + hardening | Pendiente gates/certificación |
| 06 Admin + RBAC | 🟡 Application consolidada + hardening | Pendiente build/tests/gates |
| 07 Notifications + Queues | 🟡 Parcial | DLQ/retry/replay pendiente |

El trabajo reciente corresponde al cierre arquitectónico y hardening de **Fase 06**.

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

---

# 3. Foundation

Implementado: monorepo modular, DDD + Clean Architecture, bounded contexts, D1/R2/Queues, OpenNext + Workers, cron, observabilidad, health live/ready, rate limiting, request-id, security headers y enforcement arquitectónico.

## Reproducibilidad

- Node `24.18.0`.
- pnpm `10.15.0`.
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

# 9. Notifications + Queues — FASE 07

Implementado: notification ports, NotificationService, templates, D1 outbox/deliveries, Resend, Queue, cron, IDs deterministas, claim atómico de deliveries/outbox.

Pendiente: DLQ explícita, retry definitivo, replay y auditoría de fallos terminales.

---

# 10. Gates transversales restantes

## Reproducibilidad

- [x] lockfile versionado;
- [x] frozen install;
- [x] Node `24.18.0`;
- [x] pnpm `10.15.0`;
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

1. build de producción posterior a F6;
2. corregir errores reales de TypeScript/imports/arquitectura;
3. foundation:check + architecture:check;
4. tests Application/Domain/RBAC/auth/audit;
5. IDOR/BOLA + privilege escalation;
6. concurrencia/idempotencia crítica;
7. regresión Payments/Commerce/Services/Inventory;
8. deploy production;
9. health + verify:production;
10. certificación F6 con evidencia exacta.

**Regla permanente:** este documento debe actualizarse en la misma iteración de cada cambio relevante de código.
