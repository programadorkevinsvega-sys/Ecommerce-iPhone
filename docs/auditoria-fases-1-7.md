# Auditoría viva y plan maestro — Fases 1 a 7

## Ecommerce-iPhone

**Repositorio:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Rama:** `main`  
**HEAD de código auditado:** `dc05c87d1c32572be1df852c29fc152b4e5cfb65`  
**Última actualización:** 2026-09-12  
**Entorno operativo:** **producción únicamente**.

> Esta auditoría es la fuente de verdad del roadmap de implementación. Una fase solo puede declararse 100% cuando código, pruebas, seguridad, reproducibilidad y evidencia operativa de su alcance estén cerrados. Compilar o tener CI verde no equivale a certificación.

---

# 1. Estado de cierre

| Fase | Estado | Cierre de código | Certificación final |
|---|---|---:|---:|
| 01 Foundation | 🟢 Implementada | Alta | Pendiente auditoría final |
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

## Reproducibilidad

El enforcement de reproducibilidad queda **cerrado para el pipeline de build de Cloudflare y GitHub Actions**.

- `package.json` fija `pnpm@10.15.0`.
- `package.json` fija exactamente `engines.node = 24.18.0`.
- `.node-version` y `.nvmrc` fijan `24.18.0`.
- `.npmrc` fija `frozen-lockfile=true` y `engine-strict=true`.
- `pnpm-lock.yaml` está versionado en `main`.
- `scripts/verify-install.mjs` bloquea explícitamente `--no-frozen-lockfile` y versiones Node distintas de `24.18.0`.
- Cloudflare validó Node `24.18.0`, pnpm `10.15.0` y `pnpm install --frozen-lockfile` en build limpio.
- Ambos pasos de instalación confirmaron `Lockfile is up to date, resolution step is skipped`; el segundo terminó con `Already up to date`.
- La instalación completó `621` paquetes sin modificar el lockfile.
- `next build` compiló correctamente, pasó lint/typecheck y generó `40/40` páginas estáticas.
- OpenNext generó `.open-next/worker.js` y terminó con `OpenNext build complete`.
- El build posterior de producción volvió a completar el mismo proceso sin migraciones pendientes.
- GitHub Actions queda fijado también en Node `24.18.0`, alineado con `engines.node`.

El build suministrado por Cloudflare fue confirmado por el usuario como ejecución **con caché limpia**, por lo que el gate adicional de reproducibilidad desde caché vacía queda cerrado.

## Evidencia operativa — 2026-09-12

### Build reproducible + upload de versión — 01:22:24–01:24:36 UTC

- Node `24.18.0` y pnpm `10.15.0` detectados.
- `pnpm install --frozen-lockfile` ejecutado por Cloudflare.
- Segundo `pnpm install --frozen-lockfile` ejecutado por el comando de usuario.
- Lockfile sin cambios y 621 paquetes instalados/reutilizados.
- `next build` exitoso; lint/typecheck exitosos; `40/40` páginas estáticas.
- OpenNext completo.
- `wrangler versions upload` exitoso.
- Worker Version ID: `dc62c79f-cdd4-4dfb-b0a4-2862acfdb8fe`.

### Deploy productivo + verificación — 01:34:16–01:36:09 UTC

El comando configurado en Cloudflare ejecutó:

`pnpm deploy:cloudflare` → `pnpm db:migrate:production && pnpm build:cloudflare && wrangler deploy --env="" && pnpm verify:production`

Evidencia:

- D1 remoto: `No migrations to apply!`.
- Next.js `15.5.25` compiló correctamente.
- Lint y typecheck completaron correctamente.
- Se generaron `40/40` páginas estáticas.
- OpenNext finalizó correctamente.
- Worker subido correctamente.
- Bindings D1, R2, Queue, Assets y rate limiters presentes.
- `APP_ENV="production"` presente.
- Triggers desplegados: cron cada minuto + producer/consumer de `ecommerce-iphone-events`.
- **Version ID productivo actual:** `b6226472-9f1a-4996-a4a1-ec8d62c0b59f`.
- `/api/health/live`: HTTP 200.
- `/api/health/ready`: HTTP 200.
- `verify:production`: PASS.
- El smoke de rate limit emitió warning al no observar `429` después de 21 requests; sigue siendo warning por consistencia eventual, no fallo de despliegue.

Este evento certifica **migrations + build + deploy a tráfico productivo + triggers + health + verify:production** para la versión `b6226472-9f1a-4996-a4a1-ec8d62c0b59f`.

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

`0017_payment_refunds.sql` y `0018_payment_refund_locks.sql` están versionadas. El último deploy confirmó `No migrations to apply!`.

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

Para esta iteración se agregaron pruebas de infraestructura sobre `D1OrderRepository` y `D1ReservationRepository` usando un arnés SQLite respaldado por `node:sqlite` que ejecuta transacciones y restricciones sobre una base efímera. Las pruebas cubren:

- dos checkouts concurrentes con el mismo `Idempotency-Key` → exactamente una orden;
- dos customers con la misma clave → rechazo de ownership y ninguna segunda orden;
- dos claves diferentes contra el último stock → exactamente un ganador;
- rollback del batch perdedor → sin orden, reserva o decremento parcial;
- reutilización después de expiración de `Idempotency-Key`;
- doble `releaseExpired()` concurrente → devolución de stock exactamente una vez;
- carrera `CANCELLED` entre `releaseExpired()` y `releaseForOrder()` → devolución exactamente una vez;
- reservas terminales pagadas no devuelven stock nuevamente;
- reservas no expiradas permanecen intactas.

Durante esta cobertura se detectó y corrigió un caso de carrera real en `D1ReservationRepository`: `CANCELLED` debía compartir la ruta atómica de devolución de stock con `PENDING_PAYMENT`/`PAYMENT_PROCESSING`; de lo contrario, `releaseExpired()` podía marcar la reserva como liberada sin devolver stock si ganaba la carrera frente a `releaseForOrder()`.

La ejecución del suite completo queda pendiente de evidencia CI/build; el código de las pruebas y la corrección ya están en la rama de hardening.

## 8.12 Pendientes inmediatos de F6

1. ejecutar y certificar el suite de concurrencia/checkout agregado en esta iteración;
2. tests IDOR/BOLA de carrito y pedidos con dos customers;
3. certificación guest vs autenticado;
4. coherencia completa Order/Payment state machines;
5. refund/void: idempotencia, concurrencia, state machine y auditoría;
6. tests de privilege escalation vertical/horizontal;
7. tests de sesiones administrativas, abuso y rate limiting;
8. tests de auditoría y no exposición de secretos;
9. regresión real de Payments, Commerce Core, Services e Inventory;
10. gates técnicos y certificación exclusivamente en producción.

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
- [x] state machine Payment aplicada también en repository;
- [ ] idempotencia checkout certificada;
- [ ] concurrencia stock/payments/orders certificada;
- [ ] auditoría atómica de todas las operaciones sensibles;
- [x] cobertura de carrera checkout/idempotencia agregada;
- [x] cobertura de rollback de reserva y release idempotente agregada.

### Tests

- [x] Order state machine;
- [x] Payment state machine existente;
- [ ] integración D1 producción;
- [ ] RBAC matrix;
- [ ] authentication/session;
- [ ] audit;
- [ ] IDOR/BOLA;
- [ ] negative authorization;
- [ ] orders regression;
- [ ] payments/refunds/void regression;
- [x] inventory concurrency — pruebas agregadas, ejecución CI pendiente.

### Gates técnicos

- [ ] `foundation:check`;
- [ ] `architecture:check`;
- [ ] format;
- [ ] lint;
- [ ] typecheck;
- [ ] unit tests;
- [ ] integration tests;
- [x] Cloudflare build reproducible — build 2026-09-12 01:22–01:24 UTC con `pnpm install --frozen-lockfile`, Node 24.18.0, pnpm 10.15.0 y OpenNext completo;
- [x] build limpio — ejecución confirmada por el usuario con caché limpia;
- [x] migrations production — `No migrations to apply!` en deploy 2026-09-12;
- [x] deploy production — version `b6226472-9f1a-4996-a4a1-ec8d62c0b59f`;
- [x] health live/ready — HTTP 200 en ambos endpoints;
- [x] `verify:production` — PASS.

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

- [x] `pnpm-lock.yaml` versionado en el repositorio;
- [x] `pnpm install --frozen-lockfile` validado en build Cloudflare;
- [x] enforcement de `--frozen-lockfile` en Cloudflare mediante comando `pnpm install --frozen-lockfile && pnpm build:cloudflare` y `.npmrc`;
- [x] runtime Node exacto del build — `24.18.0`;
- [x] guard de instalación `scripts/verify-install.mjs` contra `--no-frozen-lockfile` y Node no soportado;
- [x] GitHub Actions Node fijado a `24.18.0`;
- [x] build Cloudflare reproducible y limpio desde caché vacía;
- [x] producción desplegada y verificada.

> El build de Cloudflare del 2026-09-12 01:22–01:24 UTC validó la configuración final: Node `24.18.0`, pnpm `10.15.0`, `pnpm install --frozen-lockfile`, lockfile sin cambios, `next build` exitoso, `40/40` páginas estáticas y OpenNext completo. El deploy productivo posterior del 2026-09-12 01:34–01:36 UTC confirmó migraciones, despliegue a tráfico productivo, triggers, health y `verify:production` PASS, con versión `b6226472-9f1a-4996-a4a1-ec8d62c0b59f`.

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

1. ejecutar suite de concurrencia/checkout agregada;
2. ownership/IDOR/BOLA de carritos y pedidos;
3. guest vs autenticado;
4. state machines Order/Payment;
5. refund/void idempotencia + concurrencia;
6. tests críticos RBAC/sesiones/auditoría;
7. gates técnicos restantes;
8. deploy exclusivamente a producción;
9. certificación funcional;
10. actualizar esta auditoría con commit, SHA y evidencia.

**Regla permanente:** este documento debe actualizarse en la misma iteración de cada cambio relevante de código.
