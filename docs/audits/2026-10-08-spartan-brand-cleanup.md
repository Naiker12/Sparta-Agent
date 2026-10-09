# Spartan: nombre y limpieza de código

Fecha: 2026-10-08. Nombre corto confirmado por el usuario: **Spartan**.

## Cambios

- Nombre de ventana, identidad Electron, instalador, arranque y traducciones del producto unificados como Spartan. Se conserva `com.sparta.agent` y el directorio real de datos del usuario.
- Temas y clases CSS de la aplicación renombrados de `unsloth-*` a `spartan-*`, con sus consumidores. El clasificador de soporte de modelos ahora está en `features/hub/lib/model-support.ts`.
- Mensajes de errores y etiquetas de la interfaz eliminan la antigua marca del producto. Los enlaces relativos de las notas de versión apuntan al repositorio de Spartan.
- Proyectos nuevos: `Documents/Spartan/Projects`. Las variables `SPARTAN_HOME`, `SPARTAN_DOCUMENTS_HOME` y `SPARTAN_PROJECTS_HOME` tienen prioridad; las antiguas siguen funcionando como compatibilidad.
- Eliminada la clase duplicada `ProjectWorkspaceError`: las rutas ahora capturan el mismo error que genera el almacenamiento.

## Archivos retirados

Sin referencias de producción: `components/example.tsx`, `features/chat/thread-sidebar.tsx`, `components/gallery-item-menu.tsx`, `features/hub/lib/channels.ts`. Retirada la prueba exclusiva del menú de galería eliminado. El módulo y la prueba `unsloth-support` se renombraron, preservando sus comprobaciones.

Las pruebas API antiguas se actualizaron para comprobar dependencias reales, permitir la transcripción CPU actual y verificar textos traducidos. No se eliminaron las protecciones del arranque.

## Límites y referencias conservadas

La carpeta MediaDock que aparece en la captura es una ruta persistida de un proyecto existente. Sigue mostrando su ubicación real; cambiar el texto no mueve sus archivos. No se ha realizado una migración de carpetas existentes ni se han eliminado documentos del usuario.

Los identificadores de modelos y repositorios de terceros, cabeceras del protocolo, claves persistidas, variables compatibles y avisos de licencia se conservan. No son marca visible de Spartan y borrarlos por una coincidencia textual puede romper datos o dependencias.

`scripts/audit-spartan-cleanup.mjs` registra candidatos sin referencias estáticas en `output/cleanup/audit.json`. Esa lista **no acredita que sean prescindibles**: incluye declaraciones TypeScript, entradas CLI, barriles y módulos usados por pruebas. Falta verificar el alcance de los módulos locales antiguos y sus pruebas mixtas antes de otra eliminación. La auditoría estática realizada cubre el frontend; no constituye una prueba de ausencia de uso de todos los archivos del repositorio o de cargadores dinámicos del backend.

## Validación

- Compilación de producción del frontend completada; advertencias de tamaño de chunks e importaciones mixtas.
- TypeScript frontend y shell, y paridad de traducciones: aprobados.
- Contrato API y autenticación del gestor del backend: 22 pruebas aprobadas.
- Rutas y almacenamiento de proyectos: 20 aprobadas, una omitida.
- Soporte de modelos, versión de escritorio, permisos de carpetas y capacidades de descarga: 19 aprobadas.
- Interfaz de escritorio revisada: marca SPARTAN, acceso superior al chat temporal y Contenedores deshabilitado con Próximo.
# Continuación de limpieza e icono

- Retirados `components/llama-update-banner.tsx` y `hooks/use-llama-update-pref.ts`: no había importadores de producción fuera de ese par. Retiradas sus comprobaciones exclusivas; se conservan las pruebas de las superficies y banners activos (19 aprobadas).
- La preparación global de pruebas del antiguo módulo `core.inference.diffusion_prequant` solo actúa cuando ese módulo existe. Su ausencia ya no impide ejecutar pruebas de Telegram; los fallos de dependencias internas siguen propagándose. Las pruebas antiguas que importan directamente ese módulo todavía requieren clasificación individual.
- Icono Windows unificado como `public/spartan.ico`; conserva el diseño existente. Su presentación final en la barra de tareas sigue pendiente de un reinicio completo y comprobación visual.
- La auditoría estática se volvió a ejecutar. Sus candidatos no constituyen una lista automática de archivos que se puedan borrar.

