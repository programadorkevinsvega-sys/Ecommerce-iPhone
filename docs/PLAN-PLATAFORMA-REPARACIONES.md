# Plan de implementación: plataforma de reparaciones

# Estado consolidado — 2026-09-21

La plataforma de reparaciones ya no está en una etapa puramente de planificación. Existe implementación real para cliente, Admin, órdenes, repuestos y técnicos.

| Área | Estado |
|---|---|
| Catálogo configurable de servicios | 🟢 Implementado |
| Portal de cliente | 🟢 Implementado |
| Dispositivos de cliente | 🟢 Implementado |
| Órdenes de reparación | 🟢 Implementado + operaciones Admin |
| Asignación de técnicos | 🟢 Implementado |
| Identidad técnica independiente | 🟢 Implementado |
| Portal técnico | 🟡 Funcional; `TechnicianHeader` integrado, rediseño visual pendiente |
| Evidencia fotográfica | 🟢 Implementada |
| Repuestos | 🟢 Implementado |
| Seguimiento público | 🟢 Implementado |
| Auditoría | 🟢 Implementada |
| Notificaciones | 🟡 Implementadas; DLQ/retry/replay pendientes |
| Certificación productiva final | 🟡 Pendiente |

## Regla de estado

Una funcionalidad implementada no se marca como certificada hasta pasar tests, gates de arquitectura/seguridad, build Cloudflare, deploy y verificación de producción.


## 1. Objetivo

Extender el ecommerce actual para convertirlo en una plataforma operativa de reparación y mantenimiento de dispositivos.

El sistema deberá cubrir:

- Solicitud pública de servicios.
- Órdenes de reparación y órdenes de trabajo.
- Diagnóstico técnico.
- Aprobación de presupuestos.
- Inventario de repuestos.
- Asignación de técnicos.
- Control de calidad.
- Evidencia fotográfica.
- Seguimiento público para el cliente.
- Garantías de reparación.
- CRM e historial del cliente.
- Notificaciones.
- Dashboard operativo y financiero.

La implementación debe utilizar la arquitectura existente del proyecto y ejecutarse sobre Cloudflare:

- Next.js y TypeScript para la aplicación web.
- Cloudflare Workers mediante OpenNext.
- Cloudflare D1 para datos transaccionales.
- Cloudflare R2 para imágenes y archivos.
- APIs del servidor para toda operación protegida.
- Sin mocks, fixtures ni datos de ejemplo en producción.

## 2. Reglas de arquitectura

### 2.1 Persistencia

Toda información operativa debe persistirse en D1 mediante migraciones versionadas.

R2 se utilizará para fotografías, documentos y evidencias. El frontend nunca accederá directamente a R2: siempre utilizará rutas públicas o protegidas del Worker.

### 2.2 Capas

Cada módulo nuevo debe respetar las capas existentes:

```text
Ruta API
  ↓
Aplicación / caso de uso
  ↓
Dominio
  ↓
Repositorio / puerto de persistencia
  ↓
D1 o R2
```

Las reglas de negocio no deben quedar únicamente en React ni en las rutas HTTP.

### 2.3 Seguridad

- Las rutas administrativas requieren sesión y permiso explícito.
- Las rutas de técnico requieren una sesión `technician_session` válida; la autorización operativa se limita al técnico autenticado y a las órdenes asignadas.
- Las rutas del cliente solo muestran sus propias órdenes.
- Las consultas públicas de seguimiento deben utilizar un identificador no predecible o un token de consulta.
- No se exponen errores internos de D1, stack traces, secretos ni nombres internos.
- Todos los datos se validan en el servidor.
- Las fotos privadas se sirven mediante rutas autorizadas y URLs con expiración cuando corresponda.
- Las acciones importantes generan auditoría.

### 2.4 Estado de implementación

Cada fase debe terminar con:


1. Migración D1.
2. Dominio y casos de uso.
3. Repositorio.
4. API.
5. Interfaz necesaria.
6. Tests.
7. Verificación de build Cloudflare.
8. Commit directo en `main`.

## 3. Fase 0: auditoría y preparación

La auditoría ejecutada para este proyecto está documentada en [FASE-00-AUDITORIA-ARQUITECTURA.md](./FASE-00-AUDITORIA-ARQUITECTURA.md).

### Objetivo

Entender y preparar la infraestructura actual antes de agregar módulos operativos.

### Trabajo

- Revisar entidades actuales de clientes, productos, servicios, pagos y usuarios Admin.
- Identificar el sistema de roles y permisos existente.
- Revisar `service_types` y `service_requests`.
- Revisar el sistema de media y R2.
- Revisar auditoría administrativa.
- Revisar notificaciones y colas existentes.
- Confirmar índices y convenciones de IDs.
- Confirmar estrategia de migraciones remotas D1.
- Documentar campos que deben conservar compatibilidad.

### Resultado

Un mapa de dependencias y un contrato de módulos que evite crear otra capa paralela de clientes, autenticación, servicios o archivos.

## 4. Fase 1: catálogo operativo de servicios

### Objetivo

Convertir los tipos de servicio en un catálogo real y configurable.

### Cada servicio debe soportar

- Código.
- Slug.
- Nombre.
- Descripción.
- Imagen.
- Precio desde opcional.
- Precio fijo opcional.
- Tiempo estimado.
- Garantía en días o meses.
- Marcas compatibles.
- Modelos compatibles.
- Requisitos de recepción.
- Si requiere diagnóstico.
- Si requiere cotización.
- Si requiere aprobación.
- Si requiere pago.
- Estado publicado/oculto.

### Servicios iniciales configurables desde Admin

El sistema no debe asumirlos como datos hardcodeados. El administrador podrá crear los que necesite, por ejemplo:

- Cambio de pantalla.
- Cambio de batería.
- Puerto de carga.
- Cámara.
- Micrófono o altavoz.
- Face ID o Touch ID.
- Reparación de placa.
- Daño por líquido.
- Recuperación de datos.
- Mantenimiento preventivo.
- Limpieza interna.
- Actualización o restauración de software.

### Entidades sugeridas

- `service_types`.
- `service_type_compatibility`.
- `service_type_requirements`.

## 5. Fase 2: cuentas y portal del cliente

### Estado de implementación

**Implementación de Fase 2 integrada en `main`.** La verificación automática final de producción sigue pendiente; no se debe interpretar la implementación como certificación.

La implementación incluye:

- Migración D1 de cuentas de cliente, recuperación de acceso y dispositivos.
- Migración D1 de auditoría de seguridad de cuentas.
- Puerto de repositorio de cuentas y casos de uso de cuenta.
- Registro con normalización de email, unicidad y hash de contraseña.
- Inicio de sesión independiente de Admin.
- Sesiones persistidas, con expiración y revocación.
- Cierre de sesión con revocación y limpieza de cookie.
- Recuperación de acceso con token almacenado únicamente como hash y expiración.
- Frontend completo para solicitar recuperación y establecer la nueva contraseña.
- Perfil con teléfono, WhatsApp y país.
- CRUD de direcciones de recepción con aislamiento por `customer_id`.
- Portal autenticado con direcciones, dispositivos, reparaciones, compras, garantías y comunicaciones.
- Aislamiento de recursos mediante consultas acotadas al cliente autenticado.
- Auditoría de registro, login exitoso/fallido, logout, actualización de perfil y recuperación de contraseña, incluyendo fecha y origen disponible en Cloudflare.
- Pruebas de las reglas principales de registro, autenticación, unicidad y perfil, además de las pruebas existentes de sesiones.

### Objetivo

Permitir que el cliente registre una cuenta, inicie sesión y consulte su historial.

### Funciones públicas

- Registro.
- Inicio de sesión.
- Recuperación de acceso.
- Cierre de sesión.
- Perfil.
- Teléfono.
- WhatsApp.
- País.
- Direcciones o información de recepción.
- Mis dispositivos.
- Mis reparaciones.
- Mis compras.
- Mis garantías.
- Mis comunicaciones.

### Reglas

- La sesión del cliente debe ser independiente de la sesión Admin.
- El cliente solo puede leer sus propios recursos.
- El email se normaliza y debe ser único.
- Las contraseñas se almacenan únicamente como hash.
- Las sesiones deben poder revocarse.
- Las acciones sensibles deben registrar fecha y origen.

### Verificación pendiente de cierre

La implementación está integrada, pero la certificación final requiere evidencia directa de Cloudflare/producción para el release correspondiente. GitHub Actions no se utiliza como sustituto cuando no ejecuta steps ni produce logs.

## 6. Fase 3: dispositivos del cliente

### Objetivo

Registrar y mantener la identidad operativa de los equipos asociados a cada cliente para reutilizarlos en futuras órdenes de reparación.

El cliente puede consultar sus dispositivos, pero la creación, edición y archivado de los datos técnicos de un equipo corresponde al personal autorizado del taller. El dispositivo representa un activo físico recibido o gestionado por la operación, por lo que los datos de identificación y condición no deben quedar bajo edición libre del cliente.

### Roles

- `ADMIN`: puede registrar, consultar, editar y archivar dispositivos de clientes según sus permisos.
- `TECHNICIAN`: ya registra y actualiza los datos técnicos del equipo dentro del flujo operativo de reparación, limitado a órdenes asignadas.
- `CUSTOMER`: puede consultar únicamente sus propios dispositivos y utilizarlos como referencia al solicitar o consultar una reparación.

### Datos

- Cliente.
- Tipo de dispositivo.
- Marca.
- Modelo.
- IMEI, con protección y almacenamiento limitado cuando sea posible.
- Serial, con protección y almacenamiento limitado cuando sea posible.
- Color.
- Capacidad.
- Estado físico conocido.
- Notas.
- Fecha de alta.

### Seguridad

El IMEI y el serial no deben mostrarse públicamente completos. Las vistas públicas solo deben mostrar los últimos cuatro caracteres cuando sea necesario.

### Módulo de identidad y acceso del técnico

El técnico es una identidad de empleado independiente de admin_users y de las cuentas de cliente.

#### Rutas web

- /technician/login
- /technician
- /technician/orders
- /technician/devices
- /technician/profile

#### API de autenticación

- /api/technician/auth/login
- /api/technician/auth/logout
- /api/technician/auth/session

La cookie de sesión es technician_session. La sesión se persiste en D1, se almacena mediante hash del token, expira y puede revocarse.

#### Persistencia

- technician_users.
- technician_sessions.
- technician_audit_events.

La plataforma parte de una instalación nueva: no existe migración de cuentas técnicas desde Admin. Las identidades técnicas se crean exclusivamente en technician_users y nunca se almacenan como usuarios administrativos.

### Estado actual del portal técnico

El portal técnico es funcional y dispone de login, dashboard, órdenes, dispositivos y perfil. Existe `apps/web/app/technician/TechnicianHeader.tsx` como base de navegación, pero el workspace actual todavía requiere una iteración visual para quedar al mismo nivel de diseño del storefront y del backoffice.

La prioridad de UI pendiente es únicamente presentación/UX; no implica cambiar el modelo de autorización ni crear otro sistema de permisos. Los últimos errores de compilación/tipado detectados en `TechnicianUser`, `TechnicianHeader` y `StoreHeader` fueron corregidos en `main`; la certificación sigue condicionada a build/deploy/verify exitosos.

#### Gestión administrativa

Administración dispone de /admin/technicians y las APIs correspondientes para crear, actualizar, activar/desactivar y restablecer el acceso de técnicos.

La cuenta técnica tiene identidad y sesión independientes y su rol operativo es Técnico. El alta es administrativa: Administración introduce el correo, nombre, apellido y contraseña inicial del técnico. No existe registro público ni endpoint de auto-registro para técnicos.

La gestión de cuentas administrativas está separada en /admin/users, donde una cuenta con permiso de gestión de administradores puede crear usuarios administrativos, activar/desactivar cuentas y asignar/cambiar sus roles RBAC (SUPER_ADMIN, ADMIN, MANAGER, SALES, SUPPORT, INVENTORY, FINANCE y CONTENT_EDITOR). El rol administrativo no se reutiliza como identidad del técnico.

Las cuentas técnicas no obtienen permisos del panel administrativo.

#### Aislamiento operativo

Un técnico autenticado:

- Solo puede consultar órdenes cuyo assigned_technician_id coincide con su identidad.
- Solo puede modificar fichas técnicas de sus órdenes.
- Solo puede registrar o actualizar el dispositivo del cliente vinculado a una orden que tenga asignada.
- Puede registrar evidencias en R2 para sus propias órdenes.
- Solo puede ejecutar las transiciones de estado permitidas para el flujo técnico.
- No puede acceder a operaciones protegidas de /admin.

## 7. Fase 4: órdenes de reparación

### Objetivo

Crear una orden de reparación completa desde una solicitud del cliente o desde el Admin.

### Identificador

Formato legible para el cliente:

```text
REP-2026-000184
```

El ID interno debe ser independiente, aleatorio y no enumerable.

### Datos principales

- Orden.
- Cliente.
- Dispositivo.
- Servicio solicitado.
- IMEI o serial protegido.
- Problema reportado.
- Estado físico de recepción.
- Accesorios entregados.
- Fecha de recepción.
- Fecha estimada.
- Técnico asignado.
- Garantía prevista.
- Notas internas.
- Notas visibles para el cliente.

### Estados

```text
RECEIVED
DIAGNOSING
WAITING_APPROVAL
WAITING_PART
IN_REPAIR
QUALITY_CONTROL
READY
DELIVERED
CANCELLED
```

Las transiciones deben validarse en el dominio. No se permitirá cambiar un estado arbitrariamente desde el frontend.

### Entidades sugeridas

- `repair_orders`.
- `repair_order_events`.
- `repair_order_accessories`.
- `repair_order_status_history`.
- `repair_order_assignments`.

## 7.1 Ficha técnica del dispositivo

### Objetivo

Cada orden debe incluir una ficha técnica completa del equipo. Esta ficha será el documento operativo que conecta la recepción, el diagnóstico, el trabajo técnico, las piezas utilizadas, el control de calidad y la garantía.

La ficha debe poder consultarse desde Admin, desde el dashboard del técnico y, con los datos protegidos correspondientes, desde el portal del cliente.

### Identificación del dispositivo

```text
Modelo: iPhone 15 Pro
Serial: XXXXX
IMEI: XXXXX
Color: Titanio natural
Capacidad: 256 GB
```

El serial y el IMEI deben almacenarse de forma protegida. Las vistas públicas no deben mostrar los valores completos y, cuando sea suficiente, deben mostrar únicamente los últimos cuatro caracteres.

### Estado inicial

El estado inicial debe registrarse al recibir el equipo, antes de comenzar cualquier diagnóstico:

```text
Pantalla: rota
Marco: rayado
Cámara: funcional
Face ID: funcional
Batería: 81%
```

Debe permitir:

- Valores configurables por tipo de dispositivo.
- Resultado `FUNCIONAL`, `NO_FUNCIONAL`, `DANADO`, `NO_PROBADO` o `NO_APLICA`.
- Observación libre validada.
- Evidencia fotográfica asociada.
- Usuario que realizó la inspección.
- Fecha y hora.

### Diagnóstico

La ficha debe separar claramente el estado inicial del diagnóstico técnico:

```text
Diagnóstico:
Pantalla dañada
```

El diagnóstico debe guardar:

- Pruebas realizadas.
- Hallazgos.
- Causa probable.
- Daños adicionales.
- Diagnóstico principal.
- Recomendación técnica.
- Técnico responsable.
- Fecha y hora.
- Evidencias asociadas.

El diagnóstico no debe sobrescribir el estado inicial. Si se corrige un dato, debe quedar una nueva versión o un evento de auditoría.

### Trabajo realizado

La ficha debe registrar el trabajo que realmente se ejecutó, separado del trabajo recomendado:

```text
Trabajo realizado:
Cambio de display
```

Debe incluir:

- Servicio ejecutado.
- Tareas realizadas.
- Técnico responsable.
- Tiempo empleado.
- Resultado.
- Observaciones.
- Fecha de inicio.
- Fecha de finalización.
- Evidencia posterior a la reparación.

### Piezas utilizadas

Cada pieza utilizada debe provenir del inventario de repuestos:

```text
Pieza: DISPLAY-OLED-15PRO
Cantidad: 1
Calidad: OEM
Lote: LOTE-2026-09
```

La ficha debe guardar una copia histórica de los datos aplicados a la reparación, aunque el repuesto cambie de nombre o se desactive después.

Debe registrar:

- SKU.
- Nombre del repuesto.
- Cantidad.
- Costo.
- Precio aplicado.
- Lote.
- Proveedor.
- Técnico que lo instaló.
- Fecha de consumo.
- Movimiento de inventario asociado.

### Control de calidad

El resultado del QC debe formar parte de la ficha técnica:

```text
QC: APROBADO
```

Debe incluir:

- Checklist ejecutado.
- Resultado de cada prueba.
- Observaciones.
- Evidencia fotográfica posterior.
- Técnico que realizó la revisión.
- Usuario que aprobó el control.
- Fecha y hora.
- Resultado final: `APROBADO`, `RECHAZADO` o `REQUIERE_RETRABAJO`.

No se debe permitir pasar una orden a `READY` si el control de calidad obligatorio está incompleto o rechazado.

### Garantía asociada

La garantía final debe quedar enlazada a la ficha:

```text
Garantía: 6 meses
Inicio: 13/09/2026
Vencimiento: 13/03/2027
Cobertura: display e instalación
Estado: ACTIVA
```

La garantía debe identificar exactamente qué trabajo y qué piezas cubre. Si se presenta una reclamación, el sistema debe consultar la ficha técnica y comprobar si el componente o trabajo reclamado está dentro de cobertura.

### Modelo de datos sugerido

La ficha puede implementarse con entidades separadas para conservar trazabilidad:

- `repair_device_sheets`: encabezado e identificación del equipo.
- `repair_device_condition_items`: estado inicial por componente.
- `repair_diagnostics`: diagnósticos y hallazgos.
- `repair_work_logs`: trabajos realizados y tiempo técnico.
- `repair_order_parts`: piezas utilizadas en la orden.
- `repair_quality_checks`: checklist de control de calidad.
- `repair_warranties`: garantía emitida para el trabajo.
- `repair_order_media`: fotos asociadas a cada etapa.

Todas deben relacionarse con `repair_orders` y mantener el actor y la fecha de cada cambio.

### Vista operativa de la ficha

En Admin y Técnico, la ficha debe organizarse por etapas:

```text
1. Identificación del dispositivo
2. Estado inicial y recepción
3. Diagnóstico
4. Presupuesto aprobado
5. Trabajo realizado
6. Piezas consumidas
7. Control de calidad
8. Garantía
9. Historial y evidencias
```

El cliente podrá ver una versión reducida, sin notas internas, costos internos, información de proveedores ni datos sensibles.

### Criterios de aceptación de la ficha

- No se puede crear una orden sin identificar el dispositivo o justificar que la identificación está pendiente.
- IMEI y serial nunca se muestran completos en vistas públicas.
- El estado inicial no se puede borrar al comenzar el diagnóstico.
- El diagnóstico queda asociado a un técnico y a una fecha.
- El trabajo realizado puede diferir de la recomendación original.
- Las piezas utilizadas descuentan inventario y quedan asociadas a la orden.
- El QC debe aprobarse antes de marcar el equipo como listo.
- La garantía se crea a partir del trabajo y las piezas efectivamente registradas.
- Toda edición importante queda auditada.
- La ficha puede consultarse después de entregar el dispositivo.

## 8. Fase 5: recepción y evidencia fotográfica

### Objetivo

Proteger al cliente y al negocio documentando el estado del equipo al recibirlo.

### Evidencia de recepción

- Foto frontal.
- Foto trasera.
- Laterales.
- Pantalla.
- Daños existentes.
- Accesorios.
- Etiqueta o serial cuando corresponda.

### Reglas de archivos

- Tipos permitidos: JPG, PNG o WebP.
- Tamaño máximo validado en servidor.
- Límite de archivos por etapa.
- Metadatos persistidos en D1.
- Archivo almacenado en R2.
- Acceso mediante endpoint del Worker.
- Eliminación o sustitución auditada.

### Entidad sugerida

`repair_order_media` con:

- ID.
- Orden.
- Etapa.
- Tipo de evidencia.
- R2 key.
- MIME type.
- Tamaño.
- Usuario que la cargó.
- Fecha.

## 9. Fase 6: diagnóstico técnico

### Objetivo

Permitir que el técnico registre hallazgos reproducibles y genere una recomendación.

### Diagnóstico

- Pruebas realizadas.
- Hallazgos.
- Daños adicionales.
- Estado de batería.
- Pruebas de pantalla.
- Pruebas de cámaras.
- Pruebas de conectividad.
- Pruebas de carga.
- Diagnóstico de placa.
- Observaciones.
- Evidencia fotográfica.
- Tiempo estimado.
- Técnico responsable.

### Resultado

- Reparación recomendada.
- Reparación no viable.
- Requiere repuesto.
- Requiere aprobación.
- Requiere información adicional.

### Entidades sugeridas

- `repair_diagnostics`.
- `repair_diagnostic_checks`.
- `repair_findings`.

## 10. Fase 7: presupuesto y aprobación del cliente

### Objetivo

Separar diagnóstico, presupuesto y autorización para evitar reparaciones no aprobadas.

### Presupuesto

- Repuestos.
- Mano de obra.
- Descuentos.
- Impuestos si aplican.
- Total estimado.
- Tiempo estimado.
- Vigencia.
- Condiciones.

### Flujo

```text
DIAGNÓSTICO COMPLETADO
        ↓
PRESUPUESTO EMITIDO
        ↓
ESPERANDO APROBACIÓN
        ↓
APROBADO / RECHAZADO / EXPIRADO
```

### Aprobación

Debe registrar:

- Usuario o cliente.
- Fecha y hora.
- IP o contexto técnico permitido.
- Versión del presupuesto.
- Evidencia mostrada.
- Resultado.

No debe modificarse un presupuesto aprobado. Cualquier cambio debe crear una nueva versión.

### Entidades sugeridas

- `repair_quotes`.
- `repair_quote_items`.
- `repair_quote_decisions`.

## 11. Fase 8: inventario de repuestos

### Objetivo

Separar el inventario comercial del inventario operativo del taller.

### Datos de un repuesto

- SKU.
- Nombre.
- Descripción.
- Tipo de dispositivo.
- Marca.
- Modelos compatibles.
- Proveedor.
- Costo.
- Precio aplicado.
- Stock.
- Stock mínimo.
- Ubicación física.
- Lote.
- Garantía.
- Calidad: original, OEM o aftermarket.
- Estado activo/inactivo.

### Operaciones

- Entrada de inventario.
- Salida manual.
- Reserva para reparación.
- Consumo al completar reparación.
- Liberación de reserva.
- Ajuste auditado.
- Alertas de stock bajo.

### Regla crítica

Una reparación no debe descontar stock definitivamente al crear el presupuesto. El sistema debe reservar repuestos al aprobar y consumirlos al utilizarlos o al avanzar al estado definido por el negocio.

### Entidades sugeridas

- `repair_parts`.
- `repair_part_compatibility`.
- `repair_stock_movements`.
- `repair_part_reservations`.
- `repair_suppliers`.

## 12. Fase 9: mano de obra y costos

### Objetivo

Conocer el costo real y el margen de cada reparación.

### Datos

- Técnico.
- Tipo de trabajo.
- Minutos trabajados.
- Tarifa.
- Costo interno.
- Precio cobrado.
- Notas.

### Métricas

- Costo total.
- Precio de venta.
- Margen absoluto.
- Margen porcentual.
- Tiempo real.
- Diferencia entre estimado y real.

## 13. Fase 10: reparación y orden de trabajo del técnico

### Objetivo

Dar al técnico una interfaz enfocada en sus órdenes y tareas.

### Dashboard del técnico

- Mis órdenes.
- Orden asignada.
- Estado actual.
- Prioridad.
- Fecha prometida.
- Repuestos reservados.
- Diagnóstico pendiente.
- Control de calidad pendiente.

### Acciones

1. Iniciar diagnóstico.
2. Agregar hallazgos.
3. Adjuntar fotos.
4. Seleccionar repuestos.
5. Registrar mano de obra.
6. Marcar reparación terminada.
7. Enviar a control de calidad.

El técnico no debe acceder a funciones administrativas que no correspondan a su rol.

## 14. Fase 11: control de calidad

### Objetivo

Evitar entregar un equipo sin validar las funciones reparadas.

### Checklist configurable

- Pantalla.
- Touch.
- Cámara frontal.
- Cámara trasera.
- Altavoz.
- Micrófono.
- Wi-Fi.
- Bluetooth.
- Carga.
- Face ID o Touch ID.
- Batería.
- Botones.
- Estado cosmético.

### Resultado

- Aprobado.
- Rechazado.
- Requiere nueva reparación.
- Requiere aprobación adicional.

Debe registrar técnico, fecha, checklist, observaciones y firma o confirmación digital.

### Entidades sugeridas

- `quality_control_templates`.
- `repair_quality_checks`.
- `repair_quality_results`.

## 15. Fase 12: seguimiento público de reparación

### Objetivo

Permitir que un cliente consulte su orden sin llamar al taller.

### Entrada

- Número de reparación.
- Token de seguimiento o verificación adicional.

No debe ser posible enumerar órdenes cambiando únicamente un número consecutivo.

### Vista

- Equipo recibido.
- Diagnóstico realizado.
- Aprobación pendiente.
- Reparación aprobada.
- Reparación en proceso.
- Control de calidad.
- Listo para recoger.
- Entregado.

También debe mostrar:

- Fechas y horas de eventos visibles.
- Próximo paso.
- Mensaje del taller.
- Información de contacto.

## 16. Fase 13: garantías

### Objetivo

Crear y validar garantías automáticamente después de una reparación entregada.

### Datos

- Número de garantía.
- Orden de reparación.
- Cliente.
- Dispositivo.
- Trabajo cubierto.
- Piezas cubiertas.
- Inicio.
- Vencimiento.
- Condiciones.
- Estado.

### Estados

```text
ACTIVE
EXPIRED
CLAIMED
VOID
```

### Reclamación

El sistema debe comprobar:

- Si la garantía está activa.
- Si el dispositivo coincide.
- Si el problema está cubierto.
- Si existe una exclusión.
- Si ya hubo una reclamación.

### Entidades sugeridas

- `repair_warranties`.
- `warranty_claims`.
- `warranty_claim_events`.

## 17. Fase 14: CRM e historial del cliente

### Objetivo

Consolidar la relación comercial completa.

### Historial

```text
Cliente
├── Dispositivos
├── Reparaciones
├── Compras
├── Facturas
├── Garantías
├── Comunicaciones
└── Diagnósticos
```

### Funciones Admin

- Buscar cliente.
- Ver dispositivos.
- Ver reparaciones.
- Ver compras.
- Ver garantías.
- Registrar notas internas.
- Consultar comunicaciones.
- Ver órdenes repetidas.
- Ver últimas interacciones.

## 18. Fase 15: notificaciones

### Eventos

- Dispositivo recibido.
- Diagnóstico listo.
- Presupuesto emitido.
- Aprobación requerida.
- Reparación aprobada.
- Reparación iniciada.
- Repuesto pendiente.
- Control de calidad iniciado.
- Equipo listo para recoger.
- Equipo entregado.
- Garantía registrada.

### Canales

Implementar inicialmente el canal que ya sea compatible con la infraestructura del proyecto. Posteriormente se podrán agregar:

- Email.
- WhatsApp mediante proveedor oficial.
- SMS.
- Push.

Las notificaciones deben ser eventos idempotentes, con reintentos y auditoría de entrega.

## 19. Fase 16: dashboard administrativo

### KPIs

- Ingresos del día.
- Ingresos del periodo.
- Órdenes abiertas.
- Órdenes en reparación.
- Pendientes de aprobación.
- Listos para entregar.
- Ticket promedio.
- Margen de reparación.
- Tasa de reparación exitosa.
- Garantías activas.
- Garantías reclamadas.

### Gráficos

- Reparaciones por día.
- Ingresos por servicio.
- Ingresos por técnico.
- Reparaciones por marca.
- Fallas más frecuentes.
- Repuestos más utilizados.
- Margen por reparación.
- Tiempo promedio de diagnóstico.
- Tiempo promedio de reparación.
- Diagnóstico convertido en reparación.
- Reparaciones repetidas.

### Implementación

Las métricas deben calcularse en D1 mediante consultas agregadas y endpoints específicos. El navegador no debe descargar todas las órdenes para calcular métricas pesadas.

## 20. Fase 17: APIs previstas

### Cliente

```text
POST   /api/customer/auth/register
POST   /api/customer/auth/login
POST   /api/customer/auth/logout
GET    /api/customer/profile
GET    /api/customer/devices
POST   /api/customer/devices
GET    /api/customer/repairs
GET    /api/customer/repairs/:id
POST   /api/customer/repairs
POST   /api/customer/quotes/:id/approve
POST   /api/customer/quotes/:id/reject
GET    /api/customer/warranties
```

### Seguimiento público

```text
POST   /api/repairs/lookup
GET    /api/repairs/public/:token
```

### Admin

```text
GET    /api/admin/repair-orders
POST   /api/admin/repair-orders
GET    /api/admin/repair-orders/:id
PATCH  /api/admin/repair-orders/:id
POST   /api/admin/repair-orders/:id/assign
POST   /api/admin/repair-orders/:id/quote
POST   /api/admin/repair-orders/:id/parts
POST   /api/admin/repair-orders/:id/quality-control
POST   /api/admin/repair-orders/:id/deliver
GET    /api/admin/repair-parts
POST   /api/admin/repair-parts
PATCH  /api/admin/repair-parts/:id
GET    /api/admin/repair-metrics
GET    /api/admin/users/:id/permissions
PATCH  /api/admin/users/:id/permissions
```

### Técnico

Implementación actual:

```text
POST   /api/technician/auth/login
POST   /api/technician/auth/logout
GET    /api/technician/auth/session

GET    /api/technician/orders
PATCH  /api/technician/orders/:id
POST   /api/technician/orders/:id/media

GET    /api/technician/devices
POST   /api/technician/devices
PATCH  /api/technician/devices/:orderId

GET    /api/technician/profile
PATCH  /api/technician/profile
```

Estas rutas utilizan la identidad independiente `technician_session` y aplican autorización por técnico autenticado y asignación de la orden.

## 21. Fase 18: permisos y roles

La autorización administrativa combina RBAC con overrides por cuenta.

Roles administrativos actuales:

- `SUPER_ADMIN`: acceso completo y permisos protegidos.
- `ADMIN`: permisos administrativos definidos por la política RBAC, excepto `admins:manage` por defecto.
- `MANAGER`: permisos operativos definidos por la política RBAC.
- `SALES`: ventas y consulta comercial.
- `SUPPORT`: atención y solicitudes.
- `INVENTORY`: productos e inventario.
- `FINANCE`: pagos, reembolsos y auditoría.
- `CONTENT_EDITOR`: catálogo, contenido, promociones y servicios ofrecidos.

Los técnicos tienen identidad independiente en `technician_users` y no son un rol de `admin_users`.

### Permisos efectivos

Los permisos base provienen del rol mediante `ROLE_PERMISSIONS`.

Cada cuenta administrativa puede tener overrides persistidos en `admin_user_permissions`:

- `inherit`: conserva el permiso definido por el rol.
- `grant`: permite el permiso aunque el rol no lo conceda.
- `deny`: bloquea el permiso aunque el rol lo conceda.

El backend autoriza contra el conjunto efectivo resultante, no únicamente contra el rol.

### Gestión administrativa

En `/admin/users`, al editar una cuenta se puede:

- asignar o cambiar el rol;
- activar o desactivar la cuenta;
- cambiar la contraseña;
- consultar el estado efectivo de cada permiso;
- permitir o denegar permisos individuales;
- restaurar un permiso a la herencia del rol.

`SUPER_ADMIN` conserva todos los permisos y sus permisos individuales están protegidos.

No se permite modificar los permisos de la propia cuenta. Un administrador tampoco puede conceder a otra cuenta un permiso que no posea efectivamente.

Los cambios se registran en `admin_audit_log`.

Permisos administrativos actuales:

- `dashboard:read`.
- `products:read`.
- `products:write`.
- `categories:read`.
- `categories:write`.
- `orders:read`.
- `orders:write`.
- `customers:read`.
- `customers:write`.
- `services:read`.
- `services:write`.
- `repair_orders:read`.
- `repair_orders:write`.
- `refunds:create`.
- `payments:void`.
- `payments:read`.
- `service_types:write`.
- `admins:manage`.
- `audit:read`.
- `inventory:read`.
- `inventory:write`.
- `reviews:write`.
- `promotions:write`.
- `cms:write`.
- `settings:write`.
- `technicians:manage`.

## 22. Fase 19: caching y rendimiento

- Catálogo público de servicios: cache controlado.
- Seguimiento de una orden: sin cache público.
- Admin y técnico: `no-store`.
- Imágenes públicas en R2: cache inmutable cuando la URL sea versionada.
- Evidencias privadas: URLs protegidas o expirables.
- Invalidar o revalidar servicios cuando se publiquen cambios.
- Usar índices D1 para estados, cliente, técnico, fechas y número de orden.
- Paginar órdenes, movimientos y eventos.
- Evitar consultas N+1 en dashboards.

## 23. Fase 20: auditoría y trazabilidad

Registrar como mínimo:

- Creación de orden.
- Cambio de estado.
- Asignación de técnico.
- Cambio de presupuesto.
- Aprobación o rechazo.
- Reserva y consumo de repuestos.
- Carga y eliminación de fotos.
- Resultado de diagnóstico.
- Resultado de control de calidad.
- Entrega.
- Creación o invalidación de garantía.

La auditoría debe conservar actor, acción, recurso, recurso afectado, fecha y metadatos no sensibles.

## 24. Fase 21: pruebas

### Dominio

- Transiciones válidas e inválidas.
- Cálculo de totales.
- Cálculo de margen.
- Garantías vencidas.
- Compatibilidad de repuestos.
- Reservas de inventario.

### API

- Cliente no puede ver otra orden.
- Técnico no puede modificar órdenes no asignadas.
- Admin sin permiso recibe `403`.
- Usuario no autenticado recibe `401`.
- IDs inválidos reciben respuesta controlada.
- Aprobación duplicada es idempotente.
- Doble reserva no genera stock negativo.
- Archivos inválidos son rechazados.

### Integración

- Crear solicitud pública.
- Crear orden.
- Diagnosticar.
- Emitir presupuesto.
- Aprobar presupuesto.
- Reservar repuesto.
- Completar reparación.
- Ejecutar QC.
- Entregar.
- Crear garantía.
- Consultar seguimiento.

### Frontend

- El cliente puede registrar cuenta.
- El cliente puede solicitar reparación.
- El cliente puede aprobar presupuesto.
- El técnico puede operar una orden.
- Admin puede gestionar servicios y repuestos.
- No existen arrays de negocio hardcodeados.
- Los estados de carga, vacío y error son claros.

## 25. Orden recomendada de entrega

### MVP operativo

1. Auditoría.
2. Catálogo configurable de servicios.
3. Cuenta del cliente.
4. Dispositivos del cliente.
5. Órdenes de reparación.
6. Seguimiento público.
7. Dashboard básico de órdenes.

### Operación profesional

8. Recepción y fotos.
9. Diagnóstico técnico.
10. Presupuestos y aprobación.
11. Roles de técnico.
12. Dashboard técnico.
13. Control de calidad.

### Control financiero y de inventario

14. Repuestos.
15. Reservas y consumos.
16. Mano de obra.
17. Costos y margen.
18. Garantías.
19. Dashboard financiero.

### Escalamiento

20. CRM.
21. Notificaciones.
22. WhatsApp o SMS.
23. Automatizaciones.
24. Reportes exportables.
25. Multi-sede, si el negocio lo requiere.

## 26. Criterios de aceptación globales

La plataforma se considerará implementada cuando:

- Un cliente pueda crear una cuenta.
- El cliente pueda consultar sus dispositivos y seleccionar un dispositivo registrado al solicitar una reparación.
- El cliente pueda solicitar un servicio real.
- Se genere una orden persistida en D1.
- El Admin pueda recibir y asignar la orden.
- El técnico pueda diagnosticar y documentar el equipo.
- Se pueda emitir un presupuesto.
- El cliente pueda aprobarlo o rechazarlo.
- El sistema pueda reservar y consumir repuestos.
- El técnico pueda completar la reparación.
- Se pueda ejecutar control de calidad.
- El cliente pueda consultar el estado.
- Se genere la garantía correspondiente.
- El Admin pueda consultar métricas reales.
- Las fotos y archivos se sirvan mediante el Worker y R2.
- Existan auditoría, permisos y validaciones de servidor.
- Las pruebas pasen.
- `pnpm build:cloudflare` pase.
- Las migraciones remotas D1 se apliquen correctamente.
- Cada entrega quede en `main` con un commit identificable.
