# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD de código auditado:** `28385e7d3109c199ae5ca93f89ae30b93229ff59`  
**Última actualización:** 2026-09-11  
**Entorno operativo:** **producción únicamente**.

> Esta auditoría es la fuente de verdad del roadmap de implementación. Una fase solo puede declararse 100% cuando código, pruebas, seguridad, reproducibilidad y evidencia operativa de su alcance estén cerrados. Compilar o tener CI verde no equivale a certificación.

---

# 1. Estado de cierre

| Fase | Estado | Cierre de código | Certificación final |
|---|---|---:|---:|
| 01 Foundation | 🟢 Implementada | Alta | Pendiente reproducibilidad + auditoría final |
| 02 Storefront | 🟢 Implementada | Alta | Pendiente E2E/performance/accessibility |
| 03 Commerce Core | 🟢 Implementada | 100% | Pendiente certificación funcional exhaustiva contra producción |
| 04 Payments | 🟡 Implementada — hardening técnico + deploy aplicado | Alta | Pendiente certificación funcional manual de proveedores |
| 05 Services | 🟡 Implementación funcional + hardening cerrados | Alta | Pendiente gates automatizados + certificación funcional producción |
| 06 Admin + RBAC | 🟡 Implementación avanzada + hardening en curso | Alta | Seguridad + módulos restantes + certificación |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

El trabajo actual corresponde a **Fase 06 Admin + RBAC**. La auditoría se mantiene sincronizada con los cambios de código relevantes y no usa el roadmap externo como fuente de alcance.

---

# 2. Política de arquitectura y entornos

```text
HTTP / Next.js Route
        ↓
Presentation
        ↓
Application / Use Case
        ↓
Domain
        ↑
Ports
        ↑
Infrastructure / Adapters
        ↓
Cloudflare / D1 / R2 / Queue
```

Reglas obligatorias:

- Presentation no ejecuta SQL/D1.
- Presentation no importa Infrastructure directamente salvo composition roots autorizados.
- Application no depende de Next.js, Cloudflare o Infrastructure.
- Domain no depende de frameworks ni proveedores.
- Infrastructure implementa puertos internos.
- `architecture:check` es el enforcement automático.
- Cada bounded context conserva Domain/Application/Infrastructure separados.

## Entornos

Existe **un único entorno Cloudflare remoto: producción**. El desarrollo local puede usar Next.js, Vitest, Playwright y D1 local/emulado; esto no constituye un entorno operativo adicional.

---

# 3. Foundation

Implementado:

- monorepo modular;
- DDD + Clean Architecture;
- bounded contexts;
- D1/R2/Queues;
- OpenNext + Workers;
- cron;
- observabilidad;
- rate limiting;
- health live/ready;
- request-id;
- headers de seguridad;
- enforcement arquitectónico.

Reproducibilidad todavía no está cerrada: `package.json` fija `pnpm@10.15.0`, pero falta versionar `pnpm-lock.yaml` y exigir `pnpm install --frozen-lockfile`.

Último deploy productivo confirmado el 2026-09-11: build Cloudflare, TypeScript/lint, generación estática, OpenNext, migraciones, Worker deploy, health live/ready y `verify:production` PASS. El smoke de rate-limit emitió warning al no observar 429 después de 21 requests; queda como validación específica de abuso.

---

# 4. Storefront Premium

Implementado:

- catálogo D1;
- búsqueda, filtros, ordenamiento y paginación;
- detalle por slug y variantes;
- reviews, FAQ y relacionados;
- galería responsive;
- inventario;
- SEO metadata, canonical/Open Graph, JSON-LD;
- sitemap/robots;
- separación Domain/Application/Infrastructure.

Pendiente de certificación completa: E2E, accesibilidad, LCP/CLS reales, SEO en URLs reales, regresiones responsive y cobertura exhaustiva de filtros/variantes/agotados.

---

# 5. Commerce Core — implementación cerrada

Implementado y endurecido:

- sesión `customer_session` HttpOnly, SameSite lax y Secure en producción;
- identidad server-side y revocación;
- carrito guest y claim ownership;
- ownership de carrito/customer;
- `Idempotency-Key` obligatoria en checkout;
- precios recalculados server-side;
- producto/variante activa verificados;
- decremento atómico de stock con `stock >= quantity`;
- batch D1 transaccional;
- order `PENDING_PAYMENT`;
- reservas de inventario con expiración de 15 minutos;
- release/consume idempotentes;
- scheduler de expiraciones;
- pedidos autenticados filtrados por `customer_id`;
- promociones calculadas server-side y consumidas atómicamente dentro del checkout.

La certificación funcional exhaustiva contra producción permanece separada de la implementación.

---

# 6. Payments — FASE 04

## 6.1 Código

Implementado:

- aggregate Payment y state machine;
- invariantes amount/currency;
- PaymentRepository y PaymentProviderPort;
- Wompi, Stripe, Mercado Pago, PayPal y Binance Pay;
- recovery y correlación de transacciones;
- verificadores específicos de webhook;
- deduplicación y manejo out-of-order;
- ledger y reconciliation;
- idempotencia de intent/webhook/refund;
- ownership server-side;
- refund persistido y reconciliación cuando el provider lo soporta;
- lock atómico contra refunds concurrentes con distintas idempotency keys;
- void administrativo para providers que lo soportan;
- RBAC para refund/void.

## 6.2 Persistencia

`0017_payment_refunds.sql` y `0018_payment_refund_locks.sql` están versionadas. El último deploy confirmado informó `No migrations to apply!`, por lo que las migraciones pendientes de Payments ya no constituyen un bloqueo de despliegue.

## 6.3 Estado de certificación

El último build/deploy productivo de Payments fue exitoso: Worker desplegado, health live/ready PASS y `verify:production` PASS. La certificación funcional real queda deliberadamente pendiente de la verificación manual del usuario con credenciales/webhooks productivos:

- pago aprobado real;
- pago rechazado/cancelado;
- reserva consumida/liberada una sola vez;
- webhook duplicado/out-of-order;
- amount/currency/reference manipulado;
- refund/void real según capacidad del provider.

**No se declara Fase 04 100% hasta cerrar esa evidencia manual.**

---

# 7. Services — FASE 05

## 7.1 Alcance exacto de la auditoría

La Fase 05 define como base existente `ServiceRequest`, `ServiceManagement`, Customer Portal, Service Workflow, Service Type repositories, persistencia D1, minimización de IMEI/serial y operaciones administrativas.

## 7.2 Implementación completada

### Identidad y ownership

- Customer Portal usa `customer_session` server-side.
- `GET /api/services` obtiene el customer desde la sesión real.
- `POST /api/services` vincula el request al customer autenticado cuando existe sesión.
- `GET /api/services/:id` exige sesión y valida ownership; un customer distinto recibe `404`.

### Workflow y operaciones administrativas

- estados limitados a `ServiceRequestStatus`;
- quote positivo y entero seguro;
- asignación con `technicianId` normalizado;
- completion con notas obligatorias y límite de 4000 caracteres;
- transición mediante la máquina de estados del Domain;
- auditoría de actor en cada operación administrativa;
- endpoints protegidos por `services:read`/`services:write`.

### Persistencia y auditoría

- `D1ServiceRequestRepository` filtra Customer Portal por `customer_id`;
- operaciones del workflow registran `service_audit_events`;
- IMEI/serial se mantienen minimizados a últimos cuatro dígitos.

### Tests

Se cubren ownership, rechazo de customer diferente, acceso del propietario, políticas de estado, quote, completion, notas, técnico y estados arbitrarios.

## 7.3 Estado actual de Fase 05

Código funcional + hardening implementado para el alcance definido. La certificación 100% permanece pendiente de gates y evidencia funcional de producción: checks técnicos, tests, Customer Portal con sesión real, aislamiento entre customers, operaciones administrativas contra D1 real, evidencia de auditoría y regresión de Payments/Commerce Core.

---

# 8. Admin + RBAC — FASE 06

## 8.1 Estado real

**🟡 Implementación avanzada + hardening en curso + certificación pendiente.**

Existe una base administrativa considerable. El trabajo actual prioriza cierre de integridad de dominio, autorización, ownership/IDOR, idempotencia, concurrencia, auditoría y pruebas antes de declarar F6 completa.

## 8.2 Identidad administrativa

**🟢 Implementado**

`AdminUser` contempla identidad, email, password hash, rol, estado activo, intentos fallidos, bloqueo temporal, último login y timestamps. `D1AdminRepository` proporciona persistencia de usuario/sesión/auditoría.

## 8.3 Roles y RBAC

**🟢 Base implementada / 🟡 certificación pendiente**

Roles:

```text
SUPER_ADMIN
ADMIN
MANAGER
SALES
SUPPORT
INVENTORY
FINANCE
CONTENT_EDITOR
TECHNICIAN
```

Existe autorización server-side mediante `requireAdmin()` y permisos explícitos.

Pendiente: matriz completa rol/permisión, pruebas sistemáticas de privilege escalation vertical/horizontal y revisión de todas las rutas administrativas.

## 8.4 Password security

**🟢 Implementado / 🟡 pruebas pendientes**

PBKDF2-SHA256 con salt aleatorio, derivación de clave, comparación segura y política de longitud administrativa.

Pendiente: pruebas exhaustivas, rotación/migración y verificación de que ningún flujo pueda persistir passwords sin hashing.

## 8.5 Sesiones administrativas

**🟢 Implementado / 🟡 certificación pendiente**

`admin_sessions` almacena token hash, expiración, revocación, admin user, fingerprints hash. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`. Existe revocación individual y global.

Pendiente: expiración, revocación, reutilización, session fixation/hijacking y abuso/rate limiting.

## 8.6 Login/logout/lockout

**🟢 Implementado / 🟡 certificación pendiente**

Login real valida credenciales, aplica lockout, verifica password, registra intentos, revoca sesiones anteriores, crea nueva sesión y audita.

## 8.7 Auditoría administrativa

**🟢 Infraestructura + viewer implementados / 🟡 cobertura pendiente**

`admin_audit_log` persiste actor, acción, recurso, resource id, payload JSON e IP hash. Existe API administrativa de consulta con filtros/paginación y permiso `audit:read`.

Pendiente: verificar cobertura de todas las operaciones sensibles y ausencia de secretos en payloads/auditoría.

## 8.8 Backoffice implementado

- Dashboard: **🟢**
- Services: **🟢**
- Service Types: **🟢**
- Promotions: **🟢 implementado administrativamente + integración server-side con checkout desplegada; certificación funcional pendiente**
- CMS/SEO: **🟢 administración implementada; consumo público/integración y certificación pendientes**
- Inventory: **🟡 parcial, con ajustes idempotentes y actualización atómica de stock**
- Products: **🟡 parcial**
- Customers: **🟡 parcial**
- Orders: **🟡 parcial**
- Payments: **🟡 base + endpoints administrativos; certificación pendiente**
- Refunds: **🟡 base + endpoint; certificación de estado/idempotencia/concurrencia pendiente**
- Void: **🟡 base + endpoint; certificación pendiente**
- Reviews: **🟢 administración implementada; certificación pendiente**
- Settings: **🟢 administración implementada; certificación pendiente**
- Admin management: **🟢 lifecycle hardening implementado; certificación pendiente**

## 8.9 Hardening realizado en esta iteración — Checkout / Orders

### State machine de pedidos

Se corrigió un bypass de integridad: `D1OrderRepository.transitionStatus()` actualizaba el estado sin invocar la máquina de estados de Domain.

Ahora:

- `assertOrderTransition()` se ejecuta antes de cualquier mutación;
- estados desconocidos o saltos arbitrarios son rechazados;
- estados terminales (`CANCELLED`, `REFUNDED`) no pueden resucitar;
- la actualización de estado y `OrderStatusChanged` se ejecutan en un único `D1.batch`, evitando un estado persistido sin su evento de auditoría de dominio;
- la condición `WHERE status=?` mantiene la transición compare-and-set contra carreras concurrentes.

### Tests

El test de `Order` cubre:

- progresión válida de pago;
- rechazo de resurrección de estados terminales;
- rechazo de saltos arbitrarios.

### Checkout ya endurecido previamente

El checkout actual mantiene:

- `Idempotency-Key` obligatoria;
- lookup de idempotencia antes del trabajo;
- resolución server-side de precios;
- validación de producto/variante activa;
- decremento atómico de stock dentro del batch;
- reservas de 15 minutos dentro de la misma transacción;
- promociones server-side con incremento de uso condicionado y atómico;
- recuperación de una carrera de idempotencia devolviendo el pedido ya creado al mismo customer;
- aislamiento del `Idempotency-Key` frente a otro customer.

### Ownership

Carritos autenticados se reclaman con una condición de escritura que solo permite `customer_id IS NULL` o el mismo customer. Un carrito perteneciente a otro customer no puede ser reclamado. Los pedidos se consultan filtrados por `customer_id` y el endpoint de detalle resuelve el customer desde `customer_session`, devolviendo `404` si no existe ownership.

### Guest vs autenticado

El carrito puede existir como guest, pero el checkout exige `customerId` autenticado. Por tanto, el comportamiento actual es explícito: **guest cart → login/customer session → claim ownership → checkout**. No se permite crear pedidos anónimos mediante el endpoint de checkout.

## 8.10 Pendientes inmediatos de F6

1. concurrencia de stock durante checkout y reservas/rollback;
2. idempotencia completa del checkout, incluyendo escenarios de carrera y expiración;
3. ownership/IDOR/BOLA de carrito y pedidos mediante tests de dos customers;
4. certificación guest vs autenticado;
5. state machines de Order + Payment y coherencia entre ambas;
6. refund/void: idempotencia, concurrencia, state machine y auditoría;
7. tests de privilege escalation vertical/horizontal para toda la matriz RBAC;
8. tests de sesión administrativa, abuso y rate limiting;
9. tests críticos de auditoría y no exposición de secretos;
10. integración/regresión real de Payments, Commerce Core, Services e Inventory;
11. gates técnicos y certificación exclusiva en producción;
12. actualizar este documento con cada cambio relevante y con SHA/evidencia de cada certificación.

## 8.11 Requisitos transversales de F6

### RBAC

- [ ] matriz completa rol/permisión;
- [ ] denegación por defecto;
- [ ] todas las rutas sensibles protegidas server-side;
- [ ] ningún admin_id/rol/permiso confiado desde el cliente;
- [ ] tests de privilege escalation vertical;
- [ ] tests de privilege escalation horizontal;
- [ ] tests por recurso.

### Sesiones

- [ ] login real;
- [ ] logout real;
- [ ] expiración real;
- [ ] revocación real;
- [ ] revocación global;
- [ ] session fixation/hijacking;
- [ ] fingerprint behavior;
- [ ] rate limiting/abuse protection.

### APIs

- [ ] IDOR/BOLA;
- [ ] input validation;
- [ ] error mapping seguro;
- [ ] operaciones destructivas protegidas;
- [ ] CSRF/cookie security validado;
- [ ] no exposición de secretos;
- [ ] no bypass mediante rutas genéricas.

### Integridad

- [x] state machine de Order aplicada server-side;
- [x] transición y evento de Order atómicos;
- [ ] idempotencia completa del checkout certificada;
- [ ] concurrencia stock/payments/orders certificada;
- [ ] auditoría atómica de todas las operaciones sensibles.

### Arquitectura

- [ ] DDD + Clean Architecture auditado transversalmente;
- [ ] Presentation sin lógica de negocio;
- [ ] Application/use cases para operaciones administrativas;
- [ ] invariantes en Domain;
- [ ] Infrastructure aislada mediante ports/repositories;
- [ ] evitar `AdminResources` como God Service;
- [ ] separar capacidades administrativas por bounded context cuando corresponda;
- [ ] conservar módulos separables a futuro.

### Tests

- [x] tests de state machine de Order;
- [ ] integration tests D1;
- [ ] RBAC matrix tests;
- [ ] authentication tests;
- [ ] session tests;
- [ ] audit tests;
- [ ] IDOR/BOLA tests;
- [ ] negative authorization tests;
- [ ] orders regression;
- [ ] payments/refunds/void regression;
- [ ] services regression;
- [ ] inventory concurrency tests.

### Gates técnicos

- [ ] `foundation:check`;
- [ ] `architecture:check`;
- [ ] format;
- [ ] lint;
- [ ] typecheck;
- [ ] unit tests;
- [ ] integration tests relevantes;
- [ ] Cloudflare build reproducible;
- [ ] migrations production;
- [ ] deploy production;
- [ ] `/api/health/live`;
- [ ] `/api/health/ready`;
- [ ] `verify:production`.

### Certificación funcional final

- [ ] login administrativo real;
- [ ] RBAC real con varios roles;
- [ ] operaciones permitidas/denegadas;
- [ ] gestión de admins;
- [ ] orders;
- [ ] payments;
- [ ] refunds;
- [ ] void;
- [ ] inventory;
- [ ] services;
- [ ] service types;
- [ ] reviews;
- [ ] promotions;
- [ ] CMS/SEO;
- [ ] settings;
- [ ] audit viewer;
- [ ] regression Commerce/Payments.

## 8.12 Criterio de cierre F6

F6 solo podrá cambiar a **🟢 100% COMPLETA** cuando todos los módulos pendientes estén implementados, los existentes estén endurecidos, la matriz RBAC esté probada, autenticación/sesiones estén certificadas, no existan bypasses de autorización, las operaciones críticas tengan auditoría, pasen tests unitarios/integración/seguridad, pasen `foundation:check` y `architecture:check`, pase el build reproducible de Cloudflare, se despliegue en producción, pasen health checks y `verify:production`, se certifiquen funcionalmente todos los módulos administrativos y no existan regresiones en Commerce/Payments/Fases anteriores.

**Estado de cierre actual: 🟡 NO CERTIFICADA.**

---

# 9. Notifications + Queues — FASE 07

Implementado:

- notification ports;
- NotificationService;
- templates;
- D1 outbox/deliveries;
- Resend provider;
- Queue;
- cron;
- IDs deterministas para eventos de pedido;
- claim atómico de deliveries/outbox.

Pendiente:

- DLQ explícita;
- política definitiva de retry;
- replay/auditoría de fallos terminales.

---

# 10. Gates transversales restantes

## Reproducibilidad

- [ ] versionar `pnpm-lock.yaml`;
- [ ] `pnpm install --frozen-lockfile`;
- [ ] fijar runtime Node del build;
- [ ] build limpio reproducible.

## Seguridad

- [ ] auditoría exhaustiva de todas las APIs;
- [ ] validación de input completa;
- [ ] autorización server-side completa;
- [ ] revisión CORS/Origin;
- [ ] revisión CSRF donde corresponda;
- [ ] headers;
- [ ] secrets/dependencias;
- [ ] abuso/rate-limit;
- [ ] regresiones de seguridad.

Estos gates no se convierten en PASS por documentación.

---

# 11. Criterio de cierre

Para cada fase:

```text
Código
  +
Pruebas
  +
Seguridad
  +
Reproducibilidad
  +
Deploy cuando aplique
  +
Verificación de producción
  =
100%
```

No se usa `compila = 100%`, `CI verde = 100%` ni `documentado = 100%`.

---

# 12. Orden inmediato de Fase 06

1. concurrencia de stock + reservas/rollback;
2. idempotencia completa del checkout;
3. ownership/IDOR/BOLA de carritos y pedidos;
4. guest vs autenticado;
5. state machines Order/Payment;
6. refund/void idempotencia + concurrencia;
7. tests críticos RBAC/sesiones/auditoría;
8. gates técnicos;
9. deploy exclusivamente a producción;
10. certificación funcional;
11. actualizar esta auditoría con commit, SHA y evidencia.

**Regla permanente:** este documento debe actualizarse en la misma iteración de cada cambio relevante de código.
