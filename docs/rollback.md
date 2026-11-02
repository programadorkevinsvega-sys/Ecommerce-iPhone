# Rollback — Foundation

## Objetivo

Permitir recuperar una versión estable del Worker sin introducir inconsistencias en D1, R2 o Queues.

## Principios

1. El rollback de aplicación debe ser reversible.
2. Las migraciones de D1 deben diseñarse backward-compatible cuando exista despliegue progresivo.
3. Una migración destructiva no debe formar parte del mismo release que requiere rollback del código a la versión anterior.
4. Un entorno Preview solo puede validar el procedimiento cuando tenga D1, R2, Queues, Durable Objects y secretos completamente aislados de producción. El Preview actual no se considera un entorno de staging certificado.

## Estrategia de despliegue

```text
Pull request
    ↓
GitHub Actions: quality gates + local D1 + E2E + OpenNext build
    ↓
Merge to main
    ↓
Cloudflare Workers Builds: main guard
    ↓
Remote D1 migrations
    ↓
Cloudflare Worker deployment
    ↓
Health/readiness + production verification
```

GitHub Actions no aplica migraciones remotas ni despliega el Worker. Cloudflare Workers Builds es responsable del Deploy command y de las migraciones D1 de producción. Las ramas que no son `main` no deben ejecutar el comando de deploy productivo.

## Rollback del Worker

Ante un fallo de aplicación que no requiera revertir datos:

```bash
wrangler deployments list
wrangler rollback
```

El operador debe identificar primero el deployment estable anterior y confirmar que su esquema D1 sigue siendo compatible.

## Rollback de D1

D1 no debe tratarse como un artefacto fácilmente reversible. Para cambios de esquema incompatibles se utilizará expansión/contracción:

```text
vN
 ↓
expand schema
 ↓
vN+1 uses old + new
 ↓
backfill
 ↓
vN+2 uses new
 ↓
contract schema
```

Nunca eliminar columnas/tablas necesarias para la versión anterior antes de completar el período de compatibilidad.

## R2

Los objetos nuevos no deben requerir borrado durante rollback del Worker. Mantener compatibilidad de lectura y evitar cambios destructivos de nombres/rutas de objetos dentro del mismo release.

## Queues

Los mensajes deben ser compatibles con consumidores anteriores durante despliegues progresivos. Cuando se modifique un contrato de evento:

- versionar el evento si es necesario;
- mantener el consumidor anterior durante la ventana de transición;
- no eliminar campos requeridos por consumidores activos;
- inspeccionar profundidad y errores de la Queue después del rollback.

## Checklist operativo

### Antes

- [ ] Confirmar deployment estable anterior.
- [ ] Confirmar compatibilidad del esquema D1.
- [ ] Confirmar que no existe migración destructiva pendiente.
- [ ] Confirmar estado de Queue y DLQ.
- [ ] Confirmar métricas y logs de errores.

### Durante

- [ ] Revertir Worker al deployment estable.
- [ ] No ejecutar migraciones destructivas.
- [ ] Mantener bindings y secrets compatibles.
- [ ] Verificar `/api/health/live`.
- [ ] Verificar `/api/health/ready`.

### Después

- [ ] Ejecutar smoke tests.
- [ ] Verificar error rate.
- [ ] Verificar latencia.
- [ ] Verificar Queue depth.
- [ ] Verificar D1 errors.
- [ ] Verificar notificaciones pendientes.
- [ ] Registrar incidente y causa raíz.

## Estado de validación

El procedimiento está documentado, pero **no hay evidencia de una ejecución controlada de rollback** en un entorno aislado. Preview no debe utilizarse para este propósito mientras sus bindings y datos no estén separados de producción.

Antes de certificar recovery:

1. Confirmar una versión Worker estable y la compatibilidad de su esquema D1.
2. Probar rollback de Worker en un entorno aislado con recursos propios.
3. Verificar liveness/readiness, rutas críticas, colas y logs después de la reversión.
4. Registrar deployment/version IDs, migraciones, hora, operador, resultado y cualquier acción de recuperación.

No ejecutar deliberadamente un rollback de producción como sustituto de esta validación sin autorización operativa y plan de recuperación aprobado.
