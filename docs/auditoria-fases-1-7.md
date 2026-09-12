# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD de código auditado:** `e86d4d1e93298b632925a1cf9d751ad60b6638d8`  
**Última actualización:** 2026-09-12  
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

Implementado: monorepo modular, DDD + Clean Architecture, bounded contexts, D1/R2/Queues, OpenNext + Workers, cron, observabilidad, rate limiting, health live/ready, request-id, headers de seguridad y enforcement arquitectónico.

Reproducibilidad todavía no está cerrada: `package.json` fija `pnpm@10.15.0`, pero falta versionar `pnpm-lock.yaml` y exigir `pnpm install --frozen-lockfile`.

Último deploy productivo confirmado el 2026-09-11: build Cloudflare, TypeScript/lint, generación estática, OpenNext, migraciones, Worker deploy, health live/ready y `verify:production` PASS. El smoke de rate-limit emitió warning al no observar 429 después de 21 requests; queda como validación específica de abuso.

---

# 4. Storefront Premium

Implementado: catálogo D1; búsqueda, filtros, ordenamiento y paginación; detalle por slug y variantes; reviews, FAQ y relacionados; galería responsive; inventario; SEO metadata, canonical/Open Graph, JSON-LD; sitemap/robots; separación Domain/Application/Infrastructure.

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

Implementado: aggregate Payment y state machine; invariantes amount/currency; PaymentRepository y PaymentProviderPort; Wompi, Stripe, Mercado Pago, PayPal y Binance Pay; recovery/correlación; verificadores específicos de webhook; deduplicación/out-of-order; ledger/reconciliation; idempotencia de intent/webhook/refund; ownership server-side; refund persistido y reconciliación cuando el provider lo soporta; lock atómico contra refunds concurrentes; void administrativo donde corresponde; RBAC para refund/void.

## 6.2 Persistencia

`0017_payment_refunds.sql` y `0018_payment_refund_locks.sql` están versionadas. El último deploy confirmado informó `No migrations to apply!`.

## 6.3 Certificación

Deploy productivo exitoso, health live/ready PASS y `verify:production` PASS. Continúa pendiente evidencia manual con proveedores productivos: aprobado/rechazado, webhook duplicado/out-of-order, manipulación amount/currency/reference, refund/void real y reservas consumidas/liberadas una sola vez.

---

# 7. Services — FASE 05

## 7.1 Implementación

Customer Portal usa sesión server-side y ownership por `customer_id`; el detalle de un request de otro customer responde `404`. Workflow y operaciones administrativas validan estados, quote, técnico, completion y notas. Mutaciones usan RBAC y auditan `actorId`. IMEI/serial se minimizan.

## 7.2 Tests

Se cubren ownership, rechazo de customer diferente, acceso del propietario, políticas de estado, quote, completion, notas, técnico y estados arbitrarios.

## 7.3 Certificación

Código funcional + hardening implementado para el alcance definido. Certificación 100% pendiente de gates técnicos y evidencia funcional de producción: sesión real, aislamiento, operaciones D1, auditoría y regresión de Payments/Commerce Core.

---

# 8. Admin + RBAC — FASE 06

## 8.1 Estado real

**🟡 Implementación avanzada + hardening en curso + certificación pendiente.**

Existe una base administrativa considerable. El trabajo actual prioriza cierre de integridad de dominio, autorización, ownership/IDOR, idempotencia, concurrencia, auditoría y pruebas antes de declarar F6 completa.

## 8.2 Identidad administrativa

**🟢 Implementado** — `AdminUser`, `D1AdminRepository`, sesiones, lockout y lifecycle administrativo.

## 8.3 Roles y RBAC

**🟢 Base implementada / 🟡 certificación pendiente**

Roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, `SUPPORT`, `INVENTORY`, `FINANCE`, `CONTENT_EDITOR`, `TECHNICIAN`.

Existe autorización server-side mediante `requireAdmin()` y permisos explícitos. Pendiente matriz completa rol/permisión y pruebas sistemáticas de privilege escalation vertical/horizontal.

## 8.4 Password security

**🟢 Implementado / 🟡 pruebas pendientes** — PBKDF2-SHA256, salt aleatorio, derivación de clave, comparación segura y política de longitud administrativa.

## 8.5 Sesiones administrativas

**🟢 Implementado / 🟡 certificación pendiente** — token hash, expiración, revocación, fingerprints hash y cookie `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`. Pendientes pruebas adversariales y abuso/rate limiting.

## 8.6 Login/logout/lockout

**🟢 Implementado / 🟡 certificación pendiente** — credenciales, lockout, intentos, revocación de sesiones previas, creación de sesión y auditoría.

## 8.7 Auditoría administrativa

**🟢 Infraestructura + viewer implementados / 🟡 cobertura pendiente** — `admin_audit_log`, API de consulta, filtros/paginación y permiso `audit:read`. Pendiente comprobar cobertura total y ausencia de secretos en payloads.

## 8.8 Backoffice

- Dashboard: **🟢**
- Services / Service Types: **🟢**
- Promotions: **🟢 administración + integración server-side con checkout desplegada; certificación funcional pendiente**
- CMS/SEO: **🟢 administración implementada; consumo/integración pendiente**
- Inventory: **🟡 parcial, con ajustes idempotentes y stock atómico**
- Products / Customers / Orders: **🟡 parcial**
- Payments / Refunds / Void: **🟡 base + endpoints; certificación de estado/idempotencia/concurrencia pendiente**
- Reviews / Settings: **🟢 administración implementada; certificación pendiente**
- Admin management: **🟢 lifecycle hardening implementado; certificación pendiente**

## 8.9 Hardening realizado — Orders / Checkout

### State machine de pedidos

Se corrigió un bypass de integridad en `D1OrderRepository.transitionStatus()`.

Ahora:

- `assertOrderTransition()` se ejecuta antes de cualquier mutación;
- estados desconocidos y saltos arbitrarios son rechazados;
- `CANCELLED` y `REFUNDED` no pueden resucitar;
- actualización y `OrderStatusChanged` se ejecutan en un único `D1.batch`;
- `WHERE status=?` mantiene compare-and-set contra carreras concurrentes.

### Integración atómica Order ↔ reservas — hardening cerrado en código

La transición de estado ya no depende de que otro servicio/repository invoque posteriormente `D1ReservationRepository` para liquidar reservas. `D1OrderRepository.transitionStatus()` integra la liquidación en el mismo `D1.batch` de la transición.

Para `PAID`:

- la transición exige al menos una reserva activa del pedido;
- se rechaza si existe cualquier reserva activa ya expirada;
- el evento `OrderStatusChanged` se inserta inmediatamente después del CAS del pedido;
- el settlement de reservas está vinculado al `eventId` de esa transición, por lo que una carrera cuyo CAS pierda no puede liberar/consumir stock;
- las reservas activas se marcan consumidas/liberadas sin devolver stock;
- si cualquier sentencia del batch falla, toda la transición se revierte.

Para `CANCELLED`:

- el CAS del pedido ocurre primero;
- `OrderStatusChanged` queda inmediatamente después del CAS;
- el incremento de stock y la liberación de reservas solo pueden ejecutarse si existe el `eventId` creado por ese CAS exitoso;
- las reservas activas y no expiradas devuelven su cantidad al stock dentro del mismo batch;
- esas reservas se marcan liberadas dentro del mismo batch;
- las reservas ya expiradas no vuelven a incrementar stock, evitando doble restitución con el scheduler de expiración.

Esto elimina el hueco donde el pedido podía cambiar de estado pero su reserva quedar sin consumir/liberar, y elimina el uso incorrecto de `changes()` después de una sentencia de inventario intermedia. También cierra la carrera en la que dos cancelaciones concurrentes podían pasar a la fase de settlement después de que solo una ganara el CAS.

**Commits de implementación:**
- `90ec699d6c714e64a659e41df5aa478c87972166` — integración Order ↔ reservas.
- `e86d4d1e93298b632925a1cf9d751ad60b6638d8` — vinculación del settlement al evento de transición ganadora.

La certificación mediante tests D1/concurrencia y producción todavía está pendiente; este cambio se considera **cierre de implementación**, no certificación 100%.

### Checkout

Se mantiene:

- idempotencia obligatoria;
- precios server-side;
- producto/variante activa;
- stock decrementado atómicamente;
- reservas de 15 minutos dentro del batch;
- promociones server-side y uso condicionado atómicamente;
- recuperación de carreras de idempotencia para el mismo customer;
- aislamiento del `Idempotency-Key` entre customers.

### Ownership / IDOR

El claim de carrito solo permite `customer_id IS NULL` o el mismo customer. Un carrito de otro customer no puede ser reclamado. Los pedidos se consultan por `customer_id` y el detalle resuelve el customer desde `customer_session`, devolviendo `404` sin ownership.

### Guest vs autenticado

El carrito puede ser guest. En checkout, si el email ya corresponde a un customer, se exige una sesión cuyo customer coincida; si el email es nuevo, el checkout puede crear el customer y establecer la sesión. Una sesión existente de otro customer nunca puede apropiarse de ese email/carrito.

## 8.10 Hardening realizado — Payments

`D1PaymentRepository.transition()` ahora aplica `assertPaymentTransition()` antes de modificar persistencia. Esto elimina el bypass de infraestructura que permitía solicitar desde un adapter una transición no permitida por el Domain.

La defensa queda en dos niveles:

1. `PaymentService` ya valida transiciones críticas mediante `assertPaymentTransition()`.
2. `D1PaymentRepository` vuelve a imponer la misma invariante en el límite de persistencia.

Las carreras siguen protegidas por el `WHERE status=?` compare-and-set y el servicio maneja el resultado cuando otro proceso ganó la transición.

## 8.11 Estado de pruebas de esta iteración

El test de `Order` cubre progresión válida de pago, rechazo de resurrección de estados terminales y rechazo de saltos arbitrarios. Payment ya dispone de cobertura de state machine en `PaymentService.test.ts`.

Para la nueva liquidación Order ↔ reservas queda pendiente ejecutar/añadir cobertura D1 real para: `PAID` consume reservas, `PAID` rechaza reservas expiradas o ausentes, `CANCELLED` devuelve stock una sola vez, reservas expiradas no restituyen stock y carreras concurrentes de transición no duplican stock.

## 8.12 Pendientes inmediatos de F6

1. certificación D1/concurrencia de stock y reservas/rollback;
2. idempotencia completa del checkout, incluyendo carreras y expiración;
3. tests IDOR/BOLA de carrito y pedidos con dos customers;
4. certificación guest vs autenticado;
5. coherencia completa Order/Payment state machines;
6. refund/void: idempotencia, concurrencia, state machine y auditoría;
7. tests de privilege escalation vertical/horizontal;
8. tests de sesiones administrativas, abuso y rate limiting;
9. tests de auditoría y no exposición de secretos;
10. regresión real de Payments, Commerce Core, Services e Inventory;
11. gates técnicos y certificación exclusivamente en producción.

## 8.13 Requisitos transversales

### RBAC

- [ ] matriz completa rol/permisión;
- [ ] denegación por defecto;
- [ ] rutas sensibles protegidas server-side;
- [ ] ningún admin_id/rol/permiso confiado desde cliente;
- [ ] privilege escalation vertical/horizontal;
- [ ] pruebas por recurso.

### Integridad

- [x] state machine Order aplicada server-side;
- [x] transición Order + evento atómicos;
- [x] liquidación Order ↔ reservas integrada en la transición y en el mismo batch;
- [x] settlement vinculado al evento de la transición ganadora;
- [x] state machine Payment aplicada también en repository;
- [ ] idempotencia checkout certificada;
- [ ] concurrencia stock/payments/orders certificada;
- [ ] auditoría atómica de todas las operaciones sensibles.

### Tests

- [x] Order state machine;
- [x] Payment state machine existente;
- [ ] integración D1;
- [ ] RBAC matrix;
- [ ] authentication/session;
- [ ] audit;
- [ ] IDOR/BOLA;
- [ ] negative authorization;
- [ ] orders regression;
- [ ] payments/refunds/void regression;
- [ ] inventory concurrency;
- [ ] Order ↔ reservation settlement.

### Gates técnicos

- [ ] `foundation:check`;
- [ ] `architecture:check`;
- [ ] format;
- [ ] lint;
- [ ] typecheck;
- [ ] unit tests;
- [ ] integration tests;
- [ ] Cloudflare build reproducible;
- [ ] migrations production;
- [ ] deploy production;
- [ ] health live/ready;
- [ ] `verify:production`.

## 8.14 Criterio de cierre F6

F6 solo podrá cambiar a **🟢 100% COMPLETA** cuando todos los módulos estén implementados, endurecidos y certificados; la matriz RBAC esté probada; autenticación/sesiones estén certificadas; no existan bypasses de autorización o state machine; las operaciones críticas tengan auditoría; pasen tests unitarios/integración/seguridad; pasen `foundation:check` y `architecture:check`; exista build reproducible; se despliegue a producción; pasen health checks y `verify:production`; y no existan regresiones en Commerce/Payments/Fases anteriores.

**Estado de cierre actual: 🟡 NO CERTIFICADA.**

---

# 9. Notifications + Queues — FASE 07

Implementado: notification ports, NotificationService, templates, D1 outbox/deliveries, Resend provider, Queue, cron, IDs deterministas para eventos de pedido y claim atómico de deliveries/outbox.

Pendiente: DLQ explícita, política definitiva de retry y replay/auditoría de fallos terminales.

---

# 10. Gates transversales restantes

## Reproducibilidad

- [ ] versionar `pnpm-lock.yaml`;
- [ ] `pnpm install --frozen-lockfile`;
- [ ] fijar runtime Node del build;
- [ ] build limpio reproducible.

## Seguridad

- [ ] auditoría exhaustiva de APIs;
- [ ] validación completa de input;
- [ ] autorización server-side completa;
- [ ] CORS/Origin;
- [ ] CSRF donde corresponda;
- [ ] headers;
- [ ] secrets/dependencias;
- [ ] abuso/rate-limit;
- [ ] regresiones de seguridad.

Estos gates no se convierten en PASS por documentación.

---

# 11. Criterio de cierre

```text
Código + Pruebas + Seguridad + Reproducibilidad + Deploy + Verificación de producción = 100%
```

No se usa `compila = 100%`, `CI verde = 100%` ni `documentado = 100%`.

---

# 12. Orden inmediato de Fase 06

1. certificación D1/concurrencia de stock + reservas/rollback;
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
