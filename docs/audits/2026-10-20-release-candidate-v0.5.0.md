# Calificación de release — Sparta Agent 0.5.0

**Estado:** publicada. CI completó las puertas de calidad, cuatro builds de plataforma, validación de instaladores, publicación de GitHub Release y despliegue de GitHub Pages.
**Release:** [v0.5.0](https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.5.0).
**Landing:** [Sparta Agent](https://naiker12.github.io/Sparta-Agent/).

## Alcance publicado

- **Memoria:** distribución más orgánica del mapa de episodios y relaciones, con cálculo en worker y mejoras de lectura/selección.
- **Chat y proyectos:** composición de varios paneles de trabajo, manejo del contexto de carpeta y navegación de archivos/diffs.
- **Telegram y archivos:** lectura de documentos, creación de documentos, descarga de archivos HTTPS públicos y envío de archivos tras confirmación explícita. Los permisos de creación, descarga y envío se configuran por usuario. Las herramientas disponibles tienen límites explícitos y no equivalen a acceso arbitrario al PC, shell o MCP.
- **Voz:** proveedores de transcripción local/remota y respuestas habladas de Telegram con ElevenLabs; la respuesta escrita se conserva como alternativa.
- **Experiencia del producto:** presentación de actividad de herramientas, guía de inicio, ajustes de tema y cierre de la vista previa al salir del chat.
- **Documentación:** README, landing, guía de Canales/Voz, changelog y notas de release.

Este inventario resume el alcance de la versión. La validación automática no sustituye pruebas con cuentas reales del usuario para servicios externos.

## Versionado

Los manifiestos y metadatos de los lockfiles corresponden a `0.5.0`. El ajuste del empaquetador alinea Vite raíz con Vite 8/Rolldown y sus dependencias; las versiones funcionales del producto no cambiaron. La release y los instaladores quedaron publicados bajo el tag `v0.5.0`.

## Comprobaciones

- `node scripts/check-product-version.mjs v0.5.0`: aprobado; manifiestos, lockfiles y notas coinciden.
- En `landing`: `npm run docs:check` aprobó 33 páginas, 63 enlaces internos y navegación; `npm run build:gh` terminó correctamente. La compilación advierte que el chunk `sparta-preview` supera 500 kB (aprox. 570 kB minificado).
- En el repositorio: `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm test` (84/84) y `npm run test:electron` (8/8) aprobaron. Tras el arreglo de iconos, `desktop/frontend-spartan`: `npm run typecheck` y `npm test` (3.668/3.668) también aprobaron.
- Backend: las suites seleccionadas de canales, archivos, bucle de herramientas y voz aprobaron con **364 aprobadas, 2 omitidas**; apareció una advertencia de Starlette.
- En la primera repetición completa del frontend se corrigieron tres pruebas desfasadas: la selección de proyecto por ejecución, la ubicación del componente de navegación de chats y el mock de React de la cola. La suite final aprobó **3.668/3.668**.
- Pruebas de navegador: `npm run test:automations:browser` pasó el flujo de activación, ejecución y aprobación explícita; `npm run test:documents:browser` pasó apertura en frío, Word, PDF, hoja de cálculo, Markdown y reapertura.
- `npm run test:assets:electron` pasó navegación de archivos empaquetados, logos de proveedores, navegación atrás/recarga, consulta del hilo, anclas y redirección de autenticación.
- Las comprobaciones locales se ejecutaron con Node **24.19.0**. El workflow de release ejecutó sus puertas de calidad con la versión de Node configurada para CI; todos los trabajos terminaron correctamente.
- El release original agotó el heap de 12 GB en Linux y Windows; macOS Apple silicon falló igual. La importación del índice entero de `@hugeicons/core-free-icons` era una fuente de trabajo evitable: se cambiaron 566 referencias en 149 archivos a rutas individuales, con sus declaraciones de tipos. Ese cambio solo no corrigió el OOM. La causa determinante era que el comando de release usaba el Vite 7/Rollup de la raíz, mientras el frontend y su build independiente ya usan Vite 8/Rolldown. Alineé la raíz con Vite 8 y el plugin React compatible, añadí `esbuild` como dependencia explícita (la necesita `vite-plugin-electron-renderer`, aunque no la declara) y mantuve una transformación sin publicar. El build combinado transformó 8.256 módulos, terminó los bundles Electron y empaquetó/validó el instalador Windows completo en local con heap máximo de 8 GB. Se quitó `maxParallelFileOps`, que Vite 8 reportaba como opción inválida. Ambos destinos de macOS siguen usando Intel con la arquitectura explícita. El primer CI con Vite 8 falló antes de compilar porque npm 10 detectó que faltaba el peer opcional `@pierre/theme@1.1.0` de `@pierre/trees` en el lockfile regenerado por npm 11. Se restauró la entrada validada del lockfile anterior; `npm@10.9.9 ci --dry-run` ahora pasa. Falta repetir CI y confirmar Linux, Windows y las dos arquitecturas de macOS con el lock corregido.
- Los trabajos de CI de Windows x64, Linux x64, macOS Intel y macOS Apple silicon, la validación de artefactos y los metadatos del actualizador terminaron correctamente. Las pruebas automatizadas de Telegram y voz usan proveedores simulados; las cuentas y claves reales requieren configuración y validación en cada instalación.

## Seguimiento posterior a la publicación

1. Completar pruebas manuales con bot y cuentas reales para lectura/envío de archivos, revocación de permisos, Whisper en español y síntesis de ElevenLabs. Las pruebas simuladas no reemplazan estas comprobaciones.
2. Mantener landing, README y guías alineados con los instaladores y el alcance de 0.5.0.

El workflow de `v0.5.0` ejecutó las puertas de calidad, construyó los cuatro instaladores, publicó la release y desplegó la landing en GitHub Pages. El commit de esta actualización documental volverá a ejecutar el workflow para publicar también los textos corregidos.
