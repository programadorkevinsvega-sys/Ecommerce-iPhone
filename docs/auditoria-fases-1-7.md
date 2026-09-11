# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD de código auditado:** `b33d941008b93607454d61071ddeeb569a1ff0e9`  
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
| 06 Admin + RBAC | 🟡 Implementación avanzada + hardening pendiente | Alta | Backoffice restante + seguridad + certificación |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

El trabajo actual corresponde **exclusivamente a Fase 05 Services**, según esta auditoría. No se usa el roadmap externo como fuente de alcance.

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
- pedidos autenticados filtrados por `customer_id`.

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

La Fase 05 de este documento define como base existente:

- `ServiceRequest`;
- `ServiceManagement`;
- Customer Portal;
- Service Workflow;
- Service Type repositories;
- persistencia D1;
- minimización de IMEI/serial;
- cierre de integraciones y operaciones administrativas.

El bounded context ya tenía Domain/Application/Infrastructure y migraciones `0004_services.sql`, `0005_service_types.sql` y `0006_configurable_service_requests.sql`.

## 7.2 Implementación completada

### Identidad y ownership del Customer Portal

- Se eliminó el uso del cookie `customer_id` como fuente de autoridad para operaciones de Services.
- `customer_session` se resuelve server-side mediante `CustomerSessionService` + `D1CustomerSessionRepository` + `WebCryptoCustomerSessionTokenGenerator`.
- `GET /api/services` obtiene el customer desde la sesión real.
- `POST /api/services` vincula el request al customer autenticado cuando existe sesión.
- `GET /api/services/:id` exige sesión y valida que el `customerId` persistido coincida con el customer autenticado.
- Un customer distinto recibe `404` y no obtiene información del request.

### Workflow y reglas de servicio

El workflow conserva las reglas en Application + Domain y ahora valida explícitamente la entrada administrativa:

- estados limitados al conjunto `ServiceRequestStatus`;
- estado solicitado validado antes de consultar/aplicar la política configurable;
- quote obligatorio y estrictamente positivo, entero seguro;
- asignación con `technicianId` no vacío y normalizado;
- finalización con notas obligatorias y límite de 4000 caracteres;
- transición efectiva siempre pasa por la máquina de estados del Domain;
- completion sigue condicionada por `allowedStatuses`;
- auditoría de actor en cada operación administrativa.

### Operaciones administrativas

Se añadieron endpoints protegidos por RBAC:

```text
GET  /api/admin/services
GET  /api/admin/services?status=PENDING
GET  /api/admin/services/:id
POST /api/admin/services/:id
```

El POST administrativo usa `action` y soporta:

```text
transition  { status }
quote       { amountInCents }
assign      { technicianId }
complete    { notes }
```

La lectura requiere `services:read`. Las mutaciones requieren `services:write`.

Todas las mutaciones pasan por `ServiceWorkflowService`; la ruta HTTP no modifica D1 directamente.

### Persistencia y auditoría

- `D1ServiceRequestRepository` filtra Customer Portal por `customer_id`.
- La consulta administrativa usa cola por estado y excluye estados terminales cuando no se proporciona filtro.
- Las operaciones del workflow registran `service_audit_events` con tipo de operación y `actorId`.
- Los datos de IMEI/serial se mantienen minimizados a últimos cuatro dígitos en el request.

### Tests agregados/endurecidos

Se cubren:

- ownership de Service Request;
- rechazo de acceso por customer diferente;
- acceso correcto del customer propietario;
- política de estados configurables;
- rechazo de quote cuando el tipo no requiere cotización;
- rechazo de quote cero/fraccionario;
- rechazo de completion cuando la política no permite `COMPLETED`;
- validación de notas vacías/excesivas;
- normalización de técnico;
- rechazo de estados arbitrarios.

## 7.3 Estado actual de Fase 05

**Código funcional + hardening de la Fase 05: implementado para el alcance definido en esta auditoría.**

Todavía **NO** se declara 100%, porque las evidencias operativas deben ejecutarse sobre este HEAD:

- `foundation:check`;
- `architecture:check`;
- format/lint/typecheck;
- tests unitarios;
- build Cloudflare limpio;
- deploy exclusivamente a producción;
- Customer Portal con sesión real;
- aislamiento entre dos customers;
- cola administrativa con roles autorizados/no autorizados;
- transition/quote/assign/complete contra D1 real;
- evidencia de `service_audit_events`;
- regresión de Payments/Commerce Core.

El workflow de producción asociado a un commit de esta iteración falló antes de ejecutar pasos del job y fue puesto nuevamente en ejecución; por ello no se interpreta ese fallo de infraestructura/runner como PASS ni como FAIL del código de Services. La certificación queda pendiente hasta obtener ejecución completa.

---

# 8. Admin + RBAC — FASE 06

## 8.1 Estado real después de auditoría de código

**🟡 Implementación avanzada + hardening pendiente + certificación pendiente.**

La revisión del `main` actual demuestra que la documentación anterior de F6 estaba incompleta. Existe una base administrativa considerable y no corresponde reconstruirla desde cero. El trabajo pendiente se divide entre hardening de lo existente y construcción de los módulos administrativos todavía ausentes.

## 8.2 Identidad administrativa

**🟢 Implementado**

`AdminUser` ya contempla identidad, email, password hash, rol, nombre/apellido, estado activo, contador de intentos fallidos, bloqueo temporal, último login y timestamps. `D1AdminRepository` proporciona persistencia D1 y operaciones de usuario/sesión/auditoría.

## 8.3 Roles y RBAC

**🟢 Base implementada**

Roles actuales:

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

Permisos actualmente identificados:

```text
dashboard:read
products:read
products:write
orders:read
orders:write
customers:read
services:read
services:write
refunds:create
payments:void
service_types:write
admins:manage
audit:read
inventory:write
```

Existe autorización server-side mediante `requireAdmin()` y permisos explícitos.

**Pendiente:** completar cobertura de recursos, revisar la matriz completa rol/permisión y ejecutar pruebas sistemáticas de privilege escalation vertical/horizontal.

## 8.4 Password security

**🟢 Implementado**

La implementación actual utiliza PBKDF2-SHA256 con salt aleatorio, derivación de clave, comparación segura y validación del formato del hash. Existe política de longitud de password administrativa.

**Pendiente:** pruebas exhaustivas, política de rotación/migración y verificación de que ningún flujo pueda persistir passwords sin pasar por el mecanismo de hashing.

## 8.5 Sesiones administrativas

**🟢 Implementado**

`admin_sessions` persiste token hash, expiración, revocación, admin user, IP fingerprint hash y user-agent fingerprint hash. La consulta exige sesión no revocada, no expirada y usuario activo. La cookie utiliza `HttpOnly`, `Secure`, `SameSite=Strict` y `Path=/`. Existen revocación individual y global.

**Pendiente:** pruebas reales de expiración, revocación, reutilización, session fixation/hijacking y comportamiento ante escenarios adversariales.

## 8.6 Login/logout/lockout

**🟢 Implementado**

El login administrativo real valida credenciales, aplica lockout, verifica password, registra intentos fallidos/exitosos, revoca sesiones anteriores, crea nueva sesión y audita el resultado.

**Pendiente:** certificación funcional en producción y pruebas de abuso/rate limiting.

## 8.7 Auditoría administrativa

**🟢 Infraestructura implementada / 🟡 consulta administrativa pendiente**

`admin_audit_log` persiste actor, acción, tipo de recurso, resource id, payload JSON e IP hash. Login/logout y operaciones administrativas ya generan eventos.

**Pendiente:** API/UI de consulta, filtros, paginación y verificación de cobertura completa de operaciones sensibles.

## 8.8 Backoffice existente

### Dashboard
**🟢 Implementado**

Existe endpoint administrativo de dashboard protegido por RBAC.

### Resources API
**🟡 Parcial**

Existe:

```text
GET   /api/admin/resources
POST  /api/admin/resources
PATCH /api/admin/resources
```

La capa genérica reconoce `products`, `customers`, `services` y `orders`. Actualmente existen operaciones para products/orders/services, pero esto no equivale a un backoffice completo de todos los recursos.

### Products
**🟡 Parcial**

Existe creación y edición administrativa con precio, stock, activo, SEO y atributos, además de auditoría.

Pendiente hardening de validación de todos los atributos, reglas de inventario/concurrencia y pruebas completas.

### Customers
**🟡 Parcial**

Existe `customers:read` y acceso administrativo de lectura.

Pendiente módulo completo de detalle, relaciones relevantes y acciones administrativas autorizadas.

### Orders
**🟡 Parcial**

Existe actualización administrativa de estados y auditoría/notificaciones.

Pendiente backoffice completo, state machine estricta, cancelación/refund coherentes con Payments, concurrencia, idempotencia y pruebas de escalamiento.

### Services
**🟢 Implementado**

F5 ya dejó implementado y endurecido el backoffice de Services: lectura, filtros, detalle, transition, quote, assign, complete, RBAC, auditoría y validación de transiciones de dominio.

### Service Types
**🟢 Implementado**

Existe gestión administrativa y permiso `service_types:write`.

Pendiente incluirlo en la matriz completa de pruebas RBAC de F6.

## 8.9 Módulos pendientes de F6

### Gestión de administradores
**🔴 Pendiente**

Debe cerrarse el backoffice para listar/detallar admins, crear, activar/desactivar, cambiar rol, reset/cambio de password, revocar sesiones, revocar todas las sesiones y auditar cada operación. Debe proteger especialmente `SUPER_ADMIN`.

### Payments
**🟡 Base existente, backoffice incompleto**

Debe cerrarse listado/búsqueda, detalle, estado, provider/reference, operaciones administrativas permitidas, conciliación cuando corresponda, auditoría, RBAC, idempotencia y concurrencia.

### Refunds
**🟡 Base existente, backoffice incompleto**

Existe `refunds:create` y funcionalidad previa. Falta cerrar endpoint administrativo, autorización, validación de estado, idempotencia, concurrencia, auditoría, integración orden/payment y pruebas negativas.

### Void
**🟡 Base de autorización existente, flujo incompleto**

Existe `payments:void`. Falta cerrar endpoint, state machine, validación del payment, idempotencia, auditoría, RBAC y regresión.

### Inventory
**🟡 Parcial**

Existe `inventory:write`, pero falta backoffice completo para stock, ajustes, movimientos, motivo, actor, auditoría, prevención de stock negativo y concurrencia/atomicidad.

### Reviews
**🔴 Pendiente**

Falta módulo de lectura, moderación, ocultación/eliminación, restauración cuando corresponda, auditoría y RBAC.

### Promotions
**🔴 Pendiente**

Falta módulo de promociones/cupones: CRUD, reglas de descuento, vigencia, límites de uso, activación/desactivación, validación server-side, auditoría y RBAC.

### CMS / SEO
**🔴 Pendiente**

Los campos SEO existentes en productos no constituyen CMS/SEO completo. Falta configuración SEO global, contenido administrativo, metadata, canonical/redirect rules cuando correspondan, contenido editable, auditoría y RBAC.

### Settings
**🔴 Pendiente**

Falta módulo de settings con lectura, escritura, validación por tipo, permisos explícitos, auditoría, protección de valores sensibles e historial cuando sea necesario.

### Audit Viewer
**🟡 Pendiente**

La infraestructura de auditoría existe, pero falta API/UI para filtrar por actor, acción, recurso, resource id y rango temporal, con paginación y protección `audit:read`.

## 8.10 Requisitos transversales de F6

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

- [ ] state machines respetadas;
- [ ] no bypass de métodos de dominio;
- [ ] idempotencia en operaciones sensibles;
- [ ] concurrencia en stock/payments/orders;
- [ ] auditoría atómica donde corresponda.

### Arquitectura

- [ ] DDD + Clean Architecture;
- [ ] Presentation sin lógica de negocio;
- [ ] Application/use cases para operaciones administrativas;
- [ ] invariantes en Domain;
- [ ] Infrastructure aislada mediante ports/repositories;
- [ ] evitar `AdminResources` como God Service;
- [ ] separar capacidades administrativas por bounded context cuando corresponda;
- [ ] conservar módulos separables a futuro.

### Tests

- [ ] unit tests;
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

## 8.11 Criterio de cierre F6

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

# 12. Orden inmediato después de Fase 05

1. Ejecutar batería de tests del HEAD actual.
2. `architecture:check` + lint + typecheck.
3. `build:cloudflare`.
4. Deploy únicamente a producción.
5. `verify:production`.
6. Certificar Customer Portal y ownership real.
7. Certificar operaciones administrativas y RBAC por rol.
8. Verificar auditoría de Services en D1.
9. Ejecutar regresión de Commerce/Payments.
10. Actualizar esta auditoría con commit y evidencia.
11. Solo entonces declarar Fase 05 certificada.

**Regla permanente:** este documento debe actualizarse en la misma iteración de cada cambio relevante de código.
