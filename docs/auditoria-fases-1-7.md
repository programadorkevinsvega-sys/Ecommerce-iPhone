# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**Política operativa:** un único entorno permanente: **producción**.

> Este documento es una auditoría viva. Código, pruebas y documentación deben evolucionar en el mismo ciclo. No se marca una capacidad como terminada por documentación: requiere evidencia en el repositorio y validación del build/producción cuando corresponda.

> **Regla de rigor:** ninguna fase se marca al 100% mientras exista deuda funcional, de seguridad, pruebas, reproducibilidad, rendimiento o evidencia pendiente que forme parte de su alcance. Un build exitoso no convierte por sí solo una fase en 100%.

---

# 1. Estado actual

| Fase | Estado | Estimación |
|---|---|---:|
| 01 Foundation | 🟢 Arquitectura y plataforma implementadas; reproducibilidad y seguridad final pendientes | ~92% |
| 02 Storefront Premium | 🟢 Implementación amplia; validación funcional, accesibilidad, rendimiento y E2E completos pendientes | ~90% |
| 03 Commerce Core | 🟢 Núcleo endurecido y desplegado; certificación funcional profunda aún pendiente | ~90% |
| 04 Payments | 🔴 Preparación arquitectónica, sin integración real | ~5–10% |
| 05 Services | 🟢 Implementación real; depende de Payments y cierre administrativo | ~75% |
| 06 Admin + RBAC | 🟡 RBAC y seguridad implementados; backoffice incompleto | ~60% |
| 07 Notifications + Queues | 🟡 Implementado; retries/DLQ pendientes | ~70% |

**Importante:** los porcentajes son estimaciones de cierre, no métricas de código. No se redondea una fase a 100% por tener la mayor parte de sus componentes implementados. El 100% exige evidencia suficiente de implementación, pruebas y operación para todo el alcance definido.

---

# 2. Arquitectura y política de entornos

La arquitectura objetivo es:

```text
HTTP / Next.js Route (Presentation)
             ↓
      Application / Use Case
             ↓
            Domain
             ↑
 Infrastructure / Adapters
```

Reglas:

- Presentation no ejecuta SQL/D1 directamente.
- Presentation no importa implementaciones `modules/*/infrastructure`.
- Presentation no importa internals de `modules/*/domain`.
- Application no depende de Infrastructure, Presentation, Next.js o Cloudflare.
- Domain no depende de HTTP, Next.js, Cloudflare, D1, R2 ni SDKs externos.
- Infrastructure implementa puertos definidos hacia dentro.
- La composición de Cloudflare/D1 se concentra en adaptadores/composition roots bajo `apps/web/lib`.
- Los errores se traducen en los boundaries HTTP.
- `architecture:check` debe detectar automáticamente las violaciones.

El proyecto tiene un único entorno Cloudflare permanente: **producción**. Tests aislados pueden usar mocks, InMemory, fixtures, D1 local/emulado o infraestructura efímera; eso no constituye un entorno operativo adicional.

---

# 3. FASE 01 — Foundation

## 3.1 Implementado

Existe:

- monorepo modular `apps/*`, `modules/*`, `packages/*`;
- bounded contexts;
- Domain/Application/Infrastructure;
- D1, R2, Queues;
- OpenNext + Cloudflare Workers;
- cron y observabilidad;
- rate limiting;
- unit tests y Playwright/E2E;
- `architecture:check`;
- producción como único entorno operativo.

## 3.2 Clean Architecture de APIs

Se refactorizaron los boundaries de las APIs administrativas que tenían acceso directo a infraestructura.

Ahora las rutas HTTP funcionan como Presentation delgada y delegan la composición a adapters/use cases apropiados.

Se aisló especialmente:

- Admin dashboard: query de aplicación + implementación D1 en Infrastructure.
- Admin notifications: query de aplicación + implementación D1 en Infrastructure.
- Admin service types: composición fuera de la ruta.
- Admin users: composición fuera de la ruta.
- Admin bootstrap/login/session: composición centralizada en `adminAuth`.
- APIs de commerce/services/reviews consumen servicios de aplicación mediante composition roots.

También se reforzó `scripts/check-architecture.mjs` para fallar cuando una API:

- importe Infrastructure directamente;
- importe internals de Domain directamente;
- importe Cloudflare runtime directamente;
- ejecute `.prepare()` o `.batch()` de D1 desde Presentation.

**Estado:** arquitectura implementada y reforzada, pero la separación todavía requiere auditoría continua y no se considera certificada al 100% únicamente por compilar.

## 3.3 Build y producción — evidencia 2026-09-11

El deploy real más reciente de Cloudflare finalizó correctamente.

Evidencia observada:

- pnpm `10.15.0`;
- Node.js `24.18.0` en el entorno de build;
- Next.js `15.5.25`;
- `@opennextjs/cloudflare 1.20.6`;
- instalación de dependencias exitosa;
- compilación Next.js exitosa;
- lint/type checking exitosos;
- **25/25 páginas estáticas generadas**;
- Worker generado mediante OpenNext;
- Worker desplegado correctamente;
- Cloudflare Worker `ecommerce-iphone` actualizado;
- versión desplegada: `e7f0b7fd-3e73-4897-ae2b-e3c0049e1815`;
- `/api/health/live` → HTTP 200;
- `/api/health/ready` → HTTP 200;
- verificación de producción → **PASS**;
- comando de deploy → **Success**.

Bindings de producción confirmados durante el deploy:

- D1 `ecommerce-iphone`;
- R2 `ecommerce-iphone-media`;
- Queue `ecommerce-iphone-events`;
- rate limiter general `120 requests/60s`;
- rate limiter sensible `20 requests/60s`;
- `APP_ENV=production`.

La comprobación automática de rate limiting mostró una advertencia no bloqueante porque no obtuvo HTTP 429 después de 21 solicitudes; el propio verificador reconoce la consistencia eventual del Rate Limiting de Cloudflare. Esto no invalidó el deploy ni los health checks.

**Importante:** esta evidencia sustituye cualquier estado anterior que describiera el último deploy como pendiente. El deploy real de esta versión fue exitoso.

## 3.4 Migraciones D1 de producción — aplicadas

Durante el deploy del 2026-09-11 se aplicaron correctamente en la base D1 remota:

- `0012_inventory_reservation_cleanup.sql` → ✅;
- `0013_inventory_reservation_order_link.sql` → ✅.

Por tanto, la documentación ya no debe indicar que estas migraciones están pendientes de producción.

## 3.5 Reproducibilidad — pendiente

Todavía falta completar la política de instalación determinista con `pnpm-lock.yaml` versionado y Node controlado.

Objetivo:

```text
package.json
+ pnpm-workspace.yaml
+ pnpm-lock.yaml
+ pnpm 10.15.0
+ Node controlado
        ↓
pnpm install --frozen-lockfile
        ↓
build determinista
```

No se declara reproducibilidad total hasta que un build limpio pueda instalar exactamente las versiones bloqueadas.

## 3.6 Seguridad final — pendiente

Checklist de cierre:

- [ ] secretos fuera del repositorio;
- [ ] validación de entrada en todas las APIs;
- [ ] autorización server-side;
- [ ] sesiones y expiración;
- [ ] cookies seguras;
- [ ] CSRF donde corresponda;
- [ ] rate limiting;
- [ ] headers de seguridad;
- [ ] CORS/orígenes;
- [ ] no filtración de errores sensibles;
- [ ] protección de endpoints administrativos;
- [ ] autorización por recurso/tenant donde aplique;
- [ ] idempotencia en operaciones críticas;
- [ ] pruebas de abuso/límites;
- [ ] auditoría de dependencias;
- [ ] regresiones de seguridad.

### Resultado

**FASE 01 → ~92%.**

La plataforma, arquitectura base y build productivo están implementados y validados. No se marca 100% porque siguen pendientes la reproducibilidad, la auditoría de seguridad completa y la certificación final de los boundaries arquitectónicos.

---

# 4. FASE 02 — Storefront Premium

## 4.1 Capacidades actualmente implementadas

- catálogo real conectado a D1;
- búsqueda por texto;
- filtros por marca y condición;
- ordenamiento por fecha y precio;
- paginación server-side;
- estados vacío/error/recovery existentes;
- detalle de producto por slug;
- variantes de producto;
- reviews integradas;
- FAQ integrada;
- productos relacionados;
- galería de imágenes con `next/image`, dimensiones y `sizes` responsivos;
- especificaciones, condición, garantía, batería, capacidad y color;
- disponibilidad/inventario visible;
- metadata SEO por producto;
- canonical;
- Open Graph;
- JSON-LD `Product`, `Offer` y `AggregateRating` cuando corresponde;
- sitemap/robots;
- repositorios D1 e InMemory;
- Domain/Application/Infrastructure para catálogo y búsqueda;
- validaciones de dominio para slug, precio, stock, moneda, garantía y batería.

## 4.2 Evidencia de producción

El deploy del 2026-09-11 confirmó que el storefront completo compila, genera el Worker mediante OpenNext y se despliega correctamente en Cloudflare.

## 4.3 Pendientes para declarar 100%

- [ ] taxonomía/categorías completa;
- [ ] cobertura completa de filtros y combinaciones;
- [ ] loading, empty, error y recovery auditados en rutas principales;
- [ ] accesibilidad auditada;
- [ ] rendimiento real medido en producción, incluyendo LCP/CLS;
- [ ] JSON-LD validado en casos relevantes;
- [ ] sitemap/robots/canonical validados con URLs reales;
- [ ] E2E de flujos principales con evidencia de ejecución;
- [ ] cobertura de variantes, stock y agotados;
- [ ] regresiones del catálogo/detalle;
- [ ] validación visual/responsive.

### Resultado

**FASE 02 → ~90%.**

Permanece abierta hasta demostrar los puntos de validación anteriores.

---

# 5. FASE 03 — Commerce Core

## 5.1 Hardening implementado

El núcleo commerce tiene implementados:

- customers/customer_addresses;
- carts/cart_items;
- sesiones reales de cliente con token hash, expiración y revocación;
- autorización server-side de identidad;
- ownership explícito de carrito en Application/Repository;
- ownership de pedidos por `customerId`;
- checkout protegido contra carrito de otro cliente;
- inventario con decremento atómico condicionado por `active=1 AND stock>=quantity`;
- rollback transaccional de checkout ante falta de stock;
- idempotencia mediante `checkout_idempotency`, incluyendo carreras;
- precios server-side recalculados desde `products`/`product_variants` justo antes del checkout;
- nombres/slugs/precios de líneas derivados del catálogo server-side;
- reservas enlazadas al pedido;
- expiración de reservas consciente del estado del pedido;
- `releaseForOrder()` para liberar y devolver stock una sola vez;
- `consumeForOrder()` para cerrar la reserva sin devolver stock;
- limpieza de reservas legacy mediante migración `0012`;
- enlace reserva → pedido mediante migración `0013`;
- `OrderCreated` con ID determinista para evitar duplicación por reintentos;
- pruebas adicionales para sesión, ownership de carrito, autenticación, stock, shipping y ciclo de checkout.

## 5.2 Modelo de inventario actual

El checkout crea el pedido en `PENDING_PAYMENT`, decrementa stock atómicamente y crea una reserva enlazada al `order_id` con expiración de 15 minutos.

```text
PENDING_PAYMENT / PAYMENT_PROCESSING + reserva expirada
        ↓
liberar reserva + devolver stock una sola vez

PAID / PROCESSING / SHIPPED / etc. + reserva expirada
        ↓
cerrar reserva SIN devolver stock

fallo/cancelación de pago
        ↓
releaseForOrder(orderId)
        ↓
restaurar stock una sola vez

pago confirmado
        ↓
consumeForOrder(orderId)
        ↓
cerrar reserva SIN restaurar stock
```

Payments todavía no está integrado. Los hooks quedan preparados para la transición real de pago de Fase 04.

## 5.3 Seguridad de carrito y cliente

Para un cliente autenticado:

```text
customer_session
      ↓
resolve session
      ↓
customerId
      ↓
claim(cartId, customerId)
      ↓
getOwnedByCustomer(cartId, customerId)
      ↓
checkout
```

Esto elimina el problema previo de utilizar un `cart_id` perteneciente a otro cliente.

Para guest checkout, el carrito anónimo se reclama al cliente creado durante el checkout. Si el email ya pertenece a un cliente, se exige una sesión válida.

## 5.4 Precios server-side

El precio almacenado en `cart_items` no es autoridad final para cobrar. Antes de crear el pedido, Infrastructure vuelve a consultar producto y variante activa. Subtotal y total se calculan con precios server-side.

## 5.5 Idempotencia y notificaciones

`Idempotency-Key` es obligatoria. El repositorio:

- valida la key;
- registra key → customer → order;
- devuelve el pedido existente para reintentos del mismo cliente;
- rechaza el uso de una key existente por otro cliente;
- protege carreras mediante unicidad y relectura después del fallo del batch.

El evento utiliza `order-created:{orderId}` como ID determinista.

## 5.6 Evidencia de producción — 2026-09-11

El hardening fue desplegado en producción y las migraciones relacionadas se aplicaron correctamente.

Verificado durante el deploy:

- Worker actualizado → ✅;
- D1 remoto actualizado → ✅;
- migración `0012` → ✅;
- migración `0013` → ✅;
- `/api/health/live` → 200;
- `/api/health/ready` → 200;
- verificación de producción → PASS.

**No se considera que esto certifique automáticamente todos los escenarios de negocio críticos.** Los health checks demuestran operación de la aplicación, no concurrencia ni todas las invariantes de checkout.

## 5.7 Pendientes de certificación funcional

- [ ] prueba real de dos checkouts concurrentes sobre stock limitado;
- [ ] prueba real de dos requests con la misma `Idempotency-Key`;
- [ ] prueba real de reintento de notificación sin duplicación en outbox;
- [ ] prueba real de carrito A contra sesión B;
- [ ] prueba real de checkout guest con email existente;
- [ ] prueba real de expiración de reserva `PENDING_PAYMENT` y devolución única de stock;
- [ ] prueba real de reserva asociada a `PAID` sin devolución de stock;
- [ ] integración real de `releaseForOrder()`/`consumeForOrder()` con Payments;
- [ ] validación de invariantes de checkout contra D1 de producción.

### Resultado

**FASE 03 → ~90%.**

El hardening crítico está implementado y desplegado. El porcentaje sube respecto a la auditoría anterior porque las migraciones `0012/0013` ya fueron aplicadas en producción y el deploy completo pasó. La fase permanece abierta por certificación funcional profunda y porque Payments todavía no existe como integración real.

> **Nota sobre CI:** el estado de GitHub Actions no forma parte del criterio de aceptación de esta auditoría. La evidencia operativa relevante es el build/deploy real de Cloudflare, las migraciones remotas y la verificación directa de producción.

---

# 6. FASE 04 — Payments

`modules/payments` sigue principalmente preparado a nivel arquitectónico/documental.

Pendiente:

- payment intents;
- provider routing;
- Wompi/Stripe/Mercado Pago/PayPal/Binance Pay;
- webhooks y firma;
- refunds;
- reconciliation;
- idempotency;
- ledger;
- integración con `consumeForOrder()` en pago confirmado;
- integración con `releaseForOrder()` en pago fallido/cancelado.

**Resultado: ~5–10%.**

---

# 7. FASE 05 — Services

Implementado:

- CreateServiceRequest;
- ServiceManagement;
- ServiceCustomerPortal;
- ServiceWorkflowService;
- ServiceRequestRepository;
- ServiceTypeRepository;
- D1 repositories;
- workflow configurable;
- minimización de IMEI/serial mediante last 4.

Pendiente principalmente la integración real con Payments y el cierre de operaciones administrativas.

**Resultado: ~75%.**

---

# 8. FASE 06 — Admin + RBAC

Implementado:

- AdminUser/AdminRole;
- RBAC;
- sesiones;
- PBKDF2-SHA256;
- fingerprinting;
- auditoría;
- permisos server-side;
- admin users;
- dashboard;
- resources;
- service types.

Pendiente:

- pagos;
- reviews;
- cupones/promociones;
- CMS/blog;
- SEO administrativo;
- settings;
- inventario completo.

**Resultado: ~60%.**

---

# 9. FASE 07 — Notifications / Queues

Implementado:

- NotificationPorts;
- NotificationService;
- templates;
- D1 outbox/deliveries;
- Resend provider;
- Cloudflare Queue;
- cron;
- eventos de checkout con IDs deterministas para evitar duplicados por reintento.

Pendiente:

- DLQ explícita;
- contador acumulativo de intentos;
- definir un único dueño del retry;
- replay/auditoría de fallos terminales.

Modelo objetivo:

```text
Queue = transporte + retry técnico
Outbox = estado durable + auditoría
DLQ = fallo definitivo
```

**Resultado: ~70%.**

---

# 10. Evidencia operativa más reciente

**Fecha:** 2026-09-11  
**Proveedor:** Cloudflare  
**Worker:** `ecommerce-iphone`  
**Version ID:** `e7f0b7fd-3e73-4897-ae2b-e3c0049e1815`

Resultado:

```text
Build                         PASS
Next.js compile               PASS
TypeScript / lint             PASS
Static pages                  25/25 PASS
OpenNext bundle               PASS
Cloudflare Worker deploy      PASS
D1 migration 0012             PASS
D1 migration 0013             PASS
Health live                   HTTP 200
Health ready                  HTTP 200
Production verification       PASS
Deploy command                Success
```

El único warning observado fue la prueba automática de rate limiting, que no recibió HTTP 429 tras 21 solicitudes. El warning no bloqueó el deploy y es consistente con la naturaleza eventualmente consistente del Rate Limiting de Cloudflare.

---

# 11. Regla de actualización de esta auditoría

Cada cambio debe seguir:

```text
1. Implementar código
2. Añadir/ajustar pruebas
3. Ejecutar validación disponible
4. Validar producción cuando sea una capacidad productiva
5. Actualizar este documento
6. Cambiar porcentajes únicamente con evidencia
```

Nunca se debe permitir:

```text
Código implementado ≠ documentación desactualizada
Documentación actualizada ≠ código inexistente
```

**Regla adicional:** nunca usar 100% como estimación hasta que todos los criterios de cierre definidos para la fase tengan evidencia suficiente. Si existe incertidumbre, se conserva la fase abierta y se estima conservadoramente.

---

# 12. Próximo orden de trabajo

```text
FASE 01
  ├─ reproducibilidad con lockfile
  ├─ auditoría final de seguridad
  └─ certificación completa de boundaries arquitectónicos

        ↓

FASE 02
  ├─ E2E de storefront
  ├─ auditoría de accesibilidad
  ├─ rendimiento real LCP/CLS
  ├─ validación SEO/JSON-LD/sitemap
  ├─ estados de error/loading/recovery
  └─ validación responsive/regresiones

        ↓

FASE 03
  ├─ concurrencia de stock
  ├─ idempotencia concurrente
  ├─ ownership guest/autenticado
  ├─ ciclo completo de reservas
  └─ validación profunda de invariantes contra producción

        ↓

FASE 04
  ├─ Payments real
  ├─ consumeForOrder() en pago confirmado
  └─ releaseForOrder() en pago fallido/cancelado
```

---

## Última actualización

**2026-09-11 — Deploy Cloudflare de producción exitoso, migraciones `0012` y `0013` aplicadas, health checks y verificación de producción PASS.**

Esta auditoría queda sincronizada con el estado operativo real y no utiliza el estado de GitHub Actions como criterio de aceptación.
