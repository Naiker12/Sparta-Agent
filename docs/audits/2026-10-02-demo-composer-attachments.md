# Composer y adjuntos de la demo

## Comparación con el escritorio

Se revisaron `ComposerToolsMenu`, `ComposerRightControls`, `ReasoningToggle` y las acciones del asistente. Se conservaron los botones y tokens originales ya compartidos con la demo.

| Elemento | Ajuste |
| --- | --- |
| Menú + | AttachmentIcon, CodeIcon, Image03Icon, McpServerIcon, Bookmark02Icon, Download01Icon, PencilRulerIcon y Folder01Icon del escritorio. Web y comparación conservan Lucide, como el original. |
| Dictado | Mismo Mic de Lucide; desactivado en la demo. |
| Razonamiento | Switch original del escritorio. |
| Adjuntos | Selector real de archivos múltiples, nombre, tamaño, eliminación y vista previa local. |
| Texto pegado largo | Se convierte en un File de texto y utiliza el mismo recorrido de adjuntos. |
| Conversación | Los archivos se trasladan del composer al mensaje y se conservan con su entrada de historial y cola. |
| Exportación JSON | Serializa metadatos del archivo; no su contenido. |

## Alcance

La demo conserva referencias de archivos en memoria durante la sesión. La vista previa muestra imágenes PNG/JPEG/WebP/GIF o hasta 10 000 caracteres de archivos de texto de hasta 1 MB. El HTML se presenta como texto; no se ejecuta. Los formatos restantes muestran que la vista previa no está disponible.

Seleccionar archivos no los envía a un servidor, modelo ni proveedor. Las respuestas y llamadas de herramientas siguen siendo ejemplos locales del proyecto; el archivo seleccionado no cambia el contenido de la respuesta. Para el procesamiento real se utiliza el escritorio.

## Validación

Compilación TypeScript/Vite. Se seleccionaron dos archivos de prueba locales, se abrió la vista previa de texto e imagen y se retiró la imagen. Se comprobó el envío con un adjunto y sin texto, que utiliza «Revisa los archivos adjuntos.» como solicitud del ejemplo. La cola permanece detenida mientras la propuesta espera aprobación manual.

Al permitir la propuesta, la cola continuó y el archivo del primer mensaje permaneció en el historial. Un pegado largo creó `texto-pegado.txt` con vista previa. Se comprobó el Switch original y la activación de código en el menú. En 390 × 844, tanto la fila de acciones como la bandeja de adjuntos midieron 251 px de ancho útil y de contenido, sin desbordamiento horizontal. Se retiraron los estilos sin uso del antiguo adjunto ficticio.

Capturas en `artifacts/landing-redesign/`: `composer-local-attachments.png`, `composer-original-menu.png` y `mobile-local-attachments.png`.
