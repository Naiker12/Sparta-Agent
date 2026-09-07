# Vista previa de archivos: implementación y verificación

## Cambios

- Cabecera compacta con nombre, descarga, ampliación y cierre en una sola fila.
- Panel redimensionable por arrastre y teclado; conserva el ancho. En pantallas de 1400 px o más reserva espacio junto a la conversación; en pantallas menores mantiene el comportamiento modal.
- Excel y CSV se procesan con SheetJS en un Worker terminable. El visor muestra las hojas disponibles, selecciona inicialmente la primera con datos y pagina de 100 en 100 filas.
- Caché débil por Blob para reutilizar resultados al reabrir el mismo objeto sin mantener archivos vivos indefinidamente.
- PDF y Markdown se cargan bajo demanda. Texto, código, imágenes, audio y vídeo tienen vistas específicas; Word conserva la conversión a HTML existente.
- Indicador de carpeta del proyecto activo y acceso al explorador cuando existe una carpeta conectada.
- El nuevo canal `fs:readPreview` devuelve bytes originales para archivos del explorador, sin convertir primero Excel o PDF a texto. Resuelve rutas reales y rechaza archivos fuera de la raíz conectada, directorios y archivos mayores de 25 MiB.

## Límites explícitos

El visor es de lectura: no sustituye Excel ni reproduce fielmente sus estilos, gráficos o cálculo de fórmulas. Muestra hasta 32 hojas, 500 filas por hoja, 64 columnas y 1000 caracteres por celda. El Worker se termina a los 15 segundos. El texto muestra hasta 1 MiB; la representación enriquecida se limita a 256 KiB. La descarga conserva el archivo original.

PowerPoint y archivos comprimidos continúan con la alternativa de descarga. La carpeta mostrada corresponde al proyecto activo: no demuestra que un adjunto proceda de ella.

## Verificación

- Pruebas de cierre y liberación de referencias, libros con primera hoja vacía y límites de filas/columnas/celdas.
- Pruebas del lector nativo con bytes originales, rutas hermanas, directorios, archivos grandes y junctions que salen de la raíz.
- Prueba visual del componente real con CSV de 221 filas: cabecera de una fila y segunda página comenzando en la fila 101.
- Fixture reproducible: `desktop/frontend-spartan/tests/fixtures/preview-harness.html`, servido por Vite en desarrollo. No forma parte de la entrada de producción.

Estas pruebas no equivalen a una auditoría completa de toda la aplicación ni a una prueba integral del instalador de Electron. La integración nativa requiere reconstruir y reiniciar Electron para cargar el nuevo preload.

## Referencias técnicas

- [SheetJS: procesamiento con Web Workers](https://docs.sheetjs.com/docs/demos/bigdata/worker/).
- [SheetJS: opciones de lectura y límites de filas](https://docs.sheetjs.com/docs/api/parse-options/).
- [shadcn: paneles redimensionables](https://ui.shadcn.com/docs/components/base/resizable).

Se reutilizan las dependencias del proyecto; no se añadió una segunda biblioteca de hojas de cálculo.
