# Componentes Modulares del Estudio de Imágenes (`features/images/components`)

Este paquete contiene componentes especializados y desacoplados para la página de generación de imágenes [`images-page.tsx`](../images-page.tsx):

- **`image-constants.ts`**: Constantes numéricas, ratios de aspecto (`ASPECT_RATIOS`, `ASPECT_OPTIONS`), límites de resolución (`MIN_DIM`, `MAX_DIM`) y funciones puras de formateo (`snapDim`, `exportFilename`, `formatTimestamp`).
- **`image-form-fields.tsx`**: Controles de formulario con feedback visual (`Field`, `SliderField`, `DimensionSelect`, `AdvancedSelect`, `ResolvedBadge`).
- **`mask-canvas.tsx`**: Editor interactivo de canvas para inpainting y outpainting con pincel escalable, borrador y exportación de máscaras en resolución nativa.
- **`recipe-popover.tsx`**: Desplegable detallado con los parámetros de generación exactos de cualquier imagen generada y botón de restauración en 1 clic.
- **`loaded-build-summary.tsx`**: Tarjeta de telemetría del modelo cargado en memoria VRAM/RAM (cuantización, encoder de texto, offload y motor de atención).
