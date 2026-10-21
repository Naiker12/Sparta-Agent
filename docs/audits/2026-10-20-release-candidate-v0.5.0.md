# Preparación de release — Sparta Agent 0.5.0

**Estado:** se corrigió el empaquetador raíz; build completo Windows aprobado localmente con heap de 8 GB. Pendiente repetir CI y validar instaladores multiplataforma antes de publicar.
**Versión anterior publicada:** 0.4.1.  
**Rama de trabajo:** `main`, con cambios locales aún sin commit.

## Alcance preparado

- **Memoria:** distribución más orgánica del mapa de episodios y relaciones, con cálculo en worker y mejoras de lectura/selección.
- **Chat y proyectos:** composición de varios paneles de trabajo, manejo del contexto de carpeta y navegación de archivos/diffs.
- **Telegram y archivos:** lectura de documentos, creación de documentos, descarga de archivos HTTPS públicos y envío de archivos tras confirmación explícita. Los permisos de creación, descarga y envío se configuran por usuario. Las herramientas disponibles tienen límites explícitos y no equivalen a acceso arbitrario al PC, shell o MCP.
- **Voz:** proveedores de transcripción local/remota y respuestas habladas de Telegram con ElevenLabs; la respuesta escrita se conserva como alternativa.
- **Experiencia del producto:** presentación de actividad de herramientas, guía de inicio, ajustes de tema y cierre de la vista previa al salir del chat.
- **Documentación:** README, landing, guía de Canales/Voz, changelog y estas notas de preparación.

Este inventario describe los cambios presentes en el árbol de trabajo revisado. No sustituye una revisión de diff final ni certifica que cada función esté lista para distribuir.

## Versionado preparado

Los manifiestos del producto y los metadatos raíz de sus lockfiles se prepararon como `0.5.0`. El ajuste correctivo del empaquetador alinea Vite raíz con Vite 8/Rolldown y sus dependencias; las versiones funcionales del producto no cambiaron. El README apunta al candidato y advierte que la última descarga disponible sigue siendo 0.4.1. La nota de `docs/releases/v0.5.0.md` está redactada como base de publicación y debe cotejarse contra el diff final.

## Comprobaciones de esta preparación

- `node scripts/check-product-version.mjs v0.5.0`: aprobado; manifiestos, lockfiles y notas coinciden.
- En `landing`: `npm run docs:check` aprobó 33 páginas, 63 enlaces internos y navegación; `npm run build:gh` terminó correctamente. La compilación advierte que el chunk `sparta-preview` supera 500 kB (aprox. 570 kB minificado).
- En el repositorio: `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm test` (84/84) y `npm run test:electron` (8/8) aprobaron. Tras el arreglo de iconos, `desktop/frontend-spartan`: `npm run typecheck` y `npm test` (3.668/3.668) también aprobaron.
- Backend: las suites seleccionadas de canales, archivos, bucle de herramientas y voz aprobaron con **364 aprobadas, 2 omitidas**; apareció una advertencia de Starlette.
- En la primera repetición completa del frontend se corrigieron tres pruebas desfasadas: la selección de proyecto por ejecución, la ubicación del componente de navegación de chats y el mock de React de la cola. La suite final aprobó **3.668/3.668**.
- Pruebas de navegador: `npm run test:automations:browser` pasó el flujo de activación, ejecución y aprobación explícita; `npm run test:documents:browser` pasó apertura en frío, Word, PDF, hoja de cálculo, Markdown y reapertura.
- `npm run test:assets:electron` pasó navegación de archivos empaquetados, logos de proveedores, navegación atrás/recarga, consulta del hilo, anclas y redirección de autenticación.
- Las comprobaciones locales se ejecutaron con Node **24.19.0**. El workflow de release usa Node 22 y volverá a ejecutar sus puertas de calidad en CI.
- El release original agotó el heap de 12 GB en Linux y Windows; macOS Apple silicon falló igual. La importación del índice entero de `@hugeicons/core-free-icons` era una fuente de trabajo evitable: se cambiaron 566 referencias en 149 archivos a rutas individuales, con sus declaraciones de tipos. Ese cambio solo no corrigió el OOM. La causa determinante era que el comando de release usaba el Vite 7/Rollup de la raíz, mientras el frontend y su build independiente ya usan Vite 8/Rolldown. Alineé la raíz con Vite 8 y el plugin React compatible, añadí `esbuild` como dependencia explícita (la necesita `vite-plugin-electron-renderer`, aunque no la declara) y mantuve una transformación sin publicar. El build combinado transformó 8.256 módulos, terminó los bundles Electron y empaquetó/validó el instalador Windows completo en local con heap máximo de 8 GB. Se quitó `maxParallelFileOps`, que Vite 8 reportaba como opción inválida. Ambos destinos de macOS siguen usando Intel con la arquitectura explícita. El primer CI con Vite 8 falló antes de compilar porque npm 10 detectó que faltaba el peer opcional `@pierre/theme@1.1.0` de `@pierre/trees` en el lockfile regenerado por npm 11. Se restauró la entrada validada del lockfile anterior; `npm@10.9.9 ci --dry-run` ahora pasa. Falta repetir CI y confirmar Linux, Windows y las dos arquitecturas de macOS con el lock corregido.
- Todavía no hay instaladores multiplataforma validados ni se probaron integraciones con un bot/cuentas reales.

## Pendiente antes de aprobar la publicación

1. Construir y revisar los instaladores Windows x64, macOS Apple silicon, macOS Intel y Linux x64; validar tamaños, nombres, checksums y metadatos del actualizador.
2. Hacer pruebas manuales con bot y cuentas reales para lectura/envío de archivos, revocación de permisos, Whisper en español y síntesis de ElevenLabs. Las pruebas simuladas no reemplazan estas comprobaciones.
3. Confirmar que los textos de disponibilidad de la landing y la guía de alcance coincidan con la versión que efectivamente se vaya a publicar.

El tag `v0.5.0` inicia el workflow que ejecuta las puertas de calidad, construye los cuatro instaladores, publica la release y despliega la landing en GitHub Pages. Si un trabajo de calidad o empaquetado falla, el paso de publicación no se ejecutará.
