# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD auditado:** `685b6dd5ea9806aa82c013bde07cd5c9fcfc1889`  
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
| 04 Payments | 🟡 Implementada — hardening técnico aplicado | Alta | Pendiente build/deploy + pruebas E2E reales |
| 05 Services | 🟡 Implementada parcialmente | — | Depende de Payments/admin |
| 06 Admin + RBAC | 🟡 Implementada parcialmente | — | Backoffice restante |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

**Estado actual:** Fases 1–3 están implementadas. Fase 4 tiene integración real de Payments y el bloque de hardening detectado en auditoría de código ya fue implementado en `main`. El último deploy de producción confirmado fue anterior a este bloque; por tanto, los cambios actuales requieren nuevo build/deploy antes de considerarlos evidencia operativa de producción.

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
- Payments mantiene registry + ports + adapters para sustituir proveedor sin modificar Domain/Application.

## Entornos

Existe **un único entorno Cloudflare remoto: producción**.

El desarrollo local puede usar Next.js, Vitest, Playwright y D1 local/emulado. Esto no es un entorno operativo adicional.

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

El test de rate limiting emitió warning porque no observó HTTP 429 tras 21 requests. Se mantiene como pendiente de validación específica de abuso y no como fallo de disponibilidad.

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
- scheduler de Worker libera expiraciones cada minuto independientemente de nuevos checkouts.

## 5.5 Pedidos

Se agregó listado autenticado de pedidos del customer:

```text
GET /api/orders
GET /api/orders?limit=20&offset=0
GET /api/orders/:id
```

La consulta está limitada a 50 elementos por página y siempre filtra por `customer_id`.

## 5.6 Migraciones

Las migraciones de Commerce relevantes están versionadas. Las migraciones de Payments `0015` y `0016` quedaron aplicadas en el último deploy confirmado. `0017_payment_refunds.sql` ya está versionada y `0018_payment_refund_locks.sql` añade el lock atómico de refunds; ambas requieren aplicación mediante el flujo de producción antes de marcar evidencia operativa.

## 5.7 Pruebas agregadas

Existen pruebas unitarias para autenticación, idempotencia, stock, shipping, reservas, ownership, sesión y listado de pedidos. La certificación funcional exhaustiva contra D1/producción permanece como evidencia operativa separada.

### Resultado Fase 03

**Fase 03 está implementada. Código Commerce Core: 100% del alcance definido para el núcleo pre-payment.**

---

# 6. Payments — FASE 04 IMPLEMENTADA / HARDENING TÉCNICO APLICADO

## 6.1 Estado real

El bounded context `payments` está implementado y conectado al Commerce Core. La auditoría de código detectó varios huecos que ya fueron corregidos en `main`.

Implementado:

- aggregate `Payment`;
- máquina de estados y transiciones terminales;
- invariantes amount/currency;
- protección contra doble confirmación;
- `PaymentRepository`;
- `PaymentProviderPort`;
- verificadores por proveedor;
- ledger financiero;
- reconciliation de transacciones;
- idempotencia de payment intent;
- idempotencia de webhook/evento;
- ownership server-side;
- validación server-side de amount/currency/order;
- consumo/liberación idempotente de reservas;
- late approval handling;
- recuperación de payment intents existentes.

## 6.2 Proveedores reales

```text
PaymentProviderRegistry
├── WOMPI
├── STRIPE
├── MERCADOPAGO
├── PAYPAL
└── BINANCE_PAY
```

Credenciales permanecen server-side y no se almacenan en D1.

Correcciones aplicadas:

- Stripe ahora correlaciona el `PaymentIntent` por su propio ID, evitando que el webhook se pierda por usar `order_id` como referencia.
- Mercado Pago y PayPal pueden correlacionar callbacks por `order_id` cuando ese es el identificador externo que devuelve el proveedor.
- Mercado Pago y PayPal validan amount/currency durante recovery.
- Binance Pay recovery valida `merchantTradeNo`, amount y currency y reutiliza el checkout previamente persistido cuando está disponible.
- Binance `merchantTradeNo` se deriva de un hash de `orderId + idempotencyKey` para evitar colisiones por truncamiento.
- Wompi `providerReference` se deriva de SHA-256 de `orderId + idempotencyKey`, evitando colisiones por truncamiento de identificadores.
- Binance webhook acepta el formato de notificación con `data` como JSON string y conserva `bizIdStr` como event id cuando está disponible.

## 6.3 Webhooks

Implementados verificadores específicos para Wompi, Stripe, Mercado Pago, PayPal y Binance Pay.

Hardening aplicado:

- Stripe conserva `event.id` como identificador de deduplicación.
- Mercado Pago conserva `x-request-id` como identificador de deduplicación.
- PayPal conserva `event.id`.
- Binance conserva `bizIdStr` cuando existe.
- Wompi utiliza el checksum validado como correlación determinista cuando el proveedor no entrega un event id equivalente.
- `PaymentService` acepta el event id real del proveedor y solo usa hash derivado como fallback.
- El estado financiero se aplica **antes** de registrar el webhook como procesado; si la mutación falla, el proveedor puede reintentar el mismo evento sin quedar bloqueado por una deduplicación prematura.
- Binance Pay limita timestamp del webhook a la ventana documentada de aproximadamente 1 segundo y valida nonce de 32 caracteres alfanuméricos.

La tabla D1 mantiene `UNIQUE(provider,event_id)`.

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
POST /api/payments/:id/refund/reconcile
POST /api/payments/:id/void
```

`GET /api/payments/:id` exige sesión del customer y solo devuelve pagos pertenecientes al customer autenticado.

`POST /api/payments/:id/refund` exige `refunds:create` + `Idempotency-Key` y actualmente expone refund completo.

`POST /api/payments/:id/refund/reconcile` permite resolver refunds persistidos como `PENDING` mediante consulta server-side al provider cuando el adapter lo soporta.

`POST /api/payments/:id/void` exige `payments:void` + `Idempotency-Key`, requiere transaction id persistido y solo opera sobre providers con capacidad `voidPayment`; actualmente Wompi es el adapter con esta capacidad.

## 6.5 Refund / void: capacidades reales

| Proveedor | Refund | Void/cancel | Estado de código |
|---|---|---|---|
| Stripe | Sí | Cancelación de PaymentIntent en estados aplicables | Refund + reconciliación implementados |
| Mercado Pago | Sí, total/parcial | No void genérico expuesto | Refund + reconciliación implementados |
| PayPal | Sí sobre capture | Cancelación de order no capturada es distinta a refund | Refund + reconciliación implementados |
| Wompi | No refund genérico en esta integración | Sí, `POST /v1/transactions/{id}/void` | Void implementado y expuesto |
| Binance Pay | No se ha confirmado endpoint merchant oficial equivalente de refund | No void genérico implementado | Refund/void no soportados |

Las capacidades de Stripe, Mercado Pago, PayPal, Wompi y Binance fueron contrastadas con documentación oficial durante el hardening. Binance no se declara como refund-capable sin endpoint oficial verificable.

## 6.6 Persistencia de refunds y locks

`0017_payment_refunds.sql` contiene:

- `payment_id`;
- `idempotency_key`;
- `provider_refund_id`;
- estado `PENDING/SUCCEEDED/FAILED`;
- amount/currency;
- timestamps;
- unicidad `(payment_id,idempotency_key)`;
- unicidad `(payment_id,provider_refund_id)`;
- índices.

`0018_payment_refund_locks.sql` contiene un lock único por `payment_id` para impedir que dos requests con **claves de idempotencia diferentes** ejecuten dos refunds contra el mismo proveedor de forma concurrente.

El lock conserva su `idempotency_key`: un retry con la **misma** clave puede reintentar de forma segura contra el proveedor; una clave diferente queda bloqueada mientras exista una operación incierta. Esto evita que un timeout de red convierta una devolución incierta en riesgo de doble devolución.

## 6.7 Idempotencia, duplicados, out-of-order y concurrencia

Corregido en código y cubierto mediante tests de application/domain:

- payment intent concurrente → unicidad + relectura;
- duplicate approval → una sola transición `PAID`;
- duplicate approval → consumo de reserva seguro/idempotente;
- `DECLINED` posterior a `PAID` no retrocede el pago;
- amount tampering → rechazo;
- webhook duplicado → estado protegido por transiciones idempotentes y deduplicación persistida;
- out-of-order con event ids distintos → máquina de estados evita retrocesos;
- refund repetido con misma idempotency key → una sola operación;
- refunds concurrentes con diferentes idempotency keys → lock atómico por payment;
- retry de refund incierto con la misma idempotency key → permitido de forma segura;
- refund solo desde `PAID`;
- resultado de refund validado contra amount/currency originales;
- refund `PENDING` puede reconciliarse consultando al provider;
- ownership de consulta server-side;
- refund/void protegidos por RBAC.

## 6.8 Tests actuales de Payments

Implementados:

- state machine del aggregate;
- lifecycle válido e inválido;
- duplicate approval;
- out-of-order decline después de approval;
- provider amount tampering;
- refund idempotency;
- concurrencia de refunds con diferentes claves;
- reconciliación de refund `PENDING`;
- validación de firmas Stripe;
- validación de firmas Mercado Pago;
- validación de firma/timestamp/nonce Binance Pay;
- validación de checksum Wompi;
- rechazo de datos incompletos de PayPal.

Pendiente de evidencia operativa, no de implementación:

- ejecución de tests sobre el build actual;
- migraciones `0017` y `0018` aplicadas en producción;
- E2E real por proveedor;
- refund/void real con credenciales productivas;
- webhooks reales duplicados/out-of-order;
- regresión completa Commerce Core después del deploy.

## 6.9 Regla de cierre de Fase 04

El **hardening técnico de código** de los hallazgos de esta auditoría está implementado. Fase 04 todavía no puede declararse 100% certificada hasta obtener evidencia del nuevo build/deploy y pruebas reales.

```text
Código hardening PASS
+ tests ejecutados PASS
+ migraciones 0017/0018 aplicadas
+ build/deploy producción PASS
+ credenciales/webhooks productivos
+ pago real aprobado
+ pago real rechazado/cancelado
+ duplicate/out-of-order real
+ refund/void real según proveedor
+ verify:production PASS
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
- `refunds:create`;
- `payments:void` para operación administrativa de void.

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
- claim atómico de deliveries/outbox antes de encolar.

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
1. Ejecutar batería de tests del build actual.
2. Aplicar 0017_payment_refunds.sql + 0018_payment_refund_locks.sql en producción.
3. architecture:check + lint + typecheck + tests.
4. build:cloudflare.
5. deploy únicamente a producción.
6. verify:production.
7. configurar credenciales/webhooks productivos de los proveedores a certificar.
8. ejecutar pago real aprobado/rechazado y refund/void real según capacidad.
9. validar duplicate/out-of-order/concurrency contra endpoints reales.
10. actualizar esta auditoría con commit, migraciones y evidencia.
11. solo entonces declarar Fase 04 certificada.
```

## Estado real al cierre de este documento

- Fases 1–3: **implementadas**.
- Fase 4: **hardening técnico implementado; certificación operativa pendiente**.
- Payments dispone de cinco adapters reales: Wompi, Stripe, Mercado Pago, PayPal y Binance Pay.
- Existe consulta autenticada de payment.
- Existe refund administrativo protegido por RBAC e idempotencia.
- Existe reconciliación de refunds `PENDING` para providers con `getRefund`.
- Existe void administrativo protegido por RBAC para providers con `voidPayment`.
- `0017_payment_refunds.sql` y `0018_payment_refund_locks.sql` están versionadas y requieren aplicación en producción.
- El último build/deploy productivo confirmado fue exitoso antes del último bloque de hardening de Payments.
- El entorno operativo remoto continúa siendo exclusivamente producción.
- No se afirma que Fase 04 esté 100% certificada hasta disponer de evidencia E2E real y pruebas finales.

**Este documento debe actualizarse en la misma iteración de cada cambio relevante de código.**
