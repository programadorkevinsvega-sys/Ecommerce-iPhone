# Fase 10 — Plan de implementación: Production Readiness

> Documento operativo de la Fase 10 del roadmap. Define las subfases técnicas que deben auditarse, implementarse, probarse y certificarse antes de cerrar la fase.
>
> **Regla global:** ninguna subfase se considera terminada por compilar. El cierre exige código real, integración, tests, seguridad, arquitectura, reproducibilidad, deploy y verificación productiva cuando corresponda.

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

### Trabajo

- Product view.
- Search.
- Search result interaction.
- Category navigation.
- Filter interaction.
- Pagination.
- Product variant selection.
- Related product interaction.
- Attribution del origen de navegación cuando exista.

### Validaciones

- No registrar credenciales.
- No registrar datos de pago.
- No registrar PII innecesaria.
- No confiar en datos enviados por el navegador para métricas financieras.

---

## 10.4 — Analytics del carrito y checkout

### Trabajo

- Add to cart.
- Remove from cart.
- Cart abandonment.
- Checkout started.
- Shipping selection.
- Payment started.
- Purchase completed.
- Conversion calculation.

### Regla crítica

Los valores financieros definitivos deben proceder del estado server-side, no de payloads manipulables del cliente.

---

## 10.5 — Analytics de revenue y conversion

### Trabajo

- Definir fuente canónica de revenue.
- Asociar purchase con order/payment.
- Evitar doble contabilización.
- Manejar refunds/voids cuando afecten métricas.
- Definir conversion rate.
- Definir métricas por periodo.
- Definir trazabilidad order → payment → revenue event.

### Criterio

No debe existir revenue analítico ficticio ni derivado exclusivamente de eventos frontend.

---

# 5. Observabilidad

## 10.6 — Logging estructurado

### Objetivo

Convertir los logs en una fuente operacional útil y segura.

### Trabajo

Definir formato estructurado con campos como:

- timestamp;
- level;
- service;
- environment;
- requestId;
- correlationId;
- route;
- operation;
- duration;
- status;
- error code.

### Seguridad

Nunca registrar:

- passwords;
- session tokens;
- API keys;
- payment secrets;
- webhook secrets;
- Authorization headers;
- cookies sensibles;
- PII innecesaria;
- IMEI/serial completos cuando no sea imprescindible.

### Además

- Normalizar niveles debug/info/warn/error.
- Evitar logs duplicados.
- Evitar logs excesivamente verbosos.
- Definir sampling cuando corresponda.
- Separar logs operacionales de auditoría.
- Definir política de retención.

### Build logs

Evaluar específicamente el ruido producido por Next.js/OpenNext/Cloudflare Builds y reducir únicamente output no útil sin ocultar errores o warnings reales.

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

## Estado inicial

**Fase 10:** ⬜ Pendiente de auditoría.

**Primera tarea:** completar 10.1 — Auditoría de Production Readiness.

No se considera iniciada la implementación de las subfases posteriores hasta conocer el estado real del código actual.
