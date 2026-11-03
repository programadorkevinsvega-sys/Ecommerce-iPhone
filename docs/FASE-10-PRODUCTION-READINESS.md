# Fase 10 — Plan de implementación: Production Readiness

> Documento operativo de la Fase 10 del roadmap. Define las subfases técnicas que deben auditarse, implementarse, probarse y certificarse antes de cerrar la fase.
>
> **Regla global:** ninguna subfase se considera terminada por compilar. El cierre exige código real, integración, tests, seguridad, arquitectura, reproducibilidad, deploy y verificación productiva cuando corresponda.

**Estado vigente — 2026-11-03 (commit `ba0b9d484c6fbdba95a650ed008d0fa4a3ccad6d`):** 10.1 completada; 10.2 y 10.3 certificadas históricamente en producción; 10.4 y 10.5 implementadas con verificadores read-only integrados en `main`, pero su aceptación productiva actual sigue pendiente de muestras reales y ejecución protegida; 10.6 implementada y fusionada mediante PR #39. El CI del PR #39 pasó (86 archivos de pruebas, 357 tests, 23 E2E, verificación de artefactos Cloudflare y audit sin vulnerabilidades conocidas); Lighthouse verificó 18 informes y Cloudflare Preview Build/Deployment pasó. La aceptación externa de retención/acceso de Cloudflare Observability sigue pendiente. El siguiente bloque de implementación es 10.7.

**Última ejecución de Production Verification en `main` (2026-11-03):** Repository CI pasó en el commit de merge, pero el workflow `Production Verification` falló en `smoke` antes de probar el runtime: `scripts/resolve-workers-monitor-url.mjs` recibió HTTP 401 al resolver el subdominio `workers.dev`; `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` estaba vacío y el token no tenía permiso `Workers Scripts Read` (o no pudo consultar la cuenta). Los pasos autenticados de runtime quedaron omitidos y los jobs de certificación 10.4/10.5 también quedaron `skipped`; el agregador registró `PENDING_MANUAL_REVIEW`. Esto no prueba que la aplicación productiva esté caída, pero tampoco permite declarar el smoke ni las fases 10.4/10.5 aprobados. Corregir la variable de repositorio o los permisos mínimos del token y volver a ejecutar el workflow protegido.

## 1. Objetivo

Preparar la plataforma para operación real de producción mediante:

- analytics del funnel comercial;
- observabilidad completa;
- seguridad avanzada;
- testing unitario, integración, E2E, contratos, seguridad y concurrencia;
- CI/CD y controles de release;
- configuración y operación productiva;
- recuperación y rollback;
- protección de datos y calidad de logs.

## 2. Principios obligatorios

- DDD + Clean Architecture.
- Mantener bounded contexts y ports/adapters.
- No introducir dependencias directas de Infrastructure en Domain/Application.
- No mocks, fake providers, datos demo ni placeholders en producción.
- Los tests sí pueden utilizar test doubles donde corresponda.
- No duplicar capacidades que ya existan: primero auditar y reutilizar.
- No modificar versiones de dependencias sin justificación técnica.
- No exponer secretos, tokens, credenciales, PII o identificadores sensibles en logs.
- Toda autorización debe ser server-side.
- Los eventos y métricas deben provenir de operaciones reales.
- Todo cambio crítico debe tener regresión automatizada.
- La certificación productiva es independiente del éxito de compilación.

---

# 3. Subfases

## 10.1 — Auditoría de Production Readiness

### Objetivo

Establecer el estado real de la plataforma antes de modificar código.

### Trabajo

- Auditar el código actual contra todos los requisitos de Fase 10.
- Inventariar observabilidad existente.
- Inventariar seguridad existente.
- Inventariar analytics existentes.
- Inventariar tests actuales.
- Revisar CI/CD y Workers Builds.
- Revisar health/readiness checks.
- Revisar logs actuales.
- Revisar métricas existentes.
- Revisar rate limiting/WAF/CSP/CORS.
- Revisar secrets y bindings.
- Revisar Queues, D1, R2 y Durable Objects.
- Revisar pagos, webhooks y eventos.
- Detectar duplicaciones y deuda técnica.
- Clasificar cada requisito como implementado, incompleto, incorrecto o ausente.

### Salida

Documento de gaps de Fase 10 y backlog técnico priorizado.

---

# 4. Analytics

## 10.2 — Analytics Foundation

### Objetivo

Crear una capa de analytics desacoplada del dominio.

### Trabajo

- Definir AnalyticsPort.
- Definir eventos tipados.
- Definir esquema/versionado de eventos.
- Definir contexto de sesión.
- Definir anonimización/minimización de datos.
- Definir estrategia de persistencia/transporte.
- Evitar que analytics bloquee operaciones transaccionales.
- Definir idempotencia de eventos cuando sea necesaria.
- Definir retención.

### Implementación realizada

- `AnalyticsEvent` con versión 1 y allow-list de los nueve eventos base.
- `AnalyticsService` como caso de aplicación, con validación de identificadores, timestamp, tamaño de payload y exclusión de campos sensibles.
- `AnalyticsPort` desacopla el caso de uso de Cloudflare.
- `CloudflareAnalyticsQueuePublisher` publica de forma asíncrona sobre el `EVENTS_QUEUE` existente.
- `D1AnalyticsRepository` persiste con `event_id` como clave primaria e idempotencia mediante `INSERT OR IGNORE`.
- Retención de 180 días mediante `expires_at` y limpieza periódica desde el scheduled Worker.
- `POST /api/analytics/events` valida JSON/content-type/tamaño y devuelve `202` únicamente después de publicar el evento en Queue.
- La composición de infraestructura se mantiene fuera de Presentation mediante `apps/web/lib/analyticsApplication.ts`.
- Pruebas unitarias y de infraestructura cubren validación sensible e idempotencia.

### Verificación automatizada de producción

El cierre de 10.2 queda integrado al pipeline oficial de Cloudflare mediante `verify:phase10.2:production`, ejecutado después de migración, deploy y verificaciones 08/09.

La verificación realiza automáticamente:

- `POST /api/analytics/events` contra la URL productiva.
- Reenvío del mismo `eventId` para comprobar idempotencia de ingestión.
- Consulta remota de D1 para esperar el procesamiento real `HTTP → EVENTS_QUEUE → D1`.
- Validación de tipo, versión, sesión, visitante, request ID, source y payload persistidos.
- Consulta de la metadata de retención `expires_at`.
- Eliminación del evento de prueba al finalizar para no dejar datos de verificación persistentes.

El evento usado por esta prueba es un **probe técnico controlado**, no un evento comercial ni revenue ficticio. La prueba no sustituye los eventos reales que implementarán las subfases 10.3–10.5.

**10.2 quedó certificada en producción el 2026-09-29** mediante el gate `verify:phase10.2:production`, con ingestión real, `HTTP → EVENTS_QUEUE → D1`, idempotencia y limpieza del probe.

### Eventos base

- VisitorStarted
- SessionStarted
- ProductViewed
- SearchPerformed
- CartItemAdded
- CheckoutStarted
- PaymentStarted
- PurchaseCompleted
- RevenueRecorded

No se deben generar eventos de compra o revenue sin una operación real confirmada server-side.

---

## 10.3 — Analytics del catálogo y búsqueda

### Implementación realizada

- `ProductViewed` se emite desde la página real de producto después de hidratar el Client Component de tracking.
- `SearchPerformed` se emite desde el resultado real de `/catalog` con métricas minimizadas: presencia y longitud de consulta, resultados, página, orden y filtros; nunca se persiste la consulta textual.
- `SearchResultClicked` registra la interacción con productos reales del resultado.
- `CategoryNavigated`, `FilterApplied` y `PaginationChanged` se emiten desde el estado real de navegación del catálogo.
- `ProductVariantSelected` se emite desde el selector real de variantes del producto.
- `RelatedProductClicked` se emite desde enlaces reales de productos relacionados.
- El endpoint de analytics crea/usa identificadores anónimos server-side y los devuelve mediante cookies `HttpOnly`, `Secure`, `SameSite=Lax`; el navegador no lee ni escribe cookies ni browser storage.
- Los eventos continúan usando `EVENTS_QUEUE` y la persistencia D1 idempotente de 10.2.
- `verify:phase10.3:production` comprueba un producto publicado real, una búsqueda real, persistencia `HTTP → EVENTS_QUEUE → D1`, versión/source/contexto y ausencia de la consulta textual en el payload.

**Estado:** 🟢 implementada, conectada y certificada en producción el 2026-09-29 mediante `verify:phase10.3:production`.

### Validaciones

- No registrar credenciales.
- No registrar datos de pago.
- No registrar PII innecesaria.
- No confiar en datos enviados por el navegador para métricas financieras.

---

## 10.4 — Analytics del carrito y checkout

### Implementación realizada

- `CartItemAdded` se emite después de una mutación real y exitosa de `POST /api/cart`.
- `CartItemRemoved` se emite después de una eliminación real y exitosa de `DELETE /api/cart`.
- `CartAbandoned` se detecta server-side desde el scheduled Worker para carritos con items sin actividad durante al menos 30 minutos; usa un `eventId` determinista para idempotencia.
- `CheckoutStarted` se emite server-side después de crear realmente una orden `PENDING_PAYMENT`, no desde un clic de frontend.
- `ShippingMethodSelected` se emite desde el servidor después de persistir una orden con el método canónico validado (`PICKUP` o `DELIVERY`); no se publica desde el navegador ni contiene direcciones o datos personales.
- `PaymentStarted` se emite server-side después de crear/recuperar correctamente el payment intent, usando importe, moneda, proveedor, order ID y payment ID provenientes del estado server-side.
- `PurchaseCompleted` se emite desde la confirmación server-side de los webhooks de Wompi, Stripe, Mercado Pago, PayPal y Binance Pay, únicamente cuando payment y order quedan realmente en estado `PAID`.
- El evento de compra usa `purchase-completed:<paymentId>` como clave idempotente y nunca depende de importe enviado por el navegador.
- Las operaciones de analytics se envían mediante `waitUntil()` en las rutas HTTP para no añadir la publicación a Queue al camino crítico de checkout/cart/payment; Cloudflare recomienda este patrón para trabajo no crítico como analytics. citeturn6search1turn6search2
- Se reutiliza `EVENTS_QUEUE` y la idempotencia D1 de 10.2; Cloudflare Queues entrega al menos una vez, por lo que el `eventId` estable evita doble contabilización. citeturn5search0
- `verify:phase10.4:production` es de solo lectura en producción: inspecciona eventos server-owned ya persistidos y los relaciona con órdenes, items y pagos canónicos. Comprueba las clases de eventos requeridas, correlación temporal y de sesión/visitante, idempotencia y coherencia de importes/monedas. No crea, muta ni limpia carritos, órdenes, eventos, intents, pagos o refunds; si falta una clase de evento real, devuelve `INCONCLUSIVE`.

**Implementación:** 🟢 integrada en `main` mediante PR #32. **Verificador read-only:** integrado mediante PR #38. **Aceptación productiva:** `PENDING_MANUAL_REVIEW`; se requieren muestras reales de todas las clases de evento y ejecución satisfactoria del workflow protegido. En la ejecución del 2026-11-03, el job 10.4 quedó `skipped` porque falló antes el preflight `smoke` al resolver el monitor Worker (HTTP 401); no existe PASS nuevo.

### Regla crítica

Los valores financieros definitivos deben proceder del estado server-side, no de payloads manipulables del cliente. `PaymentStarted` y `PurchaseCompleted` cumplen esta regla; el último solo se genera tras confirmación real del proveedor y transición `order=PAID` + `payment=PAID`.

---

## 10.5 — Analytics de revenue y conversion

### Implementación realizada

- La fuente canónica de revenue es `payment_ledger`, no los eventos del navegador.
- `PAYMENT_CONFIRMED` representa revenue bruto confirmado por el flujo real de pago.
- `PAYMENT_REFUNDED` representa una reducción real de revenue después de que el proveedor confirma el refund.
- `RevenueRecorded` se proyecta desde cada entrada canónica del ledger con `eventId=revenue:<ledgerId>`, evitando doble contabilización mediante la idempotencia de `analytics_events`.
- Cada evento conserva trazabilidad server-side `ledgerId → paymentId → orderId` y correlación con el cliente mediante el customer asociado al payment.
- Los voids no generan revenue porque no existe un `PAYMENT_CONFIRMED` válido.
- Los refunds se proyectan únicamente desde entradas `PAYMENT_REFUNDED` realmente persistidas por el flujo de refund.
- El Worker ejecuta reconciliación de revenue en el Cron existente de cada minuto; la reconciliación solo proyecta entradas del ledger que todavía no tienen su `RevenueRecorded`.
- Se implementó reporte por periodo con revenue bruto, refunds, net revenue, conteos de pagos/refunds, `CheckoutStarted`, `PurchaseCompleted`, conversión y desglose por moneda. Los importes se agregan dentro de cada moneda; los totales globales quedan nulos cuando el periodo mezcla monedas.
- El reporte está protegido por autorización administrativa `dashboardRead` y devuelve `Cache-Control: no-store` también en respuestas de error.
- La conversión se define como `PurchaseCompleted / CheckoutStarted` desde eventos server-owned únicos en la misma ventana UTC; tasas superiores al 100% se advierten por posible desalineación de cohortes.
- El payload de `RevenueRecorded` no incluye email, teléfono, dirección, tokens, secretos, tarjeta, IMEI o serial.
- `verify:phase10.5:production` valida cada entrada elegible contra una sola proyección `RevenueRecorded`, incluyendo IDs ledger/payment/order, tipo, importe, moneda, dirección, duplicados, huérfanos, estado/refund completo, desglose por moneda, conversión y minimización de payload. Es de solo lectura en D1.

### Criterio

No existe revenue analítico ficticio ni derivado exclusivamente de eventos frontend. La proyección nace de operaciones financieras server-side persistidas en `payment_ledger`.

**Implementación:** 🟢 proyección y reconciliación integradas en `main` mediante PR #32. **Verificador read-only por asiento:** integrado mediante PR #38. **Aceptación productiva:** `PENDING_MANUAL_REVIEW`; exige pagos reales y refund confirmado por proveedor cuando corresponda, conciliación ledger→payment→order→RevenueRecorded y workflow protegido aprobado. En la ejecución del 2026-11-03, el job 10.5 quedó `skipped` por el fallo previo del preflight `smoke` (HTTP 401 al resolver el monitor); no existe PASS nuevo.

**Matriz de aceptación operativa actualizada:** consultar [`docs/phase10-operational-acceptance.md`](./phase10-operational-acceptance.md). Este documento separa código, automatización, configuración externa y aceptación humana.

# 5. Observabilidad

## 10.6 — Logging estructurado

### Objetivo

Convertir los logs operacionales en una fuente útil, uniforme y segura para investigar el runtime.

### Implementación en código

- Contrato JSON compartido en `apps/web/server/serverLogger.ts`: timestamp, nivel, service, environment, source y operation; campos operacionales opcionales requestId, correlationId, route, durationMs, status y errorCode.
- Niveles normalizados debug/info/warn/error. Debug queda desactivado por defecto y requiere APP_LOG_LEVEL=debug o habilitación explícita.
- Contexto escalar y sanitizado; validación de IDs, ruta, status, duración y códigos de error.
- Redacción de credenciales, Authorization, cookies, PII, datos de pago, IMEI/serial etiquetados, claves privadas y secuencias sensibles en mensajes.
- Errores serializados sin stack trace; mensajes acotados y CR/LF normalizados.
- Worker propaga APP_ENV explícito a registros HTTP, readiness, Queue y Scheduled cuando la configuración está disponible.

### Política de volumen, auditoría y retención

- No se aplica sampling probabilístico a warn/error. Debug está opt-in; los eventos info existentes se conservan en los límites operacionales actuales.
- No se agregan logs exitosos por elemento procesado ni se duplica el mismo evento deliberadamente. Métricas y agregaciones adicionales se reservan para 10.9.
- Los logs operacionales no sustituyen los audit logs persistidos.
- El destino runtime es stdout/stderr y Cloudflare Observability, habilitado en wrangler.jsonc; no se copian registros a D1/R2.
- La retención efectiva, el acceso al dashboard y el periodo contractual dependen de la cuenta Cloudflare y requieren comprobación manual. No se inventa una duración ni se declara aceptación externa desde el repositorio.

### Build logs

Se revisó la separación entre logs runtime y salida de CI/Cloudflare Builds. No se silencian comandos, warnings ni fallos; no se añade `--silent`, redirección a /dev/null ni tolerancia a errores. La retención/ruido visual específico del dashboard Cloudflare permanece sujeto a aceptación operativa.

### Validación

Las pruebas de `serverLogger.test.ts` cubren contrato JSON, niveles, debug opt-in, metadatos, validación de campos, sanitización de secretos/PII/tarjetas/teléfonos/IMEI/serial y emisión individual. En PR #39, Repository CI pasó sobre SHA `4f4f352c7f42aa77ab8b9c3e564eb55c90323d4b`: 86 archivos de pruebas/357 tests aprobados, 23 E2E aprobados, auditoría de dependencias sin vulnerabilidades conocidas y verificación de artefactos Cloudflare aprobada (46 páginas HTML estáticas, bundle Worker y 204 assets). Lighthouse verificó 18 informes y Cloudflare Preview Build/Deployment pasó.

**Estado:** 🟢 implementación integrada en `main` mediante PR #39 (merge commit `ba0b9d484c6fbdba95a650ed008d0fa4a3ccad6d`). **Aceptación externa pendiente:** confirmar en Cloudflare Observability la retención efectiva y los controles de acceso. Este merge no certifica retención ni configuración externa.

Ver `docs/observability-logging.md` para contrato, seguridad, volumen y límites.

---

## 10.7 — Correlation IDs y request tracing

### Trabajo

- Generar/propagar requestId.
- Propagar correlationId entre capas.
- Mantener correlación entre API → Queue → processor.
- Correlacionar webhook → payment/order.
- Correlacionar notification → delivery.
- Evitar confiar ciegamente en IDs enviados por clientes.
- Definir formato y longitud de IDs.

### Criterio

Una operación crítica debe poder rastrearse de extremo a extremo.

---

## 10.8 — Error tracking

### Trabajo

- Normalizar errores de aplicación.
- Clasificar errores esperados vs inesperados.
- Registrar códigos de error estables.
- Capturar stack/contexto cuando sea seguro.
- Evitar información sensible.
- Detectar errores de runtime.
- Detectar fallos de Queue.
- Detectar fallos de webhook.
- Detectar fallos de email.
- Detectar fallos de pagos.

---

## 10.9 — Métricas operacionales

### Métricas mínimas

- request count;
- error rate;
- latency;
- p95/p99 cuando sea posible;
- health status;
- queue depth;
- queue lag;
- retry count;
- DLQ count;
- notification delivery;
- email delivery;
- webhook failures;
- payment failures;
- checkout failures.

### Criterio

Las métricas deben poder distinguir tráfico normal de degradación real.

---

## 10.10 — Health, readiness y dependencias

### Trabajo

Auditar y completar:

- liveness;
- readiness;
- D1;
- Queue;
- R2;
- Durable Objects;
- dependencias externas críticas;
- estado de configuración.

### Regla

Liveness no debe depender de todas las dependencias externas.

Readiness sí puede reflejar dependencias necesarias para atender correctamente tráfico crítico.

---

# 6. Seguridad avanzada

## 10.11 — Security Headers y CSP

### Trabajo

Auditar:

- CSP;
- HSTS;
- X-Content-Type-Options;
- X-Frame-Options;
- Referrer-Policy;
- Permissions-Policy;
- COOP;
- CORP;
- otras políticas aplicables.

### Validación

- Detectar regresiones.
- Verificar headers en producción.
- Evitar políticas innecesariamente permisivas.
- No introducir unsafe-* sin justificación.

---

## 10.12 — CORS y políticas de origen

### Trabajo

- Auditar todos los endpoints.
- Identificar APIs públicas.
- Identificar APIs autenticadas.
- Identificar APIs administrativas.
- Aplicar allowlist cuando corresponda.
- Validar métodos.
- Validar headers.
- Evitar * donde no corresponda.
- Verificar comportamiento real desde producción.

---

## 10.13 — Rate limiting y abuso

### Trabajo

Auditar y endurecer límites para:

- login;
- registro;
- password recovery;
- APIs públicas;
- búsqueda;
- checkout;
- creación de reviews;
- servicios;
- webhooks;
- APIs administrativas.

### Requisitos

- Límites por operación.
- Respuestas consistentes.
- Protección contra abuso.
- No romper clientes legítimos.
- Tests de concurrencia.
- Observabilidad de bloqueos.

---

## 10.14 — WAF y Bot Protection

### Trabajo

- Auditar reglas actuales.
- Identificar endpoints de alto riesgo.
- Definir reglas WAF apropiadas.
- Evaluar bot protection.
- Evaluar Turnstile únicamente donde aporte valor.
- Evitar bloquear crawlers legítimos necesarios para SEO.
- Documentar falsos positivos y excepciones.

---

## 10.15 — Secret Management

### Trabajo

Auditar:

- Cloudflare secrets;
- bindings;
- variables de entorno;
- claves de proveedores;
- payment credentials;
- Resend credentials;
- webhook secrets.

### Validaciones

- Ningún secreto en Git.
- Ningún secreto en bundle cliente.
- Ningún secreto en logs.
- Ningún secreto en errores públicos.
- Rotación documentada.
- Separación de configuración pública y secreta.

---

## 10.16 — MFA y administración sensible

### Trabajo

Auditar operaciones administrativas críticas:

- usuarios;
- roles;
- pagos;
- refunds;
- configuración;
- secrets/configuración sensible;
- replay de notificaciones;
- operaciones destructivas.

Evaluar MFA/step-up authentication para operaciones sensibles sin romper la arquitectura actual de autenticación.

---

## 10.17 — Input Validation y protección de APIs

### Trabajo

- Auditar bodies.
- Query params.
- Path params.
- Headers.
- Content-Type.
- límites de tamaño.
- parsing.
- validación de tipos.
- validación de ownership.
- autorización por recurso.

### Regla

unknown primero; nunca aceptar payloads externos como tipos de dominio sin validación.

---

## 10.18 — Webhook Security

### Proveedores

- Wompi.
- Stripe.
- Mercado Pago.
- PayPal.
- Binance Pay cuando aplique.
- Resend u otros proveedores que generen callbacks.

### Trabajo

- Verificación de firma.
- Timestamp/replay protection.
- Validación de referencia.
- Validación de importe.
- Validación de moneda.
- Idempotencia.
- Correlation ID.
- Audit event.
- Manejo seguro de reintentos.

---

## 10.19 — Protección de PII y datos sensibles

### Trabajo

Auditar almacenamiento, APIs, logs y respuestas para:

- nombre;
- email;
- teléfono;
- dirección;
- datos de cliente;
- IMEI;
- serial;
- información de reparación;
- información de pago.

Aplicar minimización y enmascaramiento donde corresponda.

---

# 7. Testing

## 10.20 — Unit Testing Coverage

### Trabajo

Completar tests de:

- Domain.
- Application.
- policies;
- authorization;
- validation;
- pricing;
- inventory;
- payments;
- notifications;
- SEO;
- analytics;
- observability.

No buscar únicamente cobertura porcentual: priorizar comportamiento crítico.

---

## 10.21 — Integration Testing

### Trabajo

Probar integración real entre:

- Application ↔ Infrastructure.
- D1.
- R2.
- Queues.
- Durable Objects.
- payment adapters.
- email adapter.
- authentication/session.
- analytics.

---

## 10.22 — E2E Testing

### Flujos críticos

- Registro/login.
- Navegación.
- Búsqueda.
- Producto.
- Carrito.
- Checkout.
- Pago.
- Pedido.
- Reviews.
- Servicios.
- Cliente.
- Técnico.
- Administración.
- Notificaciones.

### Regla

No sustituir E2E por tests unitarios cuando el comportamiento depende de varias capas.

---

## 10.23 — Contract Tests

### Objetivo

Garantizar que los adapters respeten los contratos de aplicación.

### Aplicar a

- PaymentProvider.
- EmailProvider.
- AnalyticsProvider.
- Cloud storage adapters.
- Notification adapters.

---

## 10.24 — Payment Sandbox Tests

### Trabajo

Usar sandboxes oficiales cuando estén disponibles.

Probar:

- success;
- failure;
- pending;
- cancellation;
- refund;
- duplicate webhook;
- invalid signature;
- invalid amount;
- invalid currency;
- invalid reference;
- retry.

No usar proveedores fake para declarar la integración funcional.

---

## 10.25 — Security Testing

### Trabajo

Tests automatizados para:

- authentication bypass;
- authorization bypass;
- IDOR;
- ownership;
- privilege escalation;
- CSRF donde aplique;
- XSS;
- injection;
- invalid payloads;
- rate limiting;
- webhook replay;
- secret leakage;
- PII leakage.

---

## 10.26 — Concurrency Testing

### Áreas críticas

- inventory;
- stock reservations;
- coupon redemption;
- checkout;
- payment idempotency;
- notification processing;
- Queue retries;
- DLQ replay.

### Criterio

Probar operaciones concurrentes reales y verificar invariantes, no únicamente ejecuciones secuenciales.

---

## 10.27 — Regression Testing

### Trabajo

Crear una suite que cubra los defectos críticos descubiertos durante Fases 01–09.

Especialmente:

- ownership;
- RBAC;
- payments;
- checkout;
- inventory;
- notifications;
- CMS;
- reviews;
- SEO;
- canonical;
- structured data;
- redirects;
- production routes.

---

# 8. CI/CD y Release Engineering

## 10.28 — Pipeline de calidad

Auditar y consolidar:

Audit → Foundation → Production Data → Architecture → Format → Lint → Typecheck → Tests → Build.

Cada gate debe fallar de forma explícita y observable.

---

## 10.29 — Security Gates

Integrar cuando corresponda:

- dependency audit;
- lockfile validation;
- secret scanning;
- architecture checks;
- production-data checks;
- security regression tests.

No introducir herramientas redundantes sin necesidad.

---

## 10.30 — Production Deploy Gate

El deploy de producción debe exigir:

- build exitoso;
- migraciones verificadas;
- deploy exitoso;
- health check;
- readiness check;
- smoke tests;
- Phase verification correspondiente.

---

## 10.31 — Release Evidence

Cada release certificado debe registrar:

- commit;
- build ID;
- Worker Version ID;
- migraciones;
- tests;
- deploy;
- smoke;
- verificación productiva;
- warnings no bloqueantes conocidos.

---

# 9. Producción

## 10.32 — Cloudflare Production Audit

Auditar:

- Workers;
- custom domain;
- DNS;
- SSL/TLS;
- WAF;
- caching;
- D1;
- R2;
- Queues;
- Durable Objects;
- bindings;
- secrets;
- cron/schedules.

---

## 10.33 — Cache Strategy

Auditar por superficie:

- HTML público;
- APIs públicas;
- APIs autenticadas;
- APIs administrativas;
- assets;
- imágenes;
- sitemap;
- robots;
- contenido CMS;
- producto.

### Regla

Nunca cachear accidentalmente:

- datos privados;
- sesiones;
- respuestas autenticadas;
- información administrativa;
- PII.

---

## 10.34 — Production Secrets y proveedores

Verificar configuración real para:

- pagos;
- Resend;
- Cloudflare;
- analytics;
- cualquier proveedor externo utilizado.

No introducir credenciales reales en el repositorio.

---

## 10.35 — Rollback y Recovery

### Trabajo

Documentar:

- rollback de Worker;
- recuperación después de deploy defectuoso;
- migraciones D1;
- estrategia ante migración incompatible;
- recuperación de Queues;
- DLQ;
- replay;
- recuperación de notificaciones;
- incident response.

### Criterio

Debe existir un procedimiento ejecutable, no solamente documentación conceptual.

---

## 10.36 — Production Smoke Suite

Crear/expandir verificaciones reales para:

- health;
- readiness;
- storefront;
- auth;
- catalog;
- product;
- cart;
- checkout;
- payments;
- orders;
- services;
- notifications;
- CMS;
- reviews;
- SEO;
- admin authorization.

Los smoke tests deben distinguir:

- éxito;
- fallo funcional;
- dependencia externa;
- configuración incorrecta.

---

## 10.37 — Performance y capacidad

### Trabajo

Medir:

- latency;
- throughput;
- p95/p99;
- cache hit/miss;
- D1 latency;
- Queue latency;
- notification latency;
- checkout latency.

### Pruebas

- carga controlada;
- concurrencia;
- endpoints críticos;
- checkout;
- inventory;
- notifications.

No declarar capacidad máxima sin evidencia de medición.

---

# 10.38 — Auditoría final de arquitectura

Antes del cierre:

- revisar imports entre capas;
- revisar dependencias circulares;
- revisar adapters;
- revisar composition roots;
- revisar APIs;
- revisar bounded contexts;
- revisar any;
- revisar bypasses de seguridad;
- revisar duplicación;
- revisar código muerto.

Ejecutar:

- foundation:check
- architecture:check
- frontend:data:check
- format:check
- lint
- typecheck

---

# 10.39 — Certificación productiva Fase 10

## Gates obligatorios

- [ ] Auditoría final.
- [ ] Tests unitarios.
- [ ] Integration tests.
- [ ] E2E.
- [ ] Contract tests.
- [ ] Security tests.
- [ ] Concurrency tests.
- [ ] Dependency/security audit.
- [ ] Architecture check.
- [ ] Format.
- [ ] Lint.
- [ ] Typecheck.
- [ ] Cloudflare build.
- [ ] Migraciones verificadas.
- [ ] Deploy real.
- [ ] Health check.
- [ ] Readiness check.
- [ ] Production smoke.
- [ ] Observabilidad verificada.
- [ ] Security controls verificados.
- [ ] Rollback/recovery documentado y validado.
- [ ] Evidencia del release registrada.

---

# 11. Criterio de cierre de Fase 10

La fase solamente podrá marcarse como:

**🟢 Cerrada y certificada en producción**

cuando:

1. Todo requisito aplicable esté implementado.
2. No existan gaps críticos abiertos.
3. Los bounded contexts mantengan sus fronteras.
4. No existan mocks/fakes/placeholders en producción.
5. Los tests críticos pasen.
6. Los controles de seguridad pasen.
7. Los logs sean útiles y no filtren secretos/PII.
8. Analytics utilice eventos reales.
9. Observabilidad permita diagnosticar operaciones críticas.
10. CI/CD complete todos los gates.
11. El deploy productivo sea exitoso.
12. Los smoke tests reales pasen.
13. Exista evidencia del release.
14. El procedimiento de rollback/recovery esté validado.

---

# 12. Orden recomendado de ejecución

Auditoría 10.1
→ Analytics 10.2–10.5
→ Observabilidad 10.6–10.10
→ Seguridad 10.11–10.19
→ Testing 10.20–10.27
→ CI/CD 10.28–10.31
→ Producción + Performance 10.32–10.37
→ Auditoría arquitectónica final 10.38
→ Certificación productiva 10.39

## Regla de ejecución

No implementar una subfase únicamente porque aparece en este documento.

Antes de cada bloque:

1. revisar lo existente;
2. reutilizar lo que ya funciona;
3. identificar gaps reales;
4. implementar únicamente lo necesario;
5. ejecutar pruebas;
6. integrar;
7. verificar producción cuando corresponda;
8. actualizar este documento y roadmap.md.

---

## Estado vigente — 2026-11-03

- **10.1:** 🟢 auditoría completada. El documento de auditoría original se conserva como fotografía histórica del 2026-09-29.
- **10.2 y 10.3:** 🟢 certificadas en producción el 2026-09-29; la evidencia es histórica y no sustituye una nueva verificación del release actual.
- **10.4:** 🟢 implementación integrada (PR #32) y verificador read-only integrado (PR #38); 🟡 aceptación productiva pendiente (`PENDING_MANUAL_REVIEW`).
- **10.5:** 🟢 reconciliación y verificador read-only integrados (PR #32/#38); 🟡 aceptación productiva pendiente (`PENDING_MANUAL_REVIEW`).
- **10.6:** 🟢 logging estructurado integrado por PR #39; Repository CI, Lighthouse y Cloudflare Preview pasaron. La retención y el acceso de Cloudflare Observability requieren aceptación manual.
- **Siguiente subfase de implementación:** 10.7 — Correlation IDs y request tracing.

**Estado de verificación del merge a `main`:** CI requerido pasó. El workflow de producción del 2026-11-03 no pudo completar el smoke porque la resolución del monitor `workers.dev` recibió HTTP 401 con `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` vacío; los jobs 10.4/10.5 se omitieron. No se declara certificación productiva nueva para el commit de merge.

---

## Addendum — auditoría de integridad Analytics 10.4 / 10.5

### Hallazgos de la revisión de main

| Área                            | Hallazgo                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CartItemAdded / CartItemRemoved | Las APIs emitían después de las llamadas de mutación, pero el contrato del repositorio no indicaba si D1 había cambiado realmente una fila; un DELETE no-op podía producir un evento falso. |
| CartAbandoned                   | El Cron escaneaba siempre los mismos primeros 200 carritos y no revalidaba la actividad ni la existencia de artículos al persistir.                                                         |
| ShippingMethodSelected          | El evento podía originarse desde el navegador, aunque la selección válida se conoce en la orden persistida.                                                                                 |
| RevenueRecorded                 | El reconciliador podía omitir ledger huérfano por el join interno y no validaba coherencia de importe/moneda contra Payment y Order.                                                        |
| Revenue report                  | Los totales globales podían sumar monedas distintas y el funnel no se contaba directamente desde la definición oficial de eventos.                                                          |
| Verificación 10.5               | La prueba se apoyaba en agregados y no comparaba cada relación `ledgerId → paymentId → orderId` con su evento.                                                                              |

### Endurecimiento

- Los repositorios de carrito devuelven si hubo una fila afectada. Solo las mutaciones reales producen `CartItemAdded`/`CartItemRemoved`; el ID es determinista por operación y admite reintentos idempotentes.
- El scanner de carritos abandonados ordena por antigüedad, omite IDs ya proyectados y la escritura condicional vuelve a verificar el `updated_at`, el umbral de 30 minutos y que aún existan artículos.
- `ShippingMethodSelected` es server-owned y se publica únicamente después de crear una orden `PENDING_PAYMENT`, usando `order.shippingMethod` persistido. `CheckoutStarted` usa artículos y descuento de la orden persistida.
- Los errores de publicación de Analytics en cart, shipping, checkout, payment-start y purchase-completed se registran sin cambiar el resultado transaccional de la compra.
- La reconciliación de revenue compara los movimientos elegibles con Payment y Order, valida moneda e importes y falla ante ledger huérfano, movimiento duplicado, pago confirmado sin asiento o refund incompleto. El detector de pago confirmado sin asiento aplica una ventana de gracia de cinco minutos para no confundir una transición transaccional en curso con corrupción; los locks de refund evitan falsos positivos hasta que la finalización provider-confirmed concluya.
- El flujo actual solo admite reembolso completo. `PAYMENT_REFUNDED` genera débito cuando la confirmación del proveedor termina y el ledger lo registra; intentos `PENDING`/`FAILED` no son revenue.
- Los importes y conteos se calculan por moneda. Si un período contiene más de una moneda, los totales monetarios globales son `null` y se debe mostrar el desglose.
- La conversión usa `PurchaseCompleted / CheckoutStarted` con IDs únicos server-owned dentro de la misma ventana UTC.

### Certificación y límites

- `verify:phase10.4:production` es read-only: inspecciona datos ya persistidos y no crea, actualiza ni elimina carritos, eventos, órdenes, intents, pagos o refunds.
- `verify:phase10.4:production` inspecciona además eventos históricos reales de checkout, envío, payment-start y compra; si falta alguna clase, la salida es `INCONCLUSIVE`, no `PASS`.
- `verify:phase10.5:production` es de solo lectura en D1 y valida cada asiento contra su proyección, además de monedas, estados, refund completo, duplicados, huérfanos, conversión y minimización de payload.
- La certificación productiva continúa pendiente. El workflow de `main` del 2026-11-03 no llegó a ejecutar los jobs 10.4/10.5: el preflight de `smoke` falló al resolver el host `workers.dev` (HTTP 401; `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` vacío y token sin `Workers Scripts Read`). La salida agregada fue `PENDING_MANUAL_REVIEW`; los scripts no deben marcarse PASS por estar implementados, por compilar o por tener jobs omitidos.
- Las migraciones remotas permanecen en el mecanismo de despliegue de Cloudflare; CI no debe ejecutar `db:migrate:production`.
- Issue #10 permanece abierto hasta contar con CI aprobada, preflight del monitor resuelto y evidencia real de producción suficiente para ambas subfases.
