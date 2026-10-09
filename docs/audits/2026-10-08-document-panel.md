# Panel de archivos de Spartan

El panel usa pestañas independientes y una barra de herramientas compartida. Retirar un adjunto del compositor elimina únicamente su pestaña; cerrar una pestaña no elimina el archivo. Cerrar el panel libera los archivos locales retenidos.

## Visores por formato

| Formato | Motor | Comportamiento |
| --- | --- | --- |
| PDF | React-PDF sobre PDF.js | Páginas, zoom, navegación y selección de texto. La rueda desplaza; Ctrl + rueda cambia el zoom. |
| DOCX | docx-preview | Páginas blancas aisladas del tema del chat; estilos, márgenes, imágenes, encabezados y saltos guardados en el documento. |
| XLSX, XLS, ODS y CSV | SheetJS en un worker | Hojas, filas, columnas y valores formateados, con límites de tamaño. No reproduce todos los estilos o gráficos de Excel. |
| Markdown y código | Streamdown | Vista renderizada y acceso al texto fuente. |
| Texto | Visor de texto | Contenido hasta el límite de lectura existente. |
| Imagen, audio y vídeo | Elementos nativos del navegador | Vista o controles multimedia en el panel, según el formato admitido por Electron. |

No hay un motor único local que reproduzca fielmente todos estos formatos. DOC, ODT, RTF, PPT/PPTX y otros archivos sin visor requieren un conversor o motor específico; no se anuncian como compatibles mediante DOCX. Las fuentes originales y los archivos permanecen locales.

## Investigación y límites

- [PDF.js: documentación oficial](https://mozilla.github.io/pdf.js/getting_started/).
- [docx-preview: documentación y opciones](https://github.com/VolodymyrBaydalka/docxjs). Respeta saltos explícitos y los guardados por el editor; no implementa toda la paginación dinámica de Word. La vista HTML puede diferir de Word en documentos complejos o con fuentes no disponibles.
- [SheetJS: utilidades de visualización](https://docs.sheetjs.com/docs/api/utilities/html/).

El fallo observado de Word era un HTTP 504 al cargar la dependencia optimizada durante desarrollo. La dependencia se declara también en el proyecto de escritorio y se precarga en ambos servidores Vite. Se comprobó HTTP 200 para el módulo actual.

## Validación

TypeScript de frontend y shell, paridad de idiomas y compilación de producción aprobados. Las 19 pruebas de pestañas, liberación de archivos, lectura de hojas y estabilidad de adjuntos pasan. La prueba `tests/word-preview-render.smoke.mjs` monta el componente real en Electron aislado y comprueba papel blanco y saltos de página, sin abrir una página de demostración visible.

La prueba de renderizado también abrió `Estadistica_Inferencial_APA7.docx` del usuario: 13 páginas renderizadas. Se validó el componente en Electron aislado; la inspección final de la ventana de uso quedó limitada porque estaba minimizada.

La compilación del escritorio desde la raíz (`npx vite build`) también pasó, incluidos renderer, proceso principal y preload. Reportó advertencias de tamaño de paquetes y dependencias circulares entre módulos de chat; no bloquean la compilación y requieren una revisión aparte de esa arquitectura.
# Continuación: conversión Office e identidad de escritorio

- Se conserva el borde del sidebar en modo oscuro; comprobado en la ventana real de Spartan.
- Windows usa `public/spartan.ico` (16, 32, 48 y 256 px, generado del recurso existente) en la ventana, identidad de la barra de tareas, acceso directo de desarrollo e instalador. El archivo también aparece en `dist/spartan.ico`. No se ha confirmado todavía el icono visible en la barra de tareas tras un reinicio completo.
- PowerPoint (`ppt`, `pptx`, `odp`) y documentos antiguos (`doc`, `odt`, `rtf`) usan el canal `document:office-preview`: conversión local con LibreOffice, perfil temporal independiente y macros desactivadas, límite de 25 MB, tiempo máximo de 60 segundos y retirada de archivos temporales. Se mantienen el adjunto original y su descarga.
- El ejecutable se busca en las ubicaciones habituales o en la ruta absoluta configurada mediante `SPARTAN_OFFICE_CONVERTER`. No se instala ni se incluye LibreOffice automáticamente. En este equipo falta el motor, por lo que la conversión real de estos formatos sigue pendiente. El panel ahora comunica esa dependencia en ES/EN.
- Referencia del motor: [parámetros de LibreOffice](https://help.libreoffice.org/latest/en-GB/text/shared/guide/start_parameters.html). Esta integración no promete equivalencia exacta con Microsoft Office.
- Validación: 10 pruebas del canal de conversión con proceso simulado; TypeScript y paridad de traducciones aprobados; compilación del frontend, proceso principal y preload completada. Persisten advertencias previas de dependencias circulares y tamaño de chunks.

