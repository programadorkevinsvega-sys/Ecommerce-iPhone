# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD auditado:** `a782b0e4cf5ecce3212246fac5ae0f55b6bdf199`  
**Última actualización:** 2026-09-11  
**Entorno operativo:** **producción únicamente**.

> Esta auditoría refleja el estado real del repositorio. Una fase solo puede declararse 100% cuando código, pruebas, seguridad, reproducibilidad y evidencia operativa de su alcance estén cerrados. GitHub Actions no es criterio de aceptación.

---

# 1. Estado de cierre

| Fase | Estado | Cierre de código | Certificación final |
|---|---|---:|---:|
| 01 Foundation | 🟢 Implementada | Alta | Pendiente reproducibilidad + auditoría final |
| 02 Storefront | 🟢 Implementada | Alta | Pendiente E2E/performance/accessibility |
| 03 Commerce Core | 🟢 Implementada | 100% | Pendiente certificación funcional exhaustiva contra producción |
| 04 Payments | 🟡 Implementada — cierre/hardening | Alta | Pendiente pruebas completas + credenciales/webhooks reales + E2E producción |
| 05 Services | 🟡 Implementada parcialmente | — | Depende de Payments/admin |
| 06 Admin + RBAC | 🟡 Implementada parcialmente | — | Backoffice restante |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

**Estado actual:** Fases 1–3 están implementadas. Fase 4 ya tiene integración real de Payments en código y está en etapa de cierre/hardening/certificación; no se debe volver a tratar como fase no iniciada. El último deploy de producción confirmado antes de este bloque de hardening fue exitoso. Los cambios de Payments realizados después de ese deploy requieren un nuevo build/deploy antes de considerarlos evidencia operativa de producción.

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
- Payments sigue el mismo aislamiento y permite sustituir proveedor sin modificar Domain/Application.

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

Deploy Cloudflare confirmado el 2026-09-11 antes del último bloque de hardening de Payments:

- pnpm `10.15.0`;
- Node `24.18.0`;
- Next.js `15.5.25`;
- OpenNext Cloudflare `1.20.6`;
- OpenNext AWS `4.1.4`;
- workerd compatibility date `2026-09-09`;
- `pnpm install --no-frozen-lockfile` PASS;
- `pnpm build:cloudflare` PASS;
- TypeScript/lint PASS;
- generación estática PASS;
- OpenNext worker bundle PASS;
- migraciones D1 `0015_payments.sql` y `0016_multi_provider_payments.sql` PASS;
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

# 5. Commerce Core — implementación cerrada

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

Las migraciones de Commerce relevantes están versionadas. Las migraciones de Payments `0015` y `0016` quedaron aplicadas en producción en el último deploy confirmado. El nuevo hardening de refunds añade `0017_payment_refunds.sql`; esta migración requiere volver a ejecutar el proceso de producción antes de marcarla como aplicada en producción.

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

La certificación de concurrencia contra D1 real sigue siendo un gate operativo.

### Resultado Phase 3

**Fase 03 está implementada. Código Commerce Core: 100% del alcance definido para el núcleo pre-payment.**

La certificación funcional exhaustiva contra producción permanece como evidencia operativa separada de la implementación.

---

# 6. Payments — FASE 04 IMPLEMENTADA / CIERRE EN CURSO

## 6.1 Estado real

La Fase 04 **ya no está en estado “no iniciada”**. El bounded context `payments` está implementado y conectado al Commerce Core.

Implementado en código:

- aggregate `Payment`;
- máquina de estados `CREATED → PENDING → PROCESSING → PAID → REFUNDED` y estados terminales de fallo/cancelación;
- invariantes amount/currency;
- protección contra doble confirmación;
- `PaymentRepository`;
- `PaymentProviderPort`;
- `PaymentWebhookVerifier` por proveedor;
- `OrderPaymentPort`;
- `ReservationPaymentPort`;
- ledger financiero;
- reconciliation;
- idempotencia de payment intent;
- idempotencia de webhook/evento;
- ownership server-side;
- validación server-side de amount/currency/order;
- `PAID → consumeForOrder()`;
- `FAILED/CANCELLED/VOIDED → releaseForOrder()`;
- late approval handling;
- recuperación de payment intents existentes.

## 6.2 Proveedores reales implementados

Registry provider-agnostic con cinco adapters:

```text
PaymentProviderRegistry
├── WOMPI
├── STRIPE
├── MERCADOPAGO
├── PAYPAL
└── BINANCE_PAY
```

Credenciales permanecen server-side y no se almacenan en D1.

## 6.3 Webhooks

Implementados verificadores específicos para:

- Wompi;
- Stripe;
- Mercado Pago;
- PayPal;
- Binance Pay.

El flujo de webhook valida autenticidad antes de mutar estado y utiliza unicidad de `(provider,event_id)` en D1.

## 6.4 API implementada

```text
POST /api/payments/intent
GET  /api/payments/:id
POST /api/payments/webhooks/wompi
POST /api/payments/webhooks/stripe
POST /api/payments/webhooks/mercadopago
POST /api/payments/webhooks/paypal
POST /api/payments/webhooks/binance-pay
POST /api/payments/:id/refund
```

`GET /api/payments/:id` exige sesión del customer y solo devuelve pagos pertenecientes al customer autenticado.

`POST /api/payments/:id/refund` exige sesión administrativa con permiso `refunds:create` y `Idempotency-Key`. El endpoint actual permite **refund completo**; no acepta un importe parcial desde el cliente.

## 6.5 Refund / void: capacidades reales verificadas

La matriz actual se basa en documentación oficial de los proveedores revisada el 2026-09-11:

| Proveedor | Refund | Void/cancel | Estado de implementación |
|---|---|---|---|
| Stripe | Sí, por PaymentIntent/Charge | Cancelación de PaymentIntent en estados aplicables | Refund implementado |
| Mercado Pago | Sí, total/parcial mediante `/v1/payments/{id}/refunds` | No se expone como void genérico | Refund implementado |
| PayPal | Sí, sobre capture mediante `/v2/payments/captures/{capture_id}/refund` | Cancelación de order no capturada es distinta a refund | Refund implementado |
| Wompi | No se expone refund genérico en esta integración; sí `VOID` para transacciones de tarjeta en estados permitidos | Sí, `/v1/transactions/{id}/void` | Void implementado |
| Binance Pay | No se ha verificado un endpoint oficial de refund merchant equivalente en la documentación actual consultada | No se expone void/refund genérico | **No soportado por el endpoint de refund** |

Fuentes oficiales consultadas:

- Stripe Refund API: `https://docs.stripe.com/api/refunds/create`
- Mercado Pago Refund API: `https://www.mercadopago.com.co/developers/en/reference/online-payments/checkout-api-payments/create-refund/post`
- PayPal Capture Refund API: `https://developer.paypal.com/api/payments/v2/captures-refund`
- Wompi Transactions/Void: `https://docs.wompi.co/docs/colombia/transacciones/`
- Binance Pay Order Query: `https://developers.binance.com/en/docs/products/binance-pay-merchant/api-order-query`

No se debe marcar Binance Pay como “refund soportado” hasta disponer de una capacidad oficial verificable.

## 6.6 Persistencia de refunds

Se añadió:

```text
0017_payment_refunds.sql
```

Con:

- `payment_id`;
- `idempotency_key`;
- `provider_refund_id`;
- estado `PENDING/SUCCEEDED/FAILED`;
- amount/currency;
- timestamps;
- unicidad de refund por payment + idempotency key;
- índices de consulta.

La migración todavía necesita ejecución en producción para completar la evidencia operativa.

## 6.7 Idempotencia, duplicados, out-of-order y concurrencia

Implementado y cubierto a nivel de application/domain tests:

- payment intent concurrente → unicidad + relectura;
- duplicate approval → una sola transición `PAID`;
- duplicate approval → `consumeForOrder()` se mantiene idempotente;
- evento `DECLINED` posterior a `PAID` no retrocede el pago;
- amount tampering del proveedor → rechazo;
- refund repetido con el mismo `Idempotency-Key` → no crea un segundo registro local;
- refund solo permitido desde `PAID`;
- ownership del payment en consulta server-side;
- refund protegido por RBAC administrativo.

Además, `markPaid()` consume la reserva también cuando detecta que el pago ya estaba `PAID`, evitando una ventana en la que una confirmación concurrente pudiera dejar la reserva sin consumir.

## 6.8 Tests actuales de Payments

Implementados:

- state machine del aggregate;
- lifecycle válido e inválido;
- duplicate approval;
- out-of-order decline después de approval;
- provider amount tampering;
- refund idempotency;
- Wompi webhook rejection tests.

Pendiente para declarar batería completa:

- tests equivalentes específicos de firma para Stripe/Mercado Pago/PayPal/Binance;
- tests de repository D1 contra D1 real/local;
- prueba de migración `0017`;
- prueba E2E real por proveedor;
- prueba real de refund/void con credenciales productivas;
- prueba de webhooks duplicados y fuera de orden contra endpoints HTTP reales;
- regresión completa Commerce Core después del último hardening.

## 6.9 Regla de cierre de Fase 04

La implementación de código de Fase 04 está avanzada y funcionalmente integrada, pero **Fase 04 todavía no se declara 100% certificada**.

Para cerrarla:

```text
Tests críticos
+ migración 0017 aplicada
+ build reproducible
+ credenciales productivas configuradas
+ webhooks productivos configurados
+ pago real aprobado
+ pago real rechazado/cancelado
+ duplicate/out-of-order real
+ refund/void real según proveedor
+ verify:production
= Fase 04 certificada
```

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
- users/resources/service types;
- permiso `refunds:create` para operaciones financieras.

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
1. Fase 04 → completar batería específica de firmas/webhooks y persistence tests.
2. Aplicar 0017_payment_refunds.sql en producción.
3. architecture:check + lint + typecheck + tests.
4. build:cloudflare.
5. deploy únicamente a producción.
6. verify:production.
7. configurar credenciales/webhooks productivos de los proveedores que se vayan a certificar.
8. ejecutar pago real aprobado/rechazado y refund/void real según capacidad.
9. validar duplicate/out-of-order/concurrency contra endpoints reales.
10. actualizar esta auditoría con commit, migraciones y evidencia.
11. solo entonces declarar Fase 04 certificada.
```

## Estado real al cierre de este documento

- Fases 1–3: **implementadas**.
- Fase 4: **implementada en gran parte; cierre/hardening/certificación en curso**.
- Payments dispone de cinco adapters reales: Wompi, Stripe, Mercado Pago, PayPal y Binance Pay.
- Existe consulta autenticada de payment.
- Existe refund administrativo protegido por RBAC e idempotencia para proveedores con capacidad soportada.
- Wompi dispone de operación `void`.
- `0017_payment_refunds.sql` está versionada pero requiere aplicación en producción.
- El último build/deploy productivo confirmado fue exitoso antes del último bloque de hardening de Payments.
- El entorno operativo remoto continúa siendo exclusivamente producción.
- No se afirma que Fase 04 esté 100% certificada hasta disponer de evidencia E2E real y pruebas finales.

**Este documento debe actualizarse en la misma iteración de cada cambio relevante de código.**