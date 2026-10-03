# Limpieza de imágenes y archivos generados

Se retiraron 66 archivos (7.003.519 bytes, aproximadamente 6,68 MiB): 53 imágenes, 6 scripts auxiliares y 7 archivos de salida de auditoría o pruebas. Las rutas y tamaños están en `2026-10-02-generated-assets-cleanup-manifest.json`.

## Imágenes

Se eliminaron 47 capturas generadas en `artifacts/`, además de estos seis recursos antiguos sin referencias de ejecución detectadas:

- `public/rounded-512.png`: copia sobrante; se conserva `rounded.png`, usado por el avatar.
- `public/sparta-icon.png`.
- `landing/public/escritorio.png`.
- `landing/public/sparta-escritorio.png`: el icono usado por Electron está en `public/` y permanece.
- `landing/public/proyecto/CONTEXTO.png`.
- `landing/public/proyecto/Permisos antes de las acciones sensibles.png`.

Se conservan `landing/public/post.png`, referenciado por Open Graph y Twitter; `SPARTAN-PRINCIPAL.png`, utilizado en el README; los logos actuales, fuentes, videos, iconos de proveedores y recursos de los manifiestos. Las menciones a capturas antiguas en auditorías previas describen evidencia histórica, no recursos disponibles después de esta limpieza.

## Scripts retirados

| Archivo | Motivo |
| --- | --- |
| `scripts/audit-source-cleanup.mjs` | Herramienta temporal de la limpieza terminada. |
| `scripts/clean-legacy-comments.py` | Herramienta temporal de la limpieza terminada. |
| `scripts/classify-audit-suites.mjs` | Clasificador auxiliar de resultados de una auditoría, sin llamadas desde compilación, CI o aplicación. |
| `scripts/seed-dev-data.ts` | Definiciones de ejemplo sin consumidores; no poblaba los stores ni tenía un punto de ejecución. |
| `tests/landing-news.browser.mjs` | Prueba de un anuncio y sección de novedades retirados del diseño actual. |
| `artifacts/landing-redesign/preview-server.mjs` | Servidor temporal con ruta absoluta de esta máquina; no había proceso activo ejecutándolo. |

Se conservan los scripts de compilación, empaquetado, generación del catálogo MCP, sincronización del demo y las pruebas del composer actual. El manifiesto de la limpieza anterior se trasladó a `docs/audits/2026-10-02-source-cleanup-manifest.json`.

`artifacts/` queda ignorado por Git para que las siguientes pruebas puedan generar capturas y logs sin incorporarlos al código fuente. No se borraron dependencias, datos de usuario, la distribución activa ni los instaladores.

## Verificación

La landing compila correctamente y la comprobación de tipos del escritorio y Electron pasa. Las 20 pruebas dirigidas de API-only y autenticación del shell pasan. Se comprobó que los 66 archivos retirados ya no existen y que permanecen los recursos activos, scripts de compilación e iconos de ambos manifiestos. No se ejecutó una prueba visual completa de Electron en esta etapa.
