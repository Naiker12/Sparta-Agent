# Limpieza de archivos y comentarios heredados

## Resultado

Se eliminaron 124 archivos de código sin imports entrantes ni referencias de ruta detectadas en código, pruebas, MDX, HTML o configuración. La limpieza se repitió hasta que dejó de encontrar nuevos candidatos eliminables.

Incluye componentes, hooks y utilidades desconectados del escritorio y la documentación antigua de la landing, sustituida por las páginas MDX actuales. No se utilizaron como criterio de borrado la antigüedad, el nombre del archivo ni una coincidencia de marca.

Se hicieron 1.397 operaciones de limpieza de comentarios y docstrings: 183 en TypeScript/JavaScript/CSS, 1.050 en Python y 164 en cabeceras de configuración. Se utilizaron AST y tokens para distinguir comentarios de strings ejecutables. Los cambios de Python se analizaron sintácticamente antes de guardarse.

## Elementos conservados

- Entradas de Electron, archivos de tipos, comprobadores invocados por scripts y archivos utilizados por pruebas.
- Imports, variables de entorno, claves de sesión, identificadores de modelos, URLs y selectores CSS funcionales. Su migración requiere cambiar todos los consumidores, no borrar texto.
- Avisos de copyright y licencia.
- Código de terceros, dependencias instaladas, datos de usuario y secretos.

No se afirma que todo archivo conservado participe en la interfaz actual: algunos mantienen contratos o pruebas. El análisis es estático y conservador; no demuestra por sí solo ausencia de usos externos.

## Manifiesto

El manifiesto acumulado de borrados está en `docs/audits/2026-10-02-source-cleanup-manifest.json`. Los scripts temporales utilizados para esta limpieza se retiraron al terminar la auditoría; no forman parte de la aplicación.

## Verificación

- Compilaciones de producción del frontend del escritorio y la landing correctas.
- Comprobación de tipos del escritorio y del shell de Electron correcta.
- 63 pruebas dirigidas del backend aprobadas, ejecutadas con `--noconftest` por la dependencia faltante de la configuración global.
- 20 pruebas del contrato API-only y autenticación del shell aprobadas.
- 135 pruebas seleccionadas del frontend aprobadas después de la limpieza.

Una revisión ampliada del frontend dio 160 aprobadas y 6 fallidas. Los fallos corresponden a pruebas estructurales de code-tool-placement, gallery-item-menu-visibility, loaded-models-surface y native-drop-targets. Esperan estructuras de código distintas, un archivo de imágenes ausente, una implementación antigua del drop de imágenes o un archivo Rust ausente. No se modificaron los contratos de ejecución para satisfacer esas expectativas heredadas. No se declara aprobada toda la suite ni una prueba completa de Electron con proveedor real.
