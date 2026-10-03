# Reducción de comentarios redundantes

Se retiraron 430 comentarios decorativos o redundantes: 64 en TypeScript/JavaScript y 366 en Python. También se quitaron dos cabeceras extensas que repetían el propósito de archivos cuyo código ya lo expresa.

Se conservaron explicaciones de permisos, seguridad, concurrencia, reintentos, compatibilidad y decisiones técnicas, además de docstrings útiles, licencias y directivas de herramientas. No se modificaron strings ni reglas de ejecución.

La salida compilada de TypeScript, sin comentarios, se comparó antes y después de cada eliminación automática. En Python se comparó el AST sin posiciones. Ambas comprobaciones verificaron que las eliminaciones no cambian el código ejecutable. Los manifiestos por archivo están en `2026-10-02-redundant-comments-manifest.json` y `2026-10-02-redundant-python-comments-manifest.json`.

La landing compila correctamente. Pasaron 58 pruebas dirigidas del backend y 16 del frontend. Las pruebas de Python se ejecutaron con `--noconftest` por la dependencia faltante de la configuración global ya documentada; no se declara aprobada toda la suite.

Los scripts auxiliares usados en esta operación fueron temporales y se eliminaron al terminar.
