# Revisión de streaming y composer

## Referencias del escritorio

Se compararon `reasoning.tsx`, las reglas puras de `reasoning-visibility.ts`, `composer-right-controls.tsx` y `thread-composer-dock.tsx` con los adaptadores de la landing. La demo comparte el icono de razonamiento, sus reglas de apertura y el procesamiento incremental de Markdown; conserva un runtime local de ejemplo.

## Correcciones

- El contenido de razonamiento y respuesta deja de marcarse como streaming activo cuando se detiene la generación.
- Continuar conserva el texto recibido. Regenerar inicia otra ronda y reinicia sus estados.
- Un mensaje nuevo conserva en el historial el texto parcial de una respuesta detenida, sin completarla artificialmente.
- Finalizar no abre automáticamente el panel ni desplaza la conversación con un cambio de vista.
- Modelo, razonamiento, micrófono y envío permanecen en un grupo de controles derechos que se adapta al ancho.
- El selector de carpeta abre con flecha abajo, admite Escape y restaura el foco al seleccionar o cerrar.
- Se retiraron el permiso duplicado de la barra de carpeta y la regla que ocultaba el micrófono en móvil.
- Código y diferencias admiten ajuste de líneas opcional.

## Comprobaciones

Compilación TypeScript/Vite y revisión de espacios correctas. En navegador se verificaron Thinking con modelo compatible, detener y continuar, regenerar, respuesta parcial detenida y finalización sin apertura automática del panel. Se recorrieron las diez secciones del diálogo; la búsqueda por razonamiento y el cambio de envío con Enter funcionan. En móvil de 390 × 844 se comprobó el composer y el panel de diferencias con ajuste de líneas, sin desbordamiento horizontal de página.

## Límites

El recorrido y las respuestas siguen siendo ejemplos locales. No hay inferencia ni herramientas reales por API en la landing. La presencia de las diez secciones no implica paridad funcional completa con el escritorio: las funciones nativas se identifican o desactivan en la demo.
