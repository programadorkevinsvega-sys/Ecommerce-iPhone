# Fase 0: auditoría y preparación

## Estado

**Completada como auditoría técnica.** Esta fase no crea todavía tablas de reparaciones. Su objetivo es establecer qué existe, qué se reutiliza y qué debe extenderse sin romper el ecommerce actual.

**Rama auditada:** `main`  
**Entorno objetivo:** Cloudflare Workers + D1 + R2 + Queues  
**Fecha:** 2026-09-13

## 1. Arquitectura actual

El repositorio utiliza un monolito modular con DDD y Clean Architecture:

```text
apps/web
  Rutas Next.js, páginas, componentes y adapters HTTP

modules/*
  Domain, Application e Infrastructure por bounded context

migrations/
  Migraciones SQL versionadas para D1

Cloudflare
  Workers/OpenNext, D1, R2, Queues y Rate Limiting
```

La dirección esperada de dependencias es:

```text
Presentation -> Application -> Domain
                       ^
                       |
                 Infrastructure
```

El dominio no depende de Next.js, Cloudflare, D1, R2, proveedores de pago ni clientes HTTP.

## 2. Infraestructura reutilizable

### 2.1 Clientes

Existe el bounded context `modules/customers` con:

- Entidad `Customer`.
- `CustomerRepository`.
- `CustomerManagement`.
- `AdminCustomerManagement`.
- `CustomerSessionService`.
- Repositorio D1 de clientes.
- Repositorio D1 de sesiones.
- Generador de tokens basado en Web Crypto.
- Cookie `customer_session`.

La infraestructura de sesión ya existe y puede reutilizarse. Falta completar la experiencia pública de registro e inicio de sesión del cliente y sus rutas HTTP correspondientes.

### 2.2 Servicios actuales

Existe el bounded context `modules/services` con:

- `ServiceTypeDefinition`.
- `ServiceRequest`.
- `ServiceCustomerPortal`.
- `ServiceManagement`.
- `AdminServiceQueryService`.
- `AdminServiceDetailsService`.
- `ServiceWorkflowService`.
- Repositorio D1 de tipos de servicio.
- Repositorio D1 de solicitudes.
- Auditoría de cambios de servicios.

Las rutas existentes incluyen:

- `GET /api/services`.
- `POST /api/services`.
- `GET /api/services/:id`.
- Rutas administrativas para listar, consultar y cambiar solicitudes.
- Rutas administrativas para administrar tipos de servicio.

### 2.3 D1 actual

Las migraciones relevantes son:

- `0004_services.sql`: solicitudes y eventos de servicio.
- `0005_service_types.sql`: catálogo configurable de servicios.
- `0006_configurable_service_requests.sql`: elimina la dependencia de un CHECK de tipos hardcodeados.
- `0021_service_contact.sql`: teléfono, WhatsApp y país.
- `0007_admin.sql`: usuarios, sesiones y auditoría administrativa.
- `0013_admin_inventory.sql`: ajustes de inventario.
- `0008_notifications.sql`: outbox y entregas.
- `0022_catalog_service_images.sql`: imágenes de categorías y servicios.

### 2.4 Administración y permisos

Existe RBAC centralizado en `modules/admin/application/Rbac.ts`.

Roles actuales:

- `SUPER_ADMIN`.
- `ADMIN`.
- `MANAGER`.
- `SALES`.
- `SUPPORT`.
- `INVENTORY`.
- `FINANCE`.
- `CONTENT_EDITOR`.
- `TECHNICIAN`.

El rol `TECHNICIAN` ya tiene permisos de lectura y escritura sobre servicios. Para la plataforma de reparaciones se deberán agregar permisos específicos para diagnóstico, piezas, QC y órdenes, sin ampliar innecesariamente los permisos actuales.

### 2.5 Auditoría

Existe:

- `AuditPort` en Application.
- `D1AuditPort`.
- `D1AdminUserAuditPort`.
- Auditoría de login, logout y acciones administrativas.
- Auditoría de solicitudes y tipos de servicio.

La nueva plataforma debe reutilizar estos puertos. No se debe crear una tabla o servicio de auditoría paralelo.

### 2.6 Media y R2

Existe:

- Binding `MEDIA_BUCKET`.
- Endpoint `/api/media/[...key]`.
- Endpoint de media administrativa.
- Soporte para imágenes de productos, categorías, servicios y carruseles.
- Validación de extensiones y scopes en el backend.

Las fotos de recepción, diagnóstico, reparación y QC deben almacenar en R2 únicamente la referencia segura y sus metadatos en D1. El frontend nunca debe acceder directamente al binding R2.

### 2.7 Notificaciones

Existe el módulo `notifications` con:

- Eventos de dominio.
- Outbox en D1.
- Procesamiento asíncrono.
- Entregas idempotentes.
- Proveedor de email.
- Integración con eventos de pedidos y servicios.

Los eventos de reparación deben integrarse al outbox existente, no crear un sistema de notificaciones paralelo.

### 2.8 Inventario

Existe `modules/inventory` para ajustes del stock comercial de productos.

Ese inventario no cubre todavía repuestos de taller, reservas, lotes, proveedores ni consumo por reparación. Debe extenderse con un submodelo de repuestos operativo, conservando el inventario comercial separado.

## 3. Hallazgo principal: solicitud vs orden de reparación

La tabla actual `service_requests` representa una solicitud de servicio y contiene:

- Cliente opcional.
- Email.
- Tipo de servicio.
- Marca y modelo.
- Últimos cuatro de serial e IMEI.
- Operador.
- Descripción del problema.
- Notas.
- Cotización simple.
- Técnico asignado.
- Estado de servicio.
- Notas de resolución.

Esto es suficiente para una solicitud inicial, pero no para una orden de taller completa.

Actualmente faltan:

- Número de orden legible.
- Ficha técnica versionada.
- Estado físico inicial por componente.
- Evidencia fotográfica por etapa.
- Diagnóstico estructurado.
- Presupuesto con partidas.
- Aprobación versionada del cliente.
- Repuestos y reservas.
- Mano de obra.
- Control de calidad.
- Entrega.
- Garantía asociada al trabajo realizado.

### Decisión de arquitectura

No se debe convertir `service_requests` en una tabla gigante ni cambiar destructivamente sus estados actuales. Se conservará como intake compatible y se añadirá una orden de reparación relacionada:

```text
service_requests
       1
       │
       └── 0..1 repair_orders
                    │
                    ├── device_sheet
                    ├── diagnostics
                    ├── quotes
                    ├── work_logs
                    ├── parts
                    ├── quality_control
                    ├── media
                    └── warranty
```

Una solicitud `REPAIR` podrá convertirse en orden cuando el negocio la acepte. Las solicitudes de diagnóstico o configuración podrán mantenerse como solicitudes simples o convertirse según la política del servicio.

## 4. Estados actuales y futuros

### Estados actuales de solicitud

```text
PENDING
QUOTED
PAYMENT_PENDING
PAID
PROCESSING
WAITING_CUSTOMER
COMPLETED
REJECTED
REFUNDED
```

### Estados previstos de orden de reparación

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

Los estados de reparación deben vivir en el nuevo agregado `repair_orders`. No se deben mezclar automáticamente con los estados de pago o solicitud actuales.

## 5. Datos existentes y compatibilidad

Actualmente no se debe asumir que existen productos, órdenes de reparación o repuestos reales suficientes para migrar datos históricos complejos.

La estrategia será:

- Mantener intactos los registros actuales.
- Permitir que `service_requests` antiguas sigan funcionando.
- Crear órdenes nuevas sin exigir una migración destructiva.
- Convertir solicitudes existentes mediante un caso de uso explícito cuando el Admin lo solicite.
- No inventar fichas técnicas para solicitudes antiguas.
- Marcar como `PENDING_REVIEW` cualquier dato histórico incompleto si la migración futura lo necesita.

## 6. Seguridad identificada

### Ya existente

- Sesión administrativa con cookies protegidas.
- RBAC.
- Rate limiting.
- Auditoría.
- Validación server-side.
- R2 detrás de endpoints del Worker.
- Protección de IMEI y serial mediante últimos cuatro.
- Cache controlado para información pública.
- `no-store` para Admin.

### Pendiente para reparaciones

- Token no enumerable para seguimiento público.
- Autorización por propietario para órdenes y dispositivos.
- Permisos específicos del técnico.
- Protección de fotos privadas.
- Auditoría de aprobación de presupuesto.
- Idempotencia de reservas y consumo de repuestos.
- Validación de transiciones del agregado de reparación.
- Control de acceso a notas internas.

## 7. Riesgos técnicos

### Riesgo 1: duplicar el catálogo de servicios

El catálogo actual ya está en `service_types`. La plataforma debe extenderlo con precio, tiempo, garantía y compatibilidad mediante columnas o tablas relacionadas, no crear otro catálogo.

### Riesgo 2: mezclar inventario comercial y de taller

Los productos vendidos y los repuestos tienen ciclos de vida distintos. Se mantendrán separados, aunque ambos puedan compartir componentes de auditoría y métricas.

### Riesgo 3: guardar fotos directamente en D1

D1 solo debe guardar metadatos y la referencia de R2. El binario siempre debe ir a R2.

### Riesgo 4: exponer el IMEI o serial

Nunca se debe devolver el valor completo a vistas públicas, logs, URLs, analytics o notificaciones.

### Riesgo 5: descontar repuestos antes de aprobación

Se deben separar reserva, consumo y liberación. La creación de un presupuesto no debe reducir definitivamente el stock.

### Riesgo 6: usar el dashboard actual para técnicos

El Admin y el Técnico requieren superficies distintas. El técnico solo debe ver sus órdenes, tareas y permisos operativos.

## 8. Decisiones para la Fase 1

La siguiente implementación debe comenzar por el núcleo de reparación:

1. Crear el módulo `modules/repairs`.
2. Crear `repair_orders` relacionado con `service_requests`.
3. Definir el agregado y sus transiciones.
4. Crear el número de orden no enumerable.
5. Crear la ficha técnica del dispositivo.
6. Crear eventos de estado y auditoría.
7. Crear repositorio D1 y tests de dominio.
8. Añadir la conversión controlada desde una solicitud aceptada.

No se implementarán todavía piezas, QC o notificaciones específicas hasta que el agregado base y la ficha técnica estén estables.

## 9. Criterios de cierre de Fase 0

- La arquitectura actual está identificada.
- Las entidades reutilizables están identificadas.
- No se propone una segunda autenticación.
- No se propone una segunda persistencia.
- No se propone acceso directo del frontend a R2.
- Se distingue solicitud de servicio de orden de reparación.
- Se define una estrategia compatible con datos existentes.
- Se identifican permisos y riesgos.
- Se define el alcance concreto de la Fase 1.
- El informe queda versionado en `main`.
