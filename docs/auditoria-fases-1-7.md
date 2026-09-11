# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`
**Rama auditada:** `main`

> Este documento es una auditoría viva. Debe reflejar el estado real del código en `main` y no el estado histórico del roadmap. Cada cambio funcional importante debe actualizar código, pruebas y esta auditoría en el mismo ciclo.

---

# 1. Estado real actualizado

| Fase | Estado real actual | Estimación |
|---|---|---:|
| **01 Foundation** | 🟢 Muy avanzada; pendientes de cierre arquitectónico, reproducibilidad y seguridad final | **~95%** |
| **02 Storefront Premium** | 🟢 Prácticamente implementada; requiere validación final | **~90–95%** |
| **03 Commerce Core** | 🟡 Implementada parcialmente; inventario e identidad de cliente requieren endurecimiento | **~65%** |
| **04 Payments** | 🔴 Pendiente de implementación real | **~5–10%** |
| **05 Services** | 🟢 Bastante implementada; depende de Payments y de completar boundaries administrativos | **~75%** |
| **06 Admin + RBAC** | 🟡 RBAC sólido, backoffice todavía incompleto | **~60%** |
| **07 Email + Notifications + Queues** | 🟡 Implementada, pero requiere cerrar retries/DLQ | **~70%** |

**Conclusión:** las fases 1 y 2 están cerca del cierre, pero **las fases 1–7 no están completas**. El porcentaje es una estimación de implementación funcional, no una certificación de producción.

---

# 2. Política de entornos

El proyecto tendrá **un único entorno operativo permanente: producción**.

No se crearán ni mantendrán permanentemente entornos Cloudflare separados de `development` o `staging`.

Esto no significa que no existan pruebas aisladas. Para probar sin crear infraestructura permanente se podrán utilizar:

- mocks
- InMemory repositories
- fixtures
- unit tests
- integration tests aislados
- D1 local/emulado cuando sea necesario
- infraestructura efímera para pruebas técnicas
- E2E dirigidos contra producción cuando corresponda y de forma segura

Cualquier configuración histórica de `development`/`staging` que permanezca en el repositorio se considera deuda de configuración y deberá limpiarse si ya no tiene utilidad.

**Regla:** producción es la única fuente de verdad operativa.

---

# 3. FASE 01 — Foundation

## 3.1 Implementado

Existe una base modular con:

- `apps/web`
- `modules/*`
- bounded contexts
- Domain
- Application
- Infrastructure
- D1
- R2
- Cloudflare Queues
- OpenNext
- Worker
- cron
- observability
- rate limiting
- pruebas unitarias
- Playwright/E2E
- documentación de arquitectura
- `architecture:check`

La dirección arquitectónica definida es:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↑
Infrastructure
```

El dominio no debe depender de Cloudflare, D1, R2 ni SDKs externos.

`wrangler.jsonc` configura Worker, D1, R2, Queue producer/consumer, cron y observabilidad.

## 3.2 Build Cloudflare

El build actual utiliza Next.js + OpenNext para Cloudflare Workers.

Validación reciente:

- Next.js `15.5.25`
- `@opennextjs/cloudflare 1.20.6`
- pnpm `10.15.0`
- Node `22+` requerido por el proyecto
- compilación Next exitosa
- typecheck exitoso
- generación estática exitosa
- OpenNext inicia correctamente

Se corrigió la mutación automática de `tsconfig.json` de Next mediante la declaración explícita de:

```json
"esModuleInterop": true
```

en `tsconfig.base.json`.

Resultado: el build ya no necesita modificar la configuración del proyecto para satisfacer ese requisito de Next/SWC.

También se corrigieron los warnings de Autoprefixer sustituyendo valores `end` por `flex-end`.

## 3.3 CI/CD

El workflow histórico contiene validaciones de arquitectura, lint, typecheck, tests, build Cloudflare y E2E. Sin embargo, el proyecto **no utilizará GitHub Actions como gate obligatorio de producción**.

La producción se despliega desde la configuración de Cloudflare y la validación debe ejecutarse de forma explícita sobre el artefacto/proceso de producción.

El workflow CI redundante fue eliminado previamente.

## 3.4 Reproducibilidad — pendiente de cierre

La reproducibilidad total todavía **no está cerrada**.

El requisito final es:

```text
package.json
+ pnpm-workspace.yaml
+ pnpm-lock.yaml versionado
+ versión fija de pnpm
+ Node soportado/fijado
+ pnpm install --frozen-lockfile
        ↓
build determinista
```

Actualmente el repositorio no tiene `pnpm-lock.yaml` versionado, por lo que todavía no puede declararse reproducibilidad total.

El objetivo es que un build limpio no dependa de cambios dinámicos de configuración ni de resolución flotante de dependencias.

## 3.5 Clean Architecture estricta — pendiente de cierre

Aunque la arquitectura base existe, todavía debe auditarse **cada API**.

Reglas obligatorias para considerar Foundation cerrada:

- las rutas HTTP pertenecen a Presentation
- las rutas no contienen reglas de negocio
- las rutas no acceden directamente a D1 cuando existe un caso de uso/puerto apropiado
- Application orquesta casos de uso
- Domain contiene reglas de negocio puras
- Infrastructure implementa puertos
- las dependencias apuntan hacia dentro
- Cloudflare/D1/R2/SDKs nunca deben filtrarse al dominio
- errores de infraestructura se traducen en errores de aplicación/presentación
- cada API debe tener un boundary explícito
- `architecture:check` debe verificar estas reglas de forma automática

La presencia de código funcional no es suficiente: **el objetivo es cumplimiento estricto en todas las APIs**.

## 3.6 Seguridad final pendiente

Antes de cerrar Foundation deben validarse:

- secretos fuera del repositorio
- validación de entrada en todas las APIs
- autorización server-side
- cookies seguras
- sesiones y expiración
- CSRF donde corresponda
- rate limiting
- headers de seguridad
- CORS/orígenes
- no filtración de secretos en errores/logs
- protección de endpoints administrativos
- control de acceso por recurso/tenant cuando aplique
- idempotencia en operaciones críticas
- pruebas de abuso y límites
- auditoría de dependencias
- pruebas de regresión de seguridad

### Resultado actual

**FASE 1 → ~95%**

No se marca 100% hasta cerrar Clean Architecture, reproducibilidad y seguridad final con evidencia.

---

# 4. FASE 02 — Storefront Premium

El storefront y catálogo tienen implementación real.

Existe `modules/catalog` con:

- `Product`
- `ProductId`
- `GetProduct`
- `SearchProducts`
- `ProductRepository`
- `D1ProductRepository`
- tests
- InMemory repository

El modelo de producto contempla precio, moneda, stock, condición, batería, almacenamiento, color, specs, SEO e imágenes.

Existen rutas de catálogo/producto como:

```text
/catalog
/catalog/[brand]
/productos
/iphone
```

Además existe sitemap/robots y la infraestructura necesaria para SEO.

La implementación actual también contempla funcionalidades de storefront que anteriormente aparecían como pendientes, incluyendo elementos de variantes, reviews, FAQ y productos relacionados.

## 4.1 Validación final pendiente

La fase no debe marcarse 100% hasta validar realmente:

- taxonomía/categorías completa
- búsqueda
- filtros
- paginación
- variantes
- detalle de producto
- reviews
- FAQ
- productos relacionados
- contacto
- loading states
- empty states
- error/recovery states
- optimización de imágenes
- SEO técnico
- JSON-LD donde corresponda
- accesibilidad
- LCP/CLS y rendimiento real
- E2E de los flujos principales

### Resultado actual

**FASE 2 → ~90–95%**

Está prácticamente implementada, pero la validación final debe basarse en evidencia real y no únicamente en la existencia de componentes.

---

# 5. FASE 03 — Commerce Core

Existe código real para:

- customers
- customer_addresses
- carts
- cart_items
- inventory_reservations
- orders
- order_items
- order_events
- Cart
- D1CartRepository
- Order
- Checkout
- D1OrderRepository
- tests

Checkout realiza validación server-side y recalcula el subtotal a partir de cantidad y precio persistido.

## 5.1 Inventario — pendiente crítico

La reserva de stock debe ser atómica y verificable.

El patrón objetivo es:

```sql
UPDATE products
SET stock = stock - ?
WHERE id = ?
  AND stock >= ?
```

seguido de una comprobación equivalente a:

```text
rows_affected == 1
```

Si falla:

```text
ROLLBACK
OUT_OF_STOCK
```

La creación de reserva, pedido, líneas y eventos debe mantener consistencia transaccional o equivalente.

## 5.2 Identidad del cliente — pendiente crítico

El antiguo modelo basado únicamente en `customer_id` cookie no es suficiente como identidad autenticada.

Debe existir una sesión de cliente real, con:

- token firmado/cifrado o sesión server-side
- expiración
- rotación
- revocación
- autorización server-side
- protección CSRF cuando corresponda

### Resultado

**FASE 3 → ~65%**

---

# 6. FASE 04 — Payments

Esta continúa siendo la mayor brecha funcional.

`modules/payments` contiene principalmente la preparación arquitectónica/documental.

Variables de entorno para Wompi, Stripe, Mercado Pago, PayPal y Binance Pay no equivalen a integraciones reales.

Pendiente:

| Capability | Estado |
|---|---|
| Payment intents | ❌ |
| Provider routing | ❌ |
| Wompi | ❌ |
| Stripe | ❌ |
| Mercado Pago | ❌ |
| PayPal | ❌ |
| Binance Pay | ❌ |
| Webhooks | ❌ |
| Signature verification | ❌ |
| Refunds | ❌ |
| Reconciliation | ❌ |
| Idempotency | ❌ |
| Ledger | ❌ |

### Resultado

**FASE 4 → ~5–10%**

---

# 7. FASE 05 — Services

Existe implementación real de:

- `CreateServiceRequest`
- `ServiceManagement`
- `ServiceRequestRepository`
- `ServiceTypeRepository`
- `ServiceWorkflowService`
- `D1ServiceRequestRepository`
- `D1ServiceTypeRepository`

Migrations relevantes:

```text
0004_services.sql
0005_service_types.sql
0006_configurable_service_requests.sql
```

Workflow:

```text
PENDING
 ↓
QUOTED
 ↓
PAYMENT_PENDING
 ↓
PAID
 ↓
PROCESSING
 ↓
WAITING_CUSTOMER
 ↓
COMPLETED
```

También contempla rechazo/refund.

Para minimización de datos se contemplan identificadores parciales como IMEI/serial last 4.

Pendientes:

- integración real con Payments
- completar boundaries de operaciones administrativas
- eliminar lógica de negocio/SQL directa de Presentation cuando corresponda

### Resultado

**FASE 5 → ~75%**

---

# 8. FASE 06 — Admin + RBAC

Existe implementación real de:

- `AdminRole`
- `AdminUser`
- `Rbac`
- `AdminSecurity`
- `D1AdminRepository`
- pruebas de seguridad

`0007_admin.sql` incluye:

- `admin_users`
- `admin_sessions`
- `admin_audit_log`

Roles existentes:

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

La base de seguridad incluye PBKDF2-SHA256, salt, sesiones, expiración, cookies seguras, fingerprinting, auditoría y permisos server-side.

## 8.1 Pendientes

El backoffice todavía necesita completar funcionalidades como:

- pagos
- reviews
- cupones
- promociones
- CMS/blog
- SEO
- notificaciones
- settings
- inventario completo

### Resultado

**FASE 6 → ~60%**

---

# 9. FASE 07 — Notifications / Resend / Queues

Existe implementación real de:

- NotificationPorts
- NotificationService
- NotificationTemplates
- NotificationService.test
- D1NotificationOutboxRepository
- ResendEmailProvider

La migración crea `notification_outbox` y `notification_deliveries` con estados persistentes.

Flujo actual:

```text
Cron
 ↓
D1 Outbox
 ↓
Cloudflare Queue
 ↓
NotificationService
 ↓
Resend
```

## 9.1 Pendientes críticos

### DLQ

Debe existir una estrategia clara para mensajes que superen el máximo de retries:

```text
Queue
 ↓
retry N
 ↓
DLQ
 ↓
alert/audit/manual replay
```

### Contador de intentos

El contador debe persistirse y acumularse correctamente. No debe resetearse artificialmente en cada intento.

### Un único dueño del retry

Debe definirse claramente:

```text
Queue = transporte + retry técnico
Outbox = estado durable + auditoría
DLQ = fallo definitivo
```

Evitar que el cron reprograme indiscriminadamente elementos que todavía están bajo retry de Queue.

### Resultado

**FASE 7 → ~70%**

---

# 10. Auditoría estricta de Clean Architecture

Esta es una tarea transversal obligatoria para cerrar Foundation.

Se debe revisar cada endpoint/API y clasificarlo:

```text
Presentation
   ↓
Application / Use Case
   ↓
Domain
   ↑
Infrastructure
```

## Reglas de aceptación

1. Presentation no contiene reglas de negocio.
2. Presentation no ejecuta SQL directamente cuando corresponde un repository/use case.
3. Application coordina casos de uso y dependencias mediante puertos.
4. Domain es independiente de Cloudflare, D1, R2, HTTP y SDKs.
5. Infrastructure implementa interfaces definidas hacia dentro.
6. Los DTOs HTTP no contaminan el dominio.
7. Los errores se traducen en cada boundary.
8. Tests de dominio no requieren Cloudflare.
9. Tests de Application pueden usar InMemory/mocks.
10. Las reglas arquitectónicas se automatizan con `architecture:check`.

No se considerará suficiente mover archivos de una carpeta a otra: debe cumplirse la dirección real de dependencias.

---

# 11. Reproducibilidad total del build

Checklist de cierre:

- [ ] `pnpm-lock.yaml` versionado
- [ ] `pnpm install --frozen-lockfile` exitoso
- [ ] versión de pnpm fija
- [ ] versión mínima de Node declarada y entorno de build controlado
- [ ] dependencias transitivas resueltas de forma determinista
- [ ] build Cloudflare repetible desde un checkout limpio
- [ ] producción no modifica `tsconfig.json` ni otros archivos de configuración
- [ ] no se depende de artefactos generados previamente
- [ ] no se requieren cambios manuales después de instalar dependencias
- [ ] artefacto final reproducible a partir del commit

Estado actual: **pendiente**, principalmente por ausencia del lockfile versionado.

---

# 12. Validación final de seguridad

Antes de marcar Foundation como 100%:

- [ ] autenticación y autorización revisadas endpoint por endpoint
- [ ] aislamiento de recursos/clientes validado
- [ ] cookies y sesiones endurecidas
- [ ] CSRF evaluado
- [ ] CORS/origin policy revisada
- [ ] rate limiting validado
- [ ] input validation completa
- [ ] SQL parametrizado
- [ ] secretos no expuestos
- [ ] errores sin información sensible
- [ ] logs sin secretos/PII innecesaria
- [ ] admin RBAC probado contra escalada de privilegios
- [ ] endpoints internos protegidos
- [ ] idempotencia de operaciones críticas
- [ ] dependencias auditadas
- [ ] E2E de seguridad críticos
- [ ] pruebas de regresión después de cada corrección

---

# 13. Validación de producción

Como el proyecto tendrá **un único entorno operativo**, la validación final se centra en producción.

Checklist:

- [ ] build limpio
- [ ] deploy exitoso
- [ ] D1 migrations verificadas
- [ ] `/api/health/live` = 200
- [ ] `/api/health/ready` = 200
- [ ] bindings Worker correctos
- [ ] Queue producer/consumer funcional
- [ ] R2 funcional
- [ ] rate limiting verificado
- [ ] autenticación/autorización verificada
- [ ] storefront E2E principal
- [ ] checkout E2E cuando Payments esté implementado
- [ ] admin E2E crítico
- [ ] notifications E2E
- [ ] observabilidad y logs revisados
- [ ] no hay configuración mutada por el build

No se requiere mantener tres despliegues Cloudflare para cumplir esta validación.

---

# 14. Política de sincronización del documento

Para evitar que el `.md` vuelva a quedar desactualizado:

```text
1. Implementar código
        ↓
2. Agregar/actualizar tests
        ↓
3. Ejecutar validaciones
        ↓
4. Verificar producción cuando aplique
        ↓
5. Actualizar esta auditoría
        ↓
6. Registrar evidencia real
```

Reglas:

- Si una funcionalidad no existe en código, no se marca como implementada.
- Si existe código pero no está validado, se marca como implementado pero pendiente de validación.
- Si una corrección cambia una fase, el porcentaje y checklist se actualizan en el mismo ciclo.
- No se conservan afirmaciones históricas que contradigan el estado actual de `main`.

---

# 15. Orden de trabajo actual

## Prioridad 1 — Cerrar Foundation

1. Auditoría estricta de Clean Architecture de todas las APIs.
2. Eliminar SQL/reglas de negocio indebidas de Presentation.
3. Fortalecer `architecture:check`.
4. Resolver reproducibilidad total con lockfile versionado.
5. Confirmar build limpio y determinista.
6. Ejecutar auditoría final de seguridad.

## Prioridad 2 — Cerrar Storefront

1. Validar todas las capacidades del storefront.
2. E2E de navegación, catálogo, búsqueda, detalle y conversión.
3. Accesibilidad.
4. Performance.
5. SEO.
6. Estados loading/empty/error/recovery.

## Prioridad 3 — Commerce Core

1. Reserva de inventario atómica.
2. Consistencia transaccional.
3. Sesión real de cliente.
4. Autorización por recurso.
5. Idempotencia.

## Prioridad 4 — Payments

Implementar el bounded context completo antes de considerar cerradas las fases que dependen de pagos.

## Prioridad 5 — Services / Admin / Notifications

Completar los gaps restantes después de Payments y mantener este documento sincronizado en cada ciclo.

---

# 16. Estado maestro

```text
FASE 01  Foundation              ~95%  🟢 Casi cerrada
FASE 02  Storefront Premium      ~90–95% 🟢 Casi cerrada
FASE 03  Commerce Core           ~65%  🟡
FASE 04  Payments                ~5–10% 🔴
FASE 05  Services                ~75%  🟢
FASE 06  Admin + RBAC            ~60%  🟡
FASE 07  Notifications/Queues    ~70%  🟡
```

**Siguiente objetivo técnico:** cerrar Fase 01 con Clean Architecture estricta + reproducibilidad total + seguridad final, y después cerrar la validación de Fase 02.

> Este archivo debe mantenerse actualizado en `main` junto con cada cambio relevante de implementación. No se debe volver a considerar un requisito como implementado únicamente porque exista documentación o scaffolding.