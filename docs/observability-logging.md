# Fase 10.6 — Logging estructurado

**Estado:** implementación en rama; CI y aceptación de configuración externa pendientes.  
**Alcance:** logging operacional de aplicación, Worker, Queue y tareas programadas.  
**Fuera de alcance:** correlación extremo a extremo (10.7), error tracking (10.8), métricas operacionales (10.9) y ampliación de health/readiness (10.10).

## Contrato JSON

Cada registro emitido por `apps/web/server/serverLogger.ts` es una única línea JSON con estos campos:

| Campo | Regla |
|---|---|
| `timestamp` | Fecha ISO-8601 UTC generada por el runtime |
| `level` | `debug`, `info`, `warn` o `error` |
| `service` | `ecommerce-iphone-web` |
| `environment` | Valor explícito reconocido (`development`, `test`, `preview`, `staging`, `production`) o `unknown` |
| `source` | `server` u `operational_metric` |
| `operation` | Nombre estable y de baja cardinalidad |
| `requestId`, `correlationId` | Opcionales; solo caracteres alfanuméricos, punto, guion, guion bajo y dos puntos; máximo 128 caracteres |
| `route` | Opcional; sin query string |
| `durationMs`, `status`, `errorCode` | Opcionales; validados antes de emitir |

El contexto operacional adicional debe ser escalar y de baja cardinalidad. No se deben añadir cuerpos HTTP, payloads de Queue, headers, URLs completas, query strings ni identificadores de personas.

## Niveles y volumen

- `debug`: desactivado por defecto; solo se habilita con `APP_LOG_LEVEL=debug` o una habilitación explícita por llamada.
- `info`: eventos operacionales y mediciones ya existentes.
- `warn`: degradaciones recuperables o condiciones que requieren seguimiento.
- `error`: fallos que requieren atención.

No se aplica muestreo probabilístico a `warn` ni `error`. Los eventos `info` existentes se mantienen en sus límites operacionales (por solicitud HTTP, batch de Queue o evento de publicación); esta subfase no introduce logs de éxito por cada elemento procesado. No se añade sampling aleatorio en código porque aún no existe evidencia de volumen que permita fijar una tasa segura. La reducción de cardinalidad y agregación adicional de métricas pertenece a 10.9.

## Redacción y datos prohibidos

El logger:
- redacta valores de claves sensibles como Authorization, cookies, contraseñas, tokens, secrets, API keys, firmas, email, teléfono, direcciones, nombres, datos de tarjeta, IP, identificadores de cuenta/usuario/cliente, IMEI y serial;
- sanea texto de errores para bearer/API tokens, secretos en formato clave=valor, query parameters sensibles, credenciales URL, emails, números de tarjeta o identificadores numéricos largos, teléfonos internacionales, IMEI/serial etiquetados y claves privadas;
- limita mensajes a 1.000 caracteres y normaliza CR/LF/tabulaciones;
- no registra stack traces.

La redacción es una defensa adicional, no permiso para pasar datos sensibles. Quien llama al logger debe minimizar el contexto desde el origen. Los registros de auditoría de negocio/seguridad continúan en sus repositorios y eventos dedicados; los logs operacionales no sustituyen una pista de auditoría.

## Retención y destino

Los registros de runtime se envían a stdout/stderr del Worker y a Cloudflare Observability, habilitado en `wrangler.jsonc`. Esta implementación no copia logs a D1 ni R2. El repositorio no puede comprobar la retención efectiva ni el acceso configurado en la cuenta Cloudflare desde el código; por eso no se fija aquí un número de días ni se declara esa aceptación externa como PASS. El responsable de la cuenta debe confirmar y documentar en Cloudflare Dashboard la retención disponible, controles de acceso y necesidad de conservación, aplicando el principio de conservar solo el tiempo operacionalmente necesario.

## Build logs

Los logs de GitHub Actions y Cloudflare Workers Builds son distintos de los registros runtime de la aplicación. No se ha añadido `--silent`, redirección a `/dev/null`, ni manejo que oculte fallos. Se conserva la salida de install, lint, typecheck, test, OpenNext, Wrangler y Cloudflare Builds para diagnosticar errores y warnings reales. La reducción de ruido solo debe hacerse sobre líneas redundantes identificadas y nunca sobre warnings, errores, checks o resultados de deploy. La inspección visual de retención/ruido específico de Cloudflare Dashboard permanece como aceptación operativa externa.

## Pruebas

`apps/web/server/serverLogger.test.ts` cubre:
- sobre JSON uniforme y metadatos;
- redacción de secretos, datos personales y de pago;
- IMEI y seriales en texto libre;
- IDs, route, duration, status y errorCode;
- niveles debug/info/warn/error y debug opt-in;
- una única emisión por llamada de logger y mediciones operacionales.

CI debe volver a ejecutar todo el conjunto en el SHA definitivo del PR. Una prueba unitaria de sanitización no demuestra por sí sola la configuración de retención de Cloudflare.

## Límites de la subfase

10.6 estandariza el formato y la seguridad de los registros existentes. La propagación completa de correlation IDs entre procesos queda en 10.7; la clasificación y captura transversal de excepciones queda en 10.8; la definición de series, percentiles y alertas queda en 10.9; la aceptación ampliada de dependencias queda en 10.10.
