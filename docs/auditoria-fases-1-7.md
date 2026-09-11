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
| 03 Commerce Core | 🟡 Funcional; inventario atómico e identidad de cliente pendientes de endurecimiento | ~65% |
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

**Estado:** arquitectura implementada y reforzada, pero la separación todavía requiere auditoría continua de todos los boundaries y no se considera certificada al 100% únicamente por compilar.

## 3.3 Build Cloudflare y producción

El build/deploy de producción más reciente confirmó:

- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`
- pnpm `10.15.0`
- instalación de dependencias exitosa
- compilación Next.js exitosa
- lint/type checking exitosos
- páginas estáticas generadas
- Worker generado mediante OpenNext
- despliegue Cloudflare exitoso
- migraciones D1 sin cambios pendientes
- `/api/health/live` → HTTP 200
- `/api/health/ready` → HTTP 200
- verificación de producción completada

Además:

- la advertencia de Next.js que modificaba `tsconfig.json` desapareció después de declarar explícitamente `esModuleInterop`;
- los warnings anteriores de Autoprefixer fueron corregidos;
- la verificación de rate limiting mostró una advertencia no bloqueante debido a la consistencia eventual del mecanismo de Cloudflare.

Esto es **evidencia fuerte de build y operación**, pero no certifica por sí solo el cierre total de Foundation.

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

**FASE 01 → ~92%.**

La plataforma, arquitectura base y build productivo están implementados y validados. No se marca 100% porque siguen pendientes la reproducibilidad con lockfile, la auditoría de seguridad completa y la certificación final de los boundaries arquitectónicos.

---

# 4. FASE 02 — Storefront Premium

## 4.1 Capacidades actualmente implementadas

La implementación existente cubre una parte amplia del alcance del storefront:

- catálogo real conectado a D1;
- búsqueda por texto;
- filtros por marca y condición;
- ordenamiento por fecha y precio;
- paginación server-side;
- estado vacío y recuperación hacia el catálogo completo;
- detalle de producto por slug;
- variantes de producto;
- reviews integradas en el detalle;
- FAQ integrada en el detalle;
- productos relacionados;
- galería de imágenes con `next/image`, dimensiones y `sizes` responsivos;
- especificaciones, condición, garantía, batería, capacidad y color;
- estados de disponibilidad/inventario visibles;
- metadata SEO por producto;
- canonical por catálogo/producto;
- Open Graph en producto;
- JSON-LD `Product`, `Offer` y `AggregateRating` cuando corresponde;
- sitemap/robots;
- repositorios D1 e InMemory para el contexto de catálogo;
- capa Domain/Application/Infrastructure para catálogo y búsqueda;
- validaciones de dominio para slug, precio, stock, moneda, garantía y batería;
- tests existentes para el contexto de catálogo.

## 4.2 Evidencia de build

El build/deploy de producción más reciente confirmó que la aplicación completa compila, genera el Worker mediante OpenNext y despliega correctamente en Cloudflare.

También quedaron eliminados los warnings anteriores de Autoprefixer y la advertencia de Next.js sobre modificación automática de `tsconfig.json`.

Esto demuestra **integrabilidad y compilabilidad del storefront**, pero no constituye una prueba exhaustiva de todos los criterios funcionales y no funcionales de Fase 02.

## 4.3 Pendientes para declarar 100%

La fase **NO está cerrada al 100%**. Antes del cierre deben quedar demostrados, como mínimo:

- [ ] taxonomía/categorías completa y navegación coherente con el catálogo final;
- [ ] cobertura completa de filtros y combinaciones de filtros esperadas por negocio;
- [ ] loading, empty, error y recovery en las rutas principales del storefront;
- [ ] accesibilidad auditada, no solo presencia de atributos semánticos;
- [ ] rendimiento real medido en producción, incluyendo LCP/CLS y carga de imágenes;
- [ ] JSON-LD validado para los casos de producto con y sin reviews;
- [ ] sitemap/robots y canonical validados sobre URLs reales;
- [ ] E2E de los flujos principales del storefront con evidencia de ejecución exitosa;
- [ ] cobertura de estados de variantes, stock y producto agotado;
- [ ] regresiones del catálogo y detalle después de las últimas refactorizaciones;
- [ ] validación visual/responsive en los breakpoints principales.

No se considera suficiente decir que Playwright existe en el repositorio: para cerrar la fase se necesita evidencia de que los flujos definidos para Fase 02 realmente pasan.

### Resultado

**FASE 02 → ~90%.**

Está muy avanzada y funcional, pero **permanece abierta** hasta demostrar los puntos de validación anteriores. No se debe subir a 100% por inferencia ni por el simple hecho de que el build de producción sea exitoso.

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

**Regla adicional:** nunca usar 100% como estimación hasta que todos los criterios de cierre definidos para la fase tengan evidencia suficiente. Si existe incertidumbre, se conserva la fase abierta y se estima conservadoramente.

---

# 11. Próximo orden de trabajo

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
  ├─ inventario atómico
  ├─ consistencia transaccional
  └─ sesión/autorización de cliente

        ↓

FASE 04
  └─ Payments real
```
