# Plan de implementación: plataforma de reparaciones

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
- Las rutas de técnico requieren rol y permiso de técnico.
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

**Código completo de Fase 2 implementado e integrado en `main`.** No se inicia ni se implementa la Fase 3 hasta cerrar la verificación de esta fase.

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

La verificación automática de Cloudflare debe ejecutarse con éxito antes de considerar la Fase 2 certificada al 100%. En los últimos pushes de `main`, GitHub Actions está creando el job pero terminándolo antes de ejecutar cualquier step, sin pasos ni logs disponibles; por ello la validación de `pnpm test`, `pnpm typecheck`, `pnpm build:cloudflare`, migraciones remotas y smoke/performance de producción no puede marcarse como aprobada todavía.

## 6. Fase 3: dispositivos del cliente

### Objetivo

Relacionar cada cliente con sus dispositivos y reutilizar esos datos en futuras órdenes.

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
