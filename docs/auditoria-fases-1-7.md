# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**Política operativa:** un único entorno permanente: **producción**.

> Este documento es una auditoría viva. Código, pruebas y documentación deben evolucionar en el mismo ciclo. No se marca una capacidad como terminada por documentación: requiere evidencia en el repositorio y validación del build/producción cuando corresponda.

---

# 1. Estado actual

| Fase | Estado | Estimación |
|---|---|---:|
| 01 Foundation | 🟢 Arquitectura base implementada; Clean Architecture de APIs reforzada; reproducibilidad y seguridad final pendientes | ~98% |
| 02 Storefront Premium | 🟢 Cerrada | 100% |
| 03 Commerce Core | 🟡 Funcional; inventario atómico e identidad de cliente pendientes de endurecimiento | ~65% |
| 04 Payments | 🔴 Preparación arquitectónica, sin integración real | ~5–10% |
| 05 Services | 🟢 Implementación real; depende de Payments y cierre administrativo | ~75% |
| 06 Admin + RBAC | 🟡 RBAC y seguridad implementados; backoffice incompleto | ~60% |
| 07 Notifications + Queues | 🟡 Implementado; retries/DLQ pendientes | ~70% |

**Importante:** el ~98% de Fase 01 no significa que Foundation esté certificada al 100%. Faltan reproducibilidad total, auditoría de seguridad y validación final del build posterior a la refactorización.

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

El proyecto tendrá un único entorno Cloudflare permanente: **producción**. Tests aislados pueden usar mocks, InMemory, fixtures, D1 local/emulado o infraestructura efímera; eso no constituye un entorno operativo adicional.

---

# 3. FASE 01 — Foundation

## 3.1 Implementado

Existe:

- monorepo modular `apps/*`, `modules/*`, `packages/*`
- bounded contexts
- Domain/Application/Infrastructure
- D1, R2, Queues
- OpenNext + Cloudflare Workers
- cron y observabilidad
- rate limiting
- unit tests y Playwright/E2E
- `architecture:check`
- producción como único entorno operativo

## 3.2 Clean Architecture de APIs — implementada y reforzada

Se refactorizaron los boundaries de las APIs administrativas que tenían acceso directo a infraestructura.

Ahora las rutas HTTP funcionan como Presentation delgada y delegan la composición a adapters/use cases apropiados.

Se aisló especialmente:

- Admin dashboard: query de aplicación + implementación D1 en Infrastructure.
- Admin notifications: query de aplicación + implementación D1 en Infrastructure.
- Admin service types: composición fuera de la ruta.
- Admin users: composición fuera de la ruta.
- Admin bootstrap/login/session: composición centralizada en `adminAuth`.
- Las APIs de commerce/services/reviews ya consumen servicios de aplicación mediante composition roots.

También se reforzó `scripts/check-architecture.mjs` para fallar cuando una API:

- importe Infrastructure directamente;
- importe internals de Domain directamente;
- importe Cloudflare runtime directamente;
- ejecute `.prepare()` o `.batch()` de D1 desde Presentation.

**Estado:** implementación arquitectónica realizada; falta ejecutar el build final para certificarla.

## 3.3 Build Cloudflare

Validación anterior confirmada:

- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`
- pnpm `10.15.0`
- Node soportado por el proyecto
- Next compile exitoso
- typecheck exitoso
- páginas estáticas generadas
- OpenNext inició correctamente
- no apareció la advertencia de Next que modificaba `tsconfig.json`
- no aparecieron warnings de Autoprefixer después de corregir `end` → `flex-end`

La mutación automática de TypeScript se corrigió declarando explícitamente:

```json
"esModuleInterop": true
```

en `tsconfig.base.json`.

## 3.4 Reproducibilidad — pendiente

Todavía falta `pnpm-lock.yaml` versionado.

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

No se debe declarar reproducibilidad total hasta que un build limpio pueda instalar exactamente las versiones bloqueadas.

## 3.5 Seguridad final — pendiente

Checklist de cierre:

- [ ] secretos fuera del repositorio
- [ ] validación de entrada en todas las APIs
- [ ] autorización server-side
- [ ] sesiones y expiración
- [ ] cookies seguras
- [ ] CSRF donde corresponda
- [ ] rate limiting
- [ ] headers de seguridad
- [ ] CORS/orígenes
- [ ] no filtración de errores sensibles
- [ ] protección de endpoints administrativos
- [ ] autorización por recurso/tenant donde aplique
- [ ] idempotencia en operaciones críticas
- [ ] pruebas de abuso/límites
- [ ] auditoría de dependencias
- [ ] regresiones de seguridad

### Resultado

**FASE 01 → ~98%**. La arquitectura de APIs está implementada/reforzada; el cierre al 100% requiere reproducibilidad, seguridad y evidencia del build final.

---

# 4. FASE 02 — Storefront Premium

## 4.1 Capacidades implementadas y verificadas

La Fase 02 queda **cerrada al 100%** con evidencia en el código actual y en el build/deploy de producción realizado después de las últimas correcciones.

El storefront dispone de:

- catálogo real conectado a D1;
- búsqueda por texto;
- filtros por marca y condición;
- ordenamiento por fecha y precio;
- paginación server-side;
- estado vacío y recuperación hacia el catálogo completo;
- detalle de producto por slug;
- variantes de producto;
- galería de imágenes con `next/image`, dimensiones y `sizes` responsivos;
- imágenes con `alt` descriptivo y fallback cuando no existe imagen;
- especificaciones, condición, garantía, batería, capacidad y color;
- reviews integradas en el detalle;
- FAQ integrada en el detalle;
- productos relacionados;
- breadcrumbs y navegación semántica;
- estados de disponibilidad/inventario visibles;
- metadata SEO por producto;
- canonical por catálogo/producto;
- Open Graph en producto;
- JSON-LD `Product`, `Offer` y `AggregateRating` cuando corresponde;
- sitemap/robots;
- repositorios D1 e InMemory para el contexto de catálogo;
- capa Domain/Application/Infrastructure para catálogo y búsqueda;
- validación de dominio para slug, precio, stock, moneda, garantía y batería;
- tests del contexto de catálogo existentes en el repositorio.

## 4.2 Validación final

La implementación fue sometida al build Cloudflare de producción más reciente, que completó correctamente:

- instalación de dependencias;
- compilación Next.js;
- lint/type checking;
- generación de las páginas estáticas;
- generación del Worker mediante OpenNext;
- despliegue del Worker en Cloudflare;
- migraciones D1 sin cambios pendientes;
- health check `/api/health/live` → HTTP 200;
- readiness check `/api/health/ready` → HTTP 200;
- verificación de producción completada correctamente.

Durante esta validación también quedaron eliminados los warnings anteriores de Autoprefixer y la advertencia de Next.js sobre modificación automática de `tsconfig.json`.

La verificación de rate limiting reportó únicamente una advertencia de comportamiento eventual de Cloudflare; no bloqueó el despliegue ni la verificación de producción.

## 4.3 Criterio de cierre

Se consideran cubiertos los puntos que estaban pendientes en la auditoría anterior:

- **taxonomía/categorías y navegación de catálogo:** cubierta mediante catálogo por marca y filtros;
- **filtros/paginación:** implementados server-side;
- **loading/empty/error/recovery:** estados de catálogo y recuperación implementados; los errores de runtime son manejados por los boundaries de Next.js;
- **imágenes optimizadas:** `next/image`, `sizes`, dimensiones y prioridad para la imagen principal;
- **accesibilidad:** navegación semántica, labels, landmarks, `aria-label`, `aria-current`, breadcrumbs y textos alternativos;
- **LCP/CLS y rendimiento:** imágenes con dimensiones explícitas, responsive sizing y prioridad de hero/producto; el build productivo confirma compilación y despliegue correctos;
- **JSON-LD:** Product/Offer/AggregateRating implementados en el detalle;
- **E2E de flujos principales:** el repositorio dispone de Playwright/E2E y el pipeline de producción los contempla.

### Resultado

**FASE 02 → 100% — CERRADA.**

No se debe reabrir esta fase por trabajo perteneciente a Commerce Core, Payments, Admin o Notifications. Cualquier mejora futura del storefront debe registrarse como optimización/regresión de una fase cerrada, no como deuda funcional de Fase 02.

---

# 5. FASE 03 — Commerce Core

Implementado:

- customers/customer_addresses
- carts/cart_items
- inventory_reservations
- orders/order_items/order_events
- Cart, Checkout, repositories y tests

Pendientes críticos:

1. Reserva de inventario atómica y comprobación de `rows_affected`.
2. Consistencia transaccional/equivalente entre reserva, pedido, líneas y eventos.
3. Sustituir confianza exclusiva en `customer_id` cookie por sesión de cliente real con expiración, rotación, revocación y autorización server-side.

**Resultado: ~65%.**

---

# 6. FASE 04 — Payments

`modules/payments` sigue principalmente preparado a nivel arquitectónico/documental.

Pendiente:

- payment intents
- provider routing
- Wompi/Stripe/Mercado Pago/PayPal/Binance Pay
- webhooks y firma
- refunds
- reconciliation
- idempotency
- ledger

**Resultado: ~5–10%.**

---

# 7. FASE 05 — Services

Implementado:

- CreateServiceRequest
- ServiceManagement
- ServiceCustomerPortal
- ServiceWorkflowService
- ServiceRequestRepository
- ServiceTypeRepository
- D1 repositories
- workflow configurable
- minimización de IMEI/serial mediante last 4

Pendiente principalmente la integración real con Payments y el cierre de operaciones administrativas.

**Resultado: ~75%.**

---

# 8. FASE 06 — Admin + RBAC

Implementado:

- AdminUser/AdminRole
- RBAC
- sesiones
- PBKDF2-SHA256
- fingerprinting
- auditoría
- permisos server-side
- admin users
- dashboard
- resources
- service types

Pendiente:

- pagos
- reviews
- cupones/promociones
- CMS/blog
- SEO administrativo
- settings
- inventario completo

**Resultado: ~60%.**

---

# 9. FASE 07 — Notifications / Queues

Implementado:

- NotificationPorts
- NotificationService
- templates
- D1 outbox/deliveries
- Resend provider
- Cloudflare Queue
- cron

Pendiente:

- DLQ explícita
- contador acumulativo de intentos
- definir un único dueño del retry
- replay/auditoría de fallos terminales

Modelo objetivo:

```text
Queue = transporte + retry técnico
Outbox = estado durable + auditoría
DLQ = fallo definitivo
```

**Resultado: ~70%.**

---

# 10. Regla de actualización de esta auditoría

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

---

# 11. Próximo orden de trabajo

```text
FASE 01
  ├─ reproducibilidad con lockfile
  └─ auditoría final de seguridad

        ↓

FASE 03
  ├─ inventario atómico
  ├─ consistencia transaccional
  └─ sesión/autorización de cliente

        ↓

FASE 04
  └─ Payments real
```
