# Landing, documentación y persistencia de mascota — 9 de octubre de 2026

## Cambios locales

Se añadió la guía de Automatizaciones y su entrada en navegación, búsqueda e inicio. La landing explica el plan desde chat, la revisión del horario/modelo y la activación explícita. La demo conserva su carácter simulado. Las guías de canales, documentos, alcance y diagnóstico distinguen las correcciones locales de una versión publicada.

Se corrigió `prebuild:gh` para generar también el catálogo de documentación, igual que el build normal.

La auditoría inicial de landing reportó nueve avisos, seis de severidad alta y tres baja. La actualización compatible del lockfile eliminó los de KaTeX y source-map-js. Se fijó la herramienta de publicación `gh-pages` en 6.1.1 para retirar la cadena vulnerable braces → micromatch → fast-glob → globby de 6.3.0. No se ejecutó deploy. La auditoría final reportó cero vulnerabilidades; el instalador emitió avisos de paquetes antiguos de la herramienta de publicación, sin avisos de seguridad en npm audit.

## Mascota que vuelve a la selección anterior

El selector guardaba inmediatamente en el almacén local, mientras la sincronización con el backend tenía un retraso de 800 ms. Al cerrar antes de completar esa sincronización, el siguiente arranque cargaba el perfil remoto anterior sobre la elección local. El mismo riesgo existía cuando fallaba el guardado remoto; su error era absorbido por la sincronización.

El almacén ahora conserva `avatarSyncPending` junto a la selección. La hidratación mantiene esa elección hasta confirmar que el backend guardó el mismo avatar. La confirmación de un guardado antiguo no borra la marca de una elección posterior. Si el servidor ya contiene la misma selección, también se reconoce como sincronizada. Esta marca es local y no amplía el esquema del backend.

## Validación

- `landing docs:check`: 31 páginas, 56 enlaces internos, navegación completa.
- `landing build:gh`: TypeScript y compilación para `/Sparta-Agent/` correctos después de actualizar dependencias.
- `landing npm audit`: cero vulnerabilidades.
- Navegador sobre el build de producción: landing y las 31 guías cargan sin errores de JavaScript; la guía de automatizaciones no desborda horizontalmente el viewport móvil de 390 px. Captura revisada visualmente.
- 11 pruebas de perfil aprobadas: catálogo, migración, hidratación, fallo de guardado, respuestas antiguas y recreación del almacén con persistencia real de Zustand.
- Typecheck global, ESLint global y `git diff --check`: correctos.

El build conserva una advertencia de tamaño en el chunk diferido de la demo (aproximadamente 566 kB). No se ha probado publicación con gh-pages, un proveedor real ni cerrar/reabrir manualmente Electron. La suite general del frontend mantiene fallos previos documentados en la revisión general; estas comprobaciones no certifican ausencia de todos los errores.
