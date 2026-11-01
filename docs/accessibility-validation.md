# Validación de accesibilidad

## Alcance automatizado

Playwright y Axe cubren `/`, `/catalog`, `/iphone/iphone-17-pro-max`, `/cart`, `/checkout` y `/admin/login`. La suite comprueba idioma, landmark principal, nombres accesibles, alternativas de imágenes, estilos inline, Axe con tags WCAG 2.0/2.1/2.2 A/AA, navegación de teclado, foco visible, validación nativa de formularios y ausencia de overflow horizontal a 640 px y 320 px.

La automatización comprueba estados reproducibles. **No certifica conformidad WCAG 2.2 AA ni sustituye pruebas manuales con tecnologías de asistencia.**

## Procedimiento manual requerido

Estas comprobaciones permanecen pendientes hasta que una persona las ejecute y registre fecha, versión del navegador, sistema operativo y resultado.

### Teclado
1. Abrir cada ruta en Chromium y Firefox sin usar ratón.
2. Recorrer con `Tab` y `Shift+Tab`; confirmar orden lógico y foco visible.
3. Activar enlaces con `Enter` y botones con `Enter` y `Space`.
4. Abrir cada diálogo, comprobar foco inicial, contención, cierre con `Escape` y retorno al activador.
5. Completar búsqueda, carrito y checkout; confirmar que errores y confirmaciones reciben foco o son anunciados.
6. Confirmar que ningún control necesario depende exclusivamente de hover o arrastre.

### Zoom y reflow
1. Ampliar el zoom del navegador al 200%.
2. A 400% de zoom, comprobar el reflow en un viewport equivalente a 320 CSS px, sin scroll horizontal de contenido ordinario.
3. Revisar tablas, menús, formularios, diálogos, botones y textos largos.

### Lectores de pantalla

| Plataforma | Tecnología sugerida | Recorrido |
|---|---|---|
| Windows | NVDA + Firefox o Chrome | Inicio, catálogo, detalle, carrito, checkout y login admin |
| macOS | VoiceOver + Safari | Los mismos recorridos; encabezados, landmarks, nombres y estados |
| Android | TalkBack + Chrome | Catálogo, detalle, carrito y formularios móvil |

Registrar si encabezados y landmarks permiten navegar, si campos anuncian nombre/instrucciones/error, si estados dinámicos se anuncian una sola vez y si los diálogos conservan el contexto.

## Registro

No se declara que NVDA, JAWS, VoiceOver o TalkBack hayan sido ejecutados. Añadir una fila por ejecución manual:

| Fecha | SO / navegador / AT | Ruta y recorrido | Resultado | Defectos / issue |
|---|---|---|---|---|
| Pendiente | Pendiente | Pendiente | No ejecutado | Requiere validación humana |

Un resultado Axe limpio es evidencia automatizada, no una certificación WCAG.
