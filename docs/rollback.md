# Rollback — Foundation

## Objetivo

Permitir recuperar una versión estable del Worker sin introducir inconsistencias en D1, R2 o Queues.

## Principios

1. El rollback de aplicación debe ser reversible.
2. Las migraciones de D1 deben diseñarse backward-compatible cuando exista despliegue progresivo.
3. Una migración destructiva no debe formar parte del mismo release que requiere rollback del código a la versión anterior.
4. Staging debe validar el procedimiento antes de producción.

## Estrategia de despliegue

```text
Release candidate
      ↓
Staging migration
      ↓
Staging Worker
      ↓
Smoke/E2E
      ↓
Production migration
      ↓
Production Worker
      ↓
Health + metrics
```

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

## Prueba obligatoria

Antes de declarar Foundation `COMPLETE`, ejecutar en staging un despliegue y rollback controlado y conservar evidencia del resultado en el sistema de CI/CD o en el registro operativo del proyecto.
