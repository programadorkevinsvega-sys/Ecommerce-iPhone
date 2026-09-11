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
| 06 Admin + RBAC | 🟡 Implementada parcialmente | — | Backoffice restante |
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

Implementado parcialmente:

- AdminUser/AdminRole;
- RBAC;
- sesiones administrativas;
- PBKDF2-SHA256;
- fingerprinting;
- auditoría;
- permisos server-side;
- dashboard;
- users/resources/service types;
- `refunds:create`;
- `payments:void`;
- `services:read`;
- `services:write`;
- `service_types:write`.

Pendiente: backoffice completo de pagos, reviews, promociones, CMS/SEO, settings e inventario administrativo.

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
