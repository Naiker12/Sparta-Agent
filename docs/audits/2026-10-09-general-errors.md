# Revisión general de errores — 9 de octubre de 2026

Revisión sobre `main` en `b961f441`, con correcciones locales en `fix/revision-general-errores`. Se conservó la modificación que ya existía en la prueba del mensaje de video. No se publicaron commits ni se integraron cambios.

## Resultado

El problema confirmado más amplio es la desactualización de la suite de regresión del frontend respecto a la refactorización y la distribución actual basada en proveedores API. La ejecución inicial produjo 3.221 pruebas aprobadas y 289 fallidas en 114 archivos. Estos resultados no equivalen a 289 errores funcionales: incluyen archivos inexistentes, imports retirados y comprobaciones del texto del código que dejaron de reconocer implementaciones válidas.

La suite principal de Vitest pasó después de corregir el tiempo permitido para las pruebas con procesos Git. Los contratos del backend comprobados pasaron. No se realizó una validación manual de todos los flujos de Electron ni una compilación del instalador; por tanto, esta revisión no certifica que toda la aplicación esté libre de errores.

La repetición completa después de las correcciones produjo **3.234 aprobadas y 280 fallidas, de 3.514 pruebas**. Se resolvieron nueve fallos de la ejecución inicial; corregir el import del catálogo también permitió ejecutar cinco pruebas antes bloqueadas por ese import. No se excluyeron pruebas de la ejecución para reducir la cifra.

## Hallazgos y prioridad

1. **P1 — La suite completa del frontend sigue fallando.** `.github/workflows/ci.yml` ejecuta esa suite, así que los fallos afectan la comprobación de PR. Ejemplos: `chat-local-model-options.test.ts` importa un módulo inexistente; pruebas de exportación, imágenes, video y Tauri buscan módulos retirados. El log inicial contiene nueve errores de resolución de módulos y 32 errores de archivos inexistentes. Antes de retirar una prueba hay que confirmar que su función fue eliminada; las pruebas de funciones vigentes deben migrarse a sus ubicaciones y contratos actuales.
2. **P2 — Pruebas de integración Git demasiado cortas en Windows, corregido.** Tres pruebas agotaron el límite predeterminado de cinco segundos y la limpieza chocó con procesos que todavía usaban la carpeta. Las cinco pruebas de Git pasaron con un límite adecuado; se configuró un límite de 60 segundos solo para ese grupo y reintentos acotados de limpieza. La suite principal completa pasó después del cambio.
3. **P2 — Comprobaciones de funciones actuales desactualizadas, corregido.** La prueba de menú inspeccionaba `thread.tsx`, pero el menú está en `thread/assistant-action-bar.tsx` y conserva `modal={false}`. La búsqueda de ajustes importaba el catálogo antiguo `locales/en.ts`, en lugar de `locales/en/index.ts`. Las pruebas de archivos de chats usaban acciones de archivos multimedia ya eliminadas. Las preferencias esperaban `train`, aunque el contrato actual admite `recipes` y `export`. La prueba de permisos de artefactos confundía diferencias de formato con una política incorrecta. La prueba de capacidades de video interpretaba una propiedad de interfaz como una asignación de capacidades y no normalizaba los separadores de Windows.
4. **Pendiente — Fallos que requieren revisión funcional específica.** Permanecen grupos de pruebas de traducciones diferidas, actualización de documentos RAG, publicación del stream, persistencia de colas y emparejamiento de ajustes por chat. La revisión general detectó estos fallos, pero todavía no confirmó su causa individual. No se deben desactivar en bloque para obtener una ejecución verde.

La retirada del runtime local está documentada en `tests/test_api_only_contract.py`: comprueba que `/api/inference/chat` rechaza la ejecución local y exige un proveedor remoto. `core/inference/llama_cpp.py` es actualmente un módulo de compatibilidad con el runtime desactivado. Por ello, los fallos de pruebas del antiguo comportamiento Vulkan/GPU no se trataron como errores de ejecución local que deban restaurarse.

## Validación

| Comprobación | Resultado |
| --- | --- |
| TypeScript, antes de las correcciones | Correcto |
| TypeScript, repetido después de las correcciones | Correcto |
| ESLint global | Correcto con las reglas actuales |
| Igualdad de claves de traducción | Correcto |
| Sintaxis Python de archivos versionados | 1.209 archivos; ningún error de sintaxis |
| Suite principal Vitest, después de corregir Git | 83 aprobadas en 19 archivos |
| Regresiones relacionadas con las correcciones del frontend | 51 aprobadas; ninguna fallida |
| Suite completa del frontend, después de las correcciones | 3.234 aprobadas; 280 fallidas |
| Backend: autenticación, rotación de credenciales, distribución API, documentos, carpetas, canales y errores de entrega Telegram | 301 aprobadas; 2 omitidas |

Para ejecutar el backend se creó un entorno aislado `.venv-review` con las dependencias de pruebas de CI. Las dos pruebas omitidas permanecieron omitidas; no se cuentan como aprobadas. El entorno emitió una advertencia de compatibilidad de Starlette/TestClient con `httpx`, sin fallar las pruebas.

Los logs completos y el inventario de fallos se conservaron en `C:/Users/gomez/AppData/Local/Temp/sparta-general-review-20261009`, fuera del código versionado.

## Orden de trabajo recomendado

Primero actualizar el inventario de pruebas para la distribución API y migrar las comprobaciones de funciones activas. Después reproducir por separado los fallos de RAG, colas y ajustes por chat con pruebas de comportamiento. Finalmente comprobar manualmente en Electron conexión de proveedores, envío y cancelación, generación y descarga de documentos, carpetas de proyectos, revisión Git y vista de artefactos.
