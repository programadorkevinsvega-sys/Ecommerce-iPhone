# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD auditado:** `fa78d084ce8b9624302ead3135dd7e5c5c161a9a`  
**Última actualización:** 2026-09-11  
**Entorno operativo:** **producción únicamente**.

> Esta auditoría refleja el estado real del repositorio. Una fase solo puede declararse 100% cuando código, pruebas, seguridad, reproducibilidad y evidencia operativa de su alcance estén cerrados. GitHub Actions no es criterio de aceptación.

---

# 1. Estado de cierre

| Fase | Estado | Cierre de código | Certificación final |
|---|---|---:|---:|
| 01 Foundation | 🟡 Implementada | Alta | Pendiente lockfile + auditoría final |
| 02 Storefront | 🟡 Implementada | Alta | Pendiente E2E/performance/accessibility |
| 03 Commerce Core | 🟢 Hardening completado | 100% | Pendiente deploy/certificación de esta última línea |
| 04 Payments | 🔴 No iniciada como integración real | — | Fase siguiente |
| 05 Services | 🟡 Implementada parcialmente | — | Depende de Payments/admin |
| 06 Admin + RBAC | 🟡 Implementada parcialmente | — | Backoffice restante |
| 07 Notifications + Queues | 🟡 Implementada parcialmente | — | DLQ/retry definitivo |

**No se falsifica el 100% de las fases 1–7:** Payments, Services, Admin y Notifications todavía contienen alcance funcional explícitamente pendiente. El trabajo de este ciclo cierra el hardening de Commerce y elimina el uso de entornos remotos no necesarios.

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

## Entornos

Existe **un único entorno Cloudflare remoto: producción**.

El desarrollo local puede usar Next.js, Vitest, Playwright y D1 local/emulado. Esto no es un entorno operativo adicional.

Se eliminó de la configuración operativa:

- deploy remoto `staging`;
- bindings Cloudflare `staging`;
- script `db:migrate:staging`;
- script `deploy:staging`;
- preview remoto `--env development`.

El Worker principal queda definido directamente para producción.

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

## Producción verificada anteriormente

Deploy Cloudflare del 2026-09-11:

- pnpm `10.15.0`;
- Node `24.18.0`;
- Next.js `15.5.25`;
- OpenNext Cloudflare `1.20.6`;
- build PASS;
- lint/typecheck PASS;
- 25/25 páginas estáticas;
- Worker deploy PASS;
- `/api/health/live` → 200;
- `/api/health/ready` → 200;
- production verification → PASS;
- D1 `0012` → aplicada;
- D1 `0013` → aplicada.

El warning del rate limiter después de 21 requests no fue considerado bloqueo porque Cloudflare Rate Limiting es eventualmente consistente.

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

## 5.6 Migración 0014

Existe:

```text
migrations/0014_order_item_variant_link.sql
```

Su objetivo es persistir `variant_id` en `order_items` con FK e índice.

**Estado:** versionada en `main`; debe aplicarse en producción durante el próximo deploy. La evidencia anterior solo certifica hasta `0013`.

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

**Certificación productiva: pendiente de desplegar `0014` y ejecutar la batería final contra producción.**

La integración real de pagos, `consumeForOrder()` después de un pago confirmado y `releaseForOrder()` después de un pago fallido pertenecen a Fase 04 Payments; no deben bloquear artificialmente el cierre del núcleo pre-payment.

---

# 6. Payments

Pendiente:

- payment intent;
- proveedor real;
- firma de webhooks;
- idempotencia de pagos;
- reconciliation;
- refunds;
- ledger;
- transición `PENDING_PAYMENT → PAYMENT_PROCESSING → PAID`;
- `consumeForOrder()` en pago confirmado;
- `releaseForOrder()` en pago fallido/cancelado.

**No se implementa artificialmente en Commerce: corresponde a Fase 04.**

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
- IDs deterministas para eventos de pedido.

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
1. Commit actual → Cloudflare build/deploy
2. Aplicar 0014 en D1 producción
3. Ejecutar verify:production
4. Ejecutar tests completos
5. Certificar invariantes de checkout/concurrencia
6. Cerrar reproducibilidad con pnpm-lock.yaml
7. Auditoría final de seguridad
8. E2E/accessibility/performance del storefront
9. Iniciar Fase 04 Payments
```

## Estado real al cierre de este documento

El código pendiente de Commerce Core identificado en la auditoría anterior ya fue corregido: el listado autenticado de pedidos está implementado, la política remota de entornos quedó reducida a producción y los documentos de Foundation/Development/Cloudflare fueron sincronizados.

**No se afirma falsamente que todo el roadmap 1–7 está al 100%: las fases 04–07 todavía tienen alcance funcional pendiente.**
