# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD auditado:** `bb9298c06ce90f9c6a6f72a0296feaac01e47dcd`  
**Última actualización:** 2026-09-11  
**Entorno operativo:** **producción únicamente**.

> Esta auditoría refleja el estado real del repositorio. Una fase solo puede declararse 100% cuando código, pruebas, seguridad, reproducibilidad y evidencia operativa de su alcance estén cerrados. GitHub Actions no es criterio de aceptación.

---

# 1. Estado de cierre

| Fase | Estado | Cierre de código | Certificación final |
|---|---|---:|---:|
| 01 Foundation | 🟡 Implementada | Alta | Pendiente reproducibilidad + auditoría final |
| 02 Storefront | 🟡 Implementada | Alta | Pendiente E2E/performance/accessibility |
| 03 Commerce Core | 🟢 Hardening completado | 100% | Pendiente certificación funcional exhaustiva contra producción |
| 04 Payments | 🔴 No iniciada como integración real | — | **SIGUIENTE FASE** |
| 05 Services | 🟡 Implementada parcialmente | — | Depende de Payments/admin |
| 06 Admin + RBAC | 🟡 Implementada parcialmente | — | Backoffice restante |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

**Estado actual:** el último build/deploy de producción fue exitoso. El error de compilación de `NotificationOutboxRepository.claimDelivery()` quedó corregido en `bb9298c06ce90f9c6a6f72a0296feaac01e47dcd`. El roadmap 1–7 sigue sin declararse 100% porque las fases 04–07 tienen alcance funcional pendiente y Foundation/Storefront todavía tienen gates de certificación.

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
- Presentation no importa Infrastructure directamente.
- Presentation no importa internals de Domain.
- Application no depende de Next.js, Cloudflare o Infrastructure.
- Domain no depende de frameworks ni proveedores.
- Infrastructure implementa puertos internos.
- `architecture:check` es el enforcement automático.
- La composición Cloudflare/D1 está centralizada en composition roots.
- Payments debe seguir exactamente el mismo aislamiento y debe poder sustituir proveedor sin modificar Domain/Application.

## Entornos

Existe **un único entorno Cloudflare remoto: producción**.

El desarrollo local puede usar Next.js, Vitest, Playwright y D1 local/emulado. Esto no es un entorno operativo adicional.

No se reintroducen deploys remotos `staging` ni bindings Cloudflare separados de producción salvo decisión explícita posterior.

---

# 3. Foundation

## Implementado

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
- enforcement arquitectónico;
- producción como único entorno remoto.

## Última producción verificada

Deploy Cloudflare del 2026-09-11 posterior al hardening de Notifications:

- pnpm `10.15.0`;
- Node `24.18.0`;
- Next.js `15.5.25`;
- OpenNext Cloudflare `1.20.6`;
- OpenNext AWS `4.1.4`;
- workerd compatibility date `2026-09-09`;
- `pnpm install --no-frozen-lockfile` PASS;
- `pnpm build:cloudflare` PASS;
- TypeScript/lint PASS;
- generación estática `26/26` PASS;
- OpenNext worker bundle PASS;
- D1 migration step → `No migrations to apply!`;
- Worker deploy PASS;
- `/api/health/live` → HTTP 200;
- `/api/health/ready` → HTTP 200;
- `verify:production` → PASS.

El test de rate limiting emitió warning porque no observó HTTP 429 tras 21 requests. No se considera evidencia de fallo del despliegue: Cloudflare Rate Limiting es eventualmente consistente y puede permitir ráfagas distribuidas. Debe quedar como pendiente de validación específica de abuso, no como gate de disponibilidad.

## Reproducibilidad

`package.json` fija `pnpm@10.15.0`, pero todavía falta `pnpm-lock.yaml` versionado para poder exigir `pnpm install --frozen-lockfile`.

**No se marca reproducibilidad total hasta que ese lockfile exista y un build limpio lo consuma.**

---

# 4. Storefront Premium

Implementado:

- catálogo D1;
- búsqueda;
- filtros;
- ordenamiento;
- paginación;
- detalle por slug;
- variantes;
- reviews;
- FAQ;
- relacionados;
- galería responsive;
- inventario;
- SEO metadata;
- canonical/Open Graph;
- JSON-LD;
- sitemap/robots;
- Domain/Application/Infrastructure.

Pendiente de certificación completa:

- E2E de flujos principales;
- accesibilidad;
- métricas LCP/CLS reales;
- validación SEO en URLs reales;
- regresiones responsive;
- cobertura exhaustiva de filtros/variantes/agotados.

No se declara 100% sin esas evidencias.

---

# 5. Commerce Core — cierre de código

## 5.1 Cliente y sesión

- sesión `customer_session` HttpOnly;
- SameSite `lax`;
- Secure en producción;
- expiración;
- token aleatorio;
- solo hash SHA-256 persistido;
- revocación;
- identidad server-side;
- carrera de creación de customer por email protegida mediante relectura después de conflicto.

## 5.2 Carrito

- carrito guest por `cart_id`;
- claim explícito por customer;
- `getOwnedByCustomer()`;
- un customer no puede reclamar carrito de otro;
- checkout autenticado verifica identidad;
- guest checkout con email existente exige sesión válida.

## 5.3 Checkout

- `Idempotency-Key` obligatoria;
- idempotencia por customer;
- carrera de idempotencia resuelta mediante unicidad + relectura;
- precio recalculado desde catálogo server-side;
- producto/variante activa verificados;
- stock decrementado atómicamente;
- `stock >= quantity` obligatorio;
- batch D1 transaccional;
- order creado en `PENDING_PAYMENT`;
- cart limpiado al completar batch;
- evento `OrderCreated` determinista por pedido;
- líneas conservan `variant_id`.

## 5.4 Reservas e inventario

- reserva enlazada a `order_id`;
- expiración de 15 minutos;
- `releaseForOrder()` idempotente;
- `consumeForOrder()` idempotente;
- expiración dependiente del estado del pedido;
- pedidos pagados no devuelven stock al expirar una reserva;
- legacy cleanup mediante `0012`;
- relación reserva→pedido mediante `0013`;
- scheduler de Worker libera expiraciones cada minuto independientemente de nuevos checkouts.

## 5.5 Pedidos

Se agregó listado autenticado de pedidos del customer:

```text
GET /api/orders
GET /api/orders?limit=20&offset=0
GET /api/orders/:id
```

El nuevo flujo mantiene Clean Architecture:

```text
Route
 ↓
ListOrdersForCustomer
 ↓
OrderRepository
 ↓
D1OrderRepository
```

La consulta está limitada a 50 elementos por página y siempre filtra por `customer_id`.

## 5.6 Migraciones

Las migraciones de Commerce relevantes están versionadas. En el último deploy de producción, el paso de migración reportó `No migrations to apply!`, por lo que no quedó ninguna migración pendiente en ese despliegue.

## 5.7 Pruebas agregadas

Existen pruebas unitarias para:

- autenticación de checkout;
- idempotency key;
- stock;
- shipping;
- release de reservas;
- ownership;
- sesión;
- listado de pedidos del customer.

La certificación de concurrencia contra D1 real sigue siendo un gate operativo, no se puede simular como evidencia de producción.

### Resultado Phase 3

**Código Commerce Core: 100% del alcance definido para el núcleo pre-payment.**

**Estado:** el último deploy productivo fue exitoso y no reportó migraciones pendientes. Aun así, la certificación final de Phase 3 requiere ejecutar contra producción la batería funcional crítica: sesión/autorización, ownership de carrito/pedidos, concurrencia de stock, idempotencia de checkout, reservas/rollback, precios server-side y guest vs autenticado.

La integración real de pagos, `consumeForOrder()` después de un pago confirmado y `releaseForOrder()` después de un pago fallido pertenecen a Fase 04 Payments.

---

# 6. Payments — FASE 04 EN CURSO

## Objetivo

Implementar el bounded context `payments` como integración real, provider-agnostic y compatible con DDD + Clean Architecture, conectado al núcleo Commerce sin acoplarlo a un proveedor concreto.

## Alcance obligatorio

### Dominio

- `Payment` aggregate;
- identificadores de pago y de proveedor;
- amount/currency inmutables para una operación;
- estados explícitos y transiciones válidas;
- relación con `order_id`;
- protección contra doble confirmación;
- estados de fallo/cancelación/refund;
- invariantes de importe y moneda.

### Application

- crear/iniciar payment intent;
- obtener estado del pago;
- confirmar/registrar resultado de pago únicamente mediante eventos confiables del proveedor;
- procesar webhook;
- idempotencia de webhook;
- reconciliation;
- refund cuando el alcance del proveedor lo permita;
- coordinación con Orders/Inventory:
  - pago confirmado → `consumeForOrder()`;
  - pago fallido/cancelado/expirado → `releaseForOrder()`;
- evitar que el cliente pueda marcar una orden como `PAID`.

### Ports

Definir contratos explícitos para:

- `PaymentRepository`;
- `PaymentProvider` / gateway abstraction;
- `PaymentWebhookVerifier`;
- `PaymentLedger` o equivalente de auditoría financiera;
- `OrderPaymentPort`;
- `InventoryReservationPort`;
- reloj/clock cuando sea necesario para determinismo.

Los casos de uso deben depender solo de estos puertos.

### Infrastructure

Implementar adapters concretos detrás de los ports. No fijar la lógica de negocio a Stripe, PayPal, Mercado Pago u otro proveedor. El proveedor real debe ser intercambiable.

### Persistence

Diseñar migración D1 para, como mínimo:

- payments;
- provider payment identifiers;
- webhook/event IDs con unicidad;
- payment attempts si son necesarias;
- refunds;
- ledger/audit records;
- timestamps y estados.

No almacenar secretos del proveedor en D1.

### API

Crear únicamente endpoints necesarios y protegerlos server-side. Como mínimo estudiar:

```text
POST /api/payments/intents
GET  /api/payments/:id
POST /api/payments/webhook/:provider
POST /api/payments/:id/refund
```

El endpoint de webhook debe verificar firma/autenticidad antes de mutar estado.

### Idempotencia y concurrencia

Es obligatorio probar:

- mismo `Idempotency-Key` → mismo resultado lógico;
- dos requests concurrentes → un solo payment intent lógico;
- mismo webhook recibido N veces → una sola transición efectiva;
- webhook fuera de orden → no retroceder estado inválidamente;
- dos confirmaciones → una sola aplicación de `consumeForOrder()`;
- pago fallido/cancelado repetido → `releaseForOrder()` idempotente;
- refund repetido → no duplicar devolución;
- pago de una orden ajena → rechazado;
- amount/currency manipulados desde cliente → rechazados;
- una orden no puede pasar a `PAID` por una llamada HTTP arbitraria del cliente.

### Seguridad

- verificación criptográfica de webhook;
- replay protection mediante event ID/timestamp cuando el proveedor lo soporte;
- secrets solo por Cloudflare/GitHub secret stores;
- no exponer secretos ni payloads sensibles en logs;
- autorización server-side;
- rate limiting de endpoints sensibles;
- validación estricta de amount/currency/order ownership;
- no confiar en redirects del navegador como confirmación de pago.

### Tests mínimos de Fase 04

- unit tests del aggregate y state machine;
- application tests de idempotencia;
- webhook signature tests;
- duplicate webhook tests;
- out-of-order event tests;
- concurrent payment intent tests;
- ownership tests;
- amount/currency tampering tests;
- reservation consume/release tests;
- refund idempotency tests;
- persistence/repository tests;
- integración con el proveedor en modo seguro/test cuando sea posible;
- pruebas de regresión de Commerce Core.

## Regla de proveedor real

No se considera Phase 04 cerrada por tener interfaces, mocks o un fake provider. Para declarar 100% debe existir un proveedor real configurado para producción, credenciales fuera de Git, webhook real y evidencia de extremo a extremo en producción sin exponer secretos.

## Orden de implementación

```text
1. Auditar el código actual de orders/inventory/checkout.
2. Crear bounded context payments.
3. Definir Domain + state machine.
4. Definir Application use cases + Ports.
5. Crear migración D1.
6. Implementar adapter del proveedor real.
7. Implementar webhook firmado + idempotente.
8. Conectar PAID → consumeForOrder().
9. Conectar FAILED/CANCELLED/EXPIRED → releaseForOrder().
10. Implementar refunds + ledger/reconciliation.
11. Tests críticos de concurrencia/idempotencia/ownership.
12. architecture:check + lint + typecheck + tests.
13. build:cloudflare.
14. deploy únicamente a producción.
15. verify:production.
16. Actualizar este documento con evidencia real.
```

**No marcar Phase 04 como 100% hasta completar todo lo anterior.**

---

# 7. Services

Implementado parcialmente:

- ServiceRequest;
- ServiceManagement;
- Customer Portal;
- Service Workflow;
- Service Type repositories;
- D1 persistence;
- minimización de IMEI/serial.

Pendiente cierre de integraciones y operaciones administrativas.

---

# 8. Admin + RBAC

Implementado:

- AdminUser/AdminRole;
- RBAC;
- sesiones;
- PBKDF2-SHA256;
- fingerprinting;
- auditoría;
- permisos server-side;
- dashboard;
- users/resources/service types.

Pendiente completar backoffice de pagos, reviews, promociones, CMS/SEO, settings e inventario administrativo.

---

# 9. Notifications + Queues

Implementado:

- notification ports;
- NotificationService;
- templates;
- D1 outbox/deliveries;
- Resend provider;
- Queue;
- cron;
- IDs deterministas para eventos de pedido;
- claim atómico de deliveries/outbox antes de encolar;
- contrato `NotificationOutboxRepository.claimDelivery()` alineado con la implementación D1;
- último build de producción confirmado después de este hardening.

Pendiente:

- DLQ explícita;
- política definitiva de retry;
- replay/auditoría de fallos terminales.

---

# 10. Reproducibilidad y seguridad — gates restantes

## Reproducibilidad

- [ ] versionar `pnpm-lock.yaml`;
- [ ] cambiar instalación de build a `pnpm install --frozen-lockfile`;
- [ ] fijar runtime Node del build;
- [ ] ejecutar build limpio reproducible.

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

Estos gates no se convierten en `PASS` por documentación.

---

# 11. Criterio de cierre final

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

No se usa:

```text
"compila" = 100%
"CI verde" = 100%
"documentado" = 100%
```

La aceptación es sobre el producto real y producción.

---

# 12. Orden inmediato

```text
1. Fase 03 → ejecutar batería final de invariantes contra producción.
2. Fase 04 → implementar Payments real.
3. Definir/configurar proveedor real y webhook de producción.
4. Ejecutar tests críticos de pagos + regresión Commerce.
5. architecture:check + lint + typecheck + build:cloudflare.
6. deploy únicamente a producción.
7. verify:production.
8. actualizar esta auditoría con commit, migraciones y evidencia.
9. solo entonces declarar Fase 04 cerrada.
```

## Estado real al cierre de este documento

- El último build/deploy de producción fue exitoso.
- El problema de `NotificationOutboxRepository.claimDelivery()` quedó corregido en el contrato de aplicación.
- La verificación de producción pasó.
- No se detectaron migraciones pendientes durante el último deploy.
- El entorno operativo remoto continúa siendo exclusivamente producción.
- Commerce Core tiene el código pre-payment cerrado, pero conserva gates de certificación funcional.
- **Fase 04 Payments es ahora la siguiente fase activa y todavía no está implementada como integración real.**

**No se afirma falsamente que todo el roadmap 1–7 está al 100%.**