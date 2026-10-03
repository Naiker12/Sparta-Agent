# Panel de archivos de la demo

Se revisaron el explorador, el rail y el visor de diferencias del frontend de escritorio antes de adaptar su presentación a la landing.

## Cambios

- Carpetas de ejemplo plegables, búsqueda y estado sin resultados.
- Las tarjetas de respuesta seleccionan nuevamente su archivo aunque el panel ya esté abierto en otro documento.
- Selector Original/Propuesta y diferencias con numeración independiente para ambas versiones.
- Vista Markdown mediante el renderizador compartido del escritorio.
- Formulario de vista previa con validación local y estados de error y éxito.
- Contenido desplazable dentro del panel y redimensionamiento por teclado.

## Validación

Compilación TypeScript/Vite correcta. Se comprobaron selección repetida de archivo, búsqueda sin resultados, versiones original y propuesta, diferencias, vista Markdown, validación del formulario y cambio de ancho mediante flechas. En un viewport de 390 × 844 el panel no genera desbordamiento horizontal de página.

## Alcance

Los archivos y las carpetas son fixtures identificados como ejemplos. El visor de diferencias es un adaptador de presentación; no importa los stores ni el acceso al sistema de archivos de Electron. El formulario no envía datos y la demo no ejecuta código ni modifica archivos reales.
