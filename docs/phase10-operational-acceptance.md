# Fase 10 — Matriz de aceptación operativa

**Fecha de actualización:** 2026-11-02  
**Rama de continuación:** `feat/phase10-production-readiness`  
**Base auditada:** `main` en `03a490bec41e660fa65fb1c02d7fbef213177868`

Este documento separa la implementación en código, las pruebas automatizadas y la evidencia operativa/manual. Una prueba local o un build exitoso no certifican dependencias remotas, WAF, MFA real, accesibilidad manual ni métricas de campo.

## Estado por área

| Área | Implementación comprobada en código | Evidencia automatizada | Aceptación pendiente |
|---|---|---|---|
| Error tracking | Logger JSON con redacción; logging de Worker/Queue/Cron; captura mínima de errores de React y excepciones HTTP no controladas | Tests de redacción y endpoint de error; CI en la rama | Revisar eventos reales en Cloudflare Observability, correlacionar incidentes y confirmar retención/señales |
| Métricas HTTP | Evento estructurado por solicitud con route group, método, estado, duración y request ID | Unit tests de normalización; E2E del Worker | Confirmar volumen/retención en Cloudflare y crear consultas/alertas de error rate y latencia |
| Métricas Queue/DLQ | Logs estructurados de fallo/retry/dead-letter existentes | Suite de tests de procesamiento | Medir profundidad, lag, retries y DLQ desde Cloudflare; no se afirma que el log HTTP los sustituya |
| Health/liveness | `/api/health/live` no depende de D1 | E2E de liveness | Validar respuesta desde el dominio real después del deploy |
| Health/readiness | D1 `SELECT 1`, R2 `list(limit:1)`, Notification Hub `/healthz`, presencia de bindings de Queue | E2E comprueba estado y forma del resultado | Confirmar D1/R2/DO operativos en producción. Las Queues se marcan `configured`, no se envía un mensaje de prueba ni se afirma consumo real |
| Dependencias externas | La configuración de proveedores se mantiene en secretos/bindings de Worker | No hay health probe de red para proveedores | Aceptar por separado Resend y cada proveedor de pago mediante operaciones/control de proveedor sin generar cargos |
| CORS | Middleware restringe CORS al mismo origen; rechaza preflight y mutaciones con origen externo | E2E cubre preflight permitido, preflight rechazado y POST rechazado | Revisar todos los consumidores/orígenes legítimos antes de ampliar la allowlist |
| Rate limiting | Limiters general y sensible; clasificación por ruta estable; health exento; fallo cerrado si falta binding en producción | Unit tests de clasificación; smoke productivo intenta observar 429 | La consistencia de Cloudflare Rate Limiting es eventual. Ausencia de 429 en 21 intentos es inconclusa, no un PASS; validar cuotas por endpoint con tráfico controlado |
| RBAC | Matriz de permisos y overrides server-side | Tests unitarios de roles/overrides y smoke admin existente | Completar matriz 401/403/2xx con identidades reales y comprobar privilegio vertical/horizontal |
| IDOR/BOLA | Ownership server-side de órdenes de cliente y asignación de técnicos | E2E de cliente que intenta leer/pagar orden ajena; tests de ownership técnicos por bounded context | Completar pruebas cruzadas para cada recurso/API sensible y registrar request/response por rol |
| MFA administrativo | TOTP obligatorio antes de sesión; AES-256-GCM; recovery codes hash/one-time; challenge TTL/lockout; replay prevention; step-up con segundo factor | Unit/integration de TOTP, repositorio, replay y recovery; smoke de password-to-challenge/no-session | Confirmar secret `ADMIN_MFA_ENCRYPTION_KEY` y migration 0047 en Cloudflare; probar enrollment/login con authenticator real, un recovery code, regeneración y step-up |
| Accesibilidad | Semántica, Axe, navegación de teclado automatizada, foco, controles nombrados y reflow en 320/640 px | Playwright + Axe sobre rutas críticas | Ejecución humana de teclado completo, contraste, 200/400% zoom, NVDA/VoiceOver/TalkBack y matriz de navegador/AT |
| Web Vitals | Captura RUM de LCP/INP/CLS, normalización y minimización, agregados p75 | Unit/E2E de ingestión y Lighthouse laboratorio separado | Cloudflare debe aplicar migration 0046 y build var `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE`; recolectar tráfico real y revisar conteos/tamaño de muestra |
| Rollback/recovery | Workflow `wrangler rollback` y runbook alineado a Cloudflare | CI valida estructura/documentación, no ejecuta rollback productivo | Ensayo controlado en entorno realmente aislado; Preview no es staging certificado |

## Contratos de observabilidad añadidos

### Error de navegador

Los límites Next.js envían a `POST /api/observability/client-error` únicamente:

- digest opaco de Next.js, cuando existe;
- grupo de ruta normalizado, sin ID, slug, query string ni URL completa.

El endpoint rechaza content types incorrectos, JSON inválido y payloads mayores de 1 KiB. No acepta mensajes, stack traces, cookies, formularios ni cuerpos de solicitudes. El Worker aplica el rate limiter sensible a `/api/observability/**`.

### Métrica HTTP

Cada respuesta procesada por el Worker emite un registro JSON `http.request` con:

- `requestId`;
- método;
- grupo de ruta normalizado;
- status HTTP;
- duración en milisegundos;
- outcome (`success`, `rejected` o `error`).

No se registran query strings ni segmentos arbitrarios de rutas. Este evento es telemetría basada en logs de Cloudflare Observability, no una tabla de métricas D1 ni una promesa de alerta configurada.

### Readiness

`/api/health/ready` devuelve `200` si D1, R2, Notification Hub y las referencias de Queue configuradas cumplen su comprobación disponible; en otro caso devuelve `503` con dependencias degradadas. Nunca incluye mensajes internos, secretos o credenciales.

Las Queues no tienen una lectura de salud no mutativa en este contrato. `configured` solo significa que el binding está presente. Los proveedores externos de email/pago no forman parte de readiness global para no declarar caída toda la tienda por una integración opcional.

## Reglas de aceptación

1. No convertir `configured` en `healthy` para dependencias que no fueron llamadas.
2. No convertir un challenge WAF o un bloqueo del monitor en un PASS/FAIL del runtime; clasificarlo como inconcluso y usar evidencia de Workers Builds y una solicitud de operador.
3. No compartir seeds TOTP, OTPs temporales, recovery codes, contraseñas ni secrets con GitHub Actions o logs.
4. No crear pagos/refunds, datos financieros ni tráfico comercial ficticio para conseguir una certificación.
5. No aplicar D1 migrations remotas desde CI. Cloudflare Workers Builds sigue siendo responsable del deploy y migraciones productivas.
6. Mantener Issue #10 y P0-05 abiertos hasta que cada aceptación aplicable tenga evidencia verificable y revisión del responsable.

## Evidencia manual que debe adjuntarse al cierre

| Aceptación | Evidencia mínima | Estado |
|---|---|---|
| MFA producción | fecha/operador, versión Worker, enrollment TOTP, login válido, recovery code consumido y step-up; nunca adjuntar secreto/código | Pendiente |
| Cloudflare readiness | status live/ready, D1 y R2 operativos, DO health y revisión de colas/consumidores | Pendiente |
| Error tracking/metrics | ejemplos redactados, consultas de errores y series de status/duración/colas | Pendiente |
| CORS/rate limits | matriz origen/método/endpoint, 403/429 y falsos positivos revisados | Pendiente |
| RBAC/IDOR | matriz de roles/recursos con 401/403/2xx y casos de ownership cruzado | Pendiente |
| Accesibilidad | SO/navegador/AT, rutas, teclado, zoom, contraste, lector de pantalla, defectos | Pendiente |
| RUM | periodo, migration 0046, tasa de muestreo, conteos por métrica/device/route y p75 | Pendiente |
| Recovery | version IDs, verificación D1 compatible, pasos y resultado de rollback aislado | Pendiente |

**Conclusión:** el código y la automatización pueden reducir brechas, pero la aceptación integral continúa pendiente de CI de la rama, despliegue Cloudflare y evidencias humanas/operativas descritas arriba.
