# Fidelidad de la demo al escritorio

Referencia: captura de bienvenida proporcionada por el usuario y componentes actuales del frontend. La demo utiliza datos locales: no ejecuta herramientas, accede al disco ni consume una API.

## Componentes revisados y adaptación

| Escritorio | Demo de landing | Reutilización y alcance |
| --- | --- | --- |
| `thread-welcome.tsx` | Bienvenida | Mismo `GeneratedAvatar`, semillas rotativas y tamaño de 152 px. Saludo fijo para la demostración. |
| `sidebar-brand-header.tsx` | Cabecera lateral | Activo `spartan-logo.svg` del escritorio, azul del tema y mismos iconos de búsqueda y contracción. |
| `user-avatar.tsx` | Perfil lateral | `GeneratedAvatar` con el nombre de perfil del ejemplo. |
| `thread-workspace-chip.tsx` | Selector de carpeta | Estado inicial sin carpeta; opciones locales de ejemplo. No abre carpetas reales. |
| `api-provider-model-selector.tsx` | Selector de modelo | Estado inicial `free` y logo OpenRouter del escritorio. Catálogo acotado; no consulta proveedores. |
| `reasoning-toggle.tsx` | Opciones de razonamiento | Se muestran según las capacidades del modelo del ejemplo. `free` no presupone razonamiento; Claude y Gemini permiten explorar ese recorrido. |
| `composer-tools-menu.tsx` | Herramientas y adjuntos | Menú con toggles, chips y adjunto de ejemplo. No activa servicios. |
| Streaming markdown | Respuesta progresiva | Reutiliza estabilización y caché incremental del escritorio con Streamdown. El texto procede de fixtures locales. |
| Reasoning | Bloque de pensamiento | Helpers de apertura y colapso e icono del escritorio; contenido de ejemplo y duración medida. |
| Tool fallback | Llamada de herramienta | Entrada, resultado y estado expandibles. Llamada simulada declarada. |
| Acciones de respuesta | Botones de mensaje | Botón base del escritorio; copiar, editar ejemplo, regenerar, exportar y detalles. Dictado/TTS no se simulan como activos. |
| Cola del composer | Cola local | Añadir, editar y quitar solicitudes; avance entre respuestas del ejemplo. Sin persistencia de hilos. |
| Workspace rail | Panel lateral | En bienvenida solo explorador. Al iniciar un recorrido se habilitan las vistas del escenario de demostración. |
| Files panel/container | Explorador y cambios | Buscar, copiar contenido, cerrar y redimensionar; contenido original separado de la propuesta aprobada. Archivos de ejemplo. |

## Decisiones visuales

- Tema claro del escritorio sincronizado automáticamente, independiente del fondo oscuro de la landing.
- Cabecera de marca a la altura de los controles de ventana; sin barra duplicada con nombre de aplicación.
- Cabecera de conversación vacía durante la bienvenida.
- Avatar, saludo y composer centrados; placeholder «Pregunta lo que sea…».
- Selector de carpeta «Trabajar en una carpeta», permiso «Aprobar por mí», modelo «free» y envío desactivado cuando no hay texto.
- La demo conserva navegación y ejemplos interactivos, por lo que su lista de proyectos no reproduce los datos privados de la captura.

## Validación

Compilación TypeScript y Vite mediante `npm run build:gh`. Revisión en navegador del estado inicial y del recorrido de conversación. Los cambios de esta revisión se limitan a la landing; los componentes de escritorio se consumen sin modificarlos.

## Segunda revisión: recorrido completo

1. Thinking conserva el texto parcial y el tiempo acumulado al detener y continuar. Una pausa no revela texto que todavía no se ha mostrado. Mantiene los helpers de apertura del escritorio.
2. La respuesta captura modelo, razonamiento, permisos y carpeta al empezar. Modificar el composer no altera retroactivamente esa respuesta. El selector de modelos utiliza Popover y Command para búsqueda, teclado, Escape y retorno del foco.
3. Bienvenida y documentos muestran solo el explorador. El recorrido de aprobación añade cambios; el proyecto muestra las capacidades del workspace de ejemplo. El panel usa la carpeta capturada por la respuesta.
4. El recorrido presenta contexto/razonamiento, llamada de herramienta, streaming y propuesta. La cola espera la decisión cuando la aprobación es manual. Permitir y rechazar son estados terminales de esa propuesta; regenerar reinicia sus estados.
5. El autoscroll sigue los cambios de tamaño mientras el lector esté cerca del final. Si sube, deja de seguir y ofrece «Ir al último mensaje». Se retiraron importaciones y estilos del selector de modelos anterior.

La inspección ampliada de TypeScript con `noUnusedLocals` también detectó importaciones antiguas en módulos de documentación ajenos a esta demo; esa configuración no forma parte del build habitual. No se eliminaron módulos de documentación sin completar su auditoría de dependencias.

### Comprobaciones del navegador

- Búsqueda sin resultados y selección de Claude mediante teclado.
- Detener Thinking, cambiar el modelo del composer y continuar: la respuesta conserva Claude y su bloque de razonamiento.
- Cola retenida durante la aprobación; rechazo resuelto y siguiente solicitud iniciada automáticamente.
- Explorador con contenido original antes de aprobar y contenido propuesto después.
- Documentos con `brief.md`, `reunion.md` y `resumen.md`, sin archivos de código ajenos al recorrido.
- Panel redimensionado mediante teclado de 300 a 324 px.
- Subir en la conversación muestra «Ir al último mensaje»; volver deja la distancia al final en 0 px.
- Navegación móvil a 390 px: abrir Proyectos, cerrar navegación y abrir/cerrar explorador, sin desbordamiento horizontal. Se corrigió la superposición del avatar sobre los botones de navegación.
- Build final correcto; documentación comprobada: 29 páginas y 39 enlaces internos. Consola del navegador sin errores en los recorridos revisados.

Capturas: `artifacts/landing-redesign/desktop-demo-thinking-refined.png` y `desktop-demo-conversation-refined.png`.
