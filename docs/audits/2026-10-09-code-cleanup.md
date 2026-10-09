# Revisión de código — 9 de octubre de 2026

## Alcance

Revisión estática de 3.053 archivos de código presentes en Git y archivos nuevos no ignorados. Incluye aplicación, scripts, pruebas y plantillas; excluye dependencias, binarios y compilaciones. La revisión estática no equivale a verificar manualmente todos los flujos de la aplicación.

ESLint revisó 1.254 archivos del frontend y puente de Electron, sin errores ni advertencias con las reglas actuales. Estas reglas desactivan algunas comprobaciones, incluyendo dependencias de hooks y tipos `any`, por lo que no certifican la ausencia de problemas. El análisis AST de Python no encontró errores de sintaxis.

## Correcciones

- Eliminada la lista fija de agentes ficticios del panel de trabajo. Ahora muestra que no hay datos de agentes conectados.
- Eliminada la página ficticia “MiSitio” de la vista web. Se conserva la vista de artefactos reales; cuando no hay artefacto se carga la URL HTTP/HTTPS seleccionada. Las URLs no compatibles muestran el estado vacío. El indicador de recarga espera el evento real del iframe, en lugar de un temporizador ficticio.
- Eliminadas las primeras definiciones de `_tombstone_chat_threads` y `_active_research_run_ids`, y una copia de `_ACTIVE_RESEARCH_RUN_STATUSES`, en `desktop/backend-spartan/storage/studio/chat_threads.py`. Se comparó su AST para comprobar que las copias eran idénticas.
- Eliminados comentarios de JSX que solo repetían el nombre del bloque y un hook de traducción duplicado en el visor de diferencias.
- Aplicado el formato existente del proyecto a ocho archivos de carpetas, proyectos y revisión Git.

Los comentarios que explican permisos, concurrencia, compatibilidad o decisiones de almacenamiento se conservan. Los ejemplos de uso de API en Ajustes, las plantillas de habilidades y las pruebas de regresión tienen un propósito real y no son datos ficticios de la aplicación.

## Refactorizaciones que siguen pendientes

El tamaño por sí solo no demuestra un error, pero estos archivos concentran mucha lógica y requieren una revisión funcional y una separación gradual de responsabilidades:

| Archivo | Líneas al iniciar la revisión |
| --- | ---: |
| `desktop/backend-spartan/routes/inference.py` | 15.181 |
| `desktop/backend-spartan/core/inference/tools.py` | 14.029 |
| `desktop/backend-spartan/core/inference/external_provider.py` | 6.699 |
| `desktop/backend-spartan/core/training/worker.py` | 5.392 |
| `desktop/frontend-spartan/src/features/model-picker/components/model-selector/pickers.tsx` | 4.893 |
| `desktop/frontend-spartan/src/features/chat/stores/chat-runtime-store.ts` | 4.851 |

Algunos sitios externos impiden mostrarse en un iframe mediante sus propias cabeceras; la vista web no elimina esa restricción.

## Validación

- TypeScript e igualdad de claves de traducción: correctos después de la limpieza de interfaz.
- ESLint global: sin errores ni advertencias. Cinco pruebas relevantes de eliminación y almacenamiento de chats: correctas.

El inventario detallado por archivo se guardó fuera del repositorio, en la carpeta temporal del sistema, para no añadir miles de líneas de datos generados al código del proyecto.
