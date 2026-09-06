# Clasificación de suites

Snapshot de la ejecución local completa del frontend: **3487 resultados, 3312 aprobados y 175 fallidos**. Los fallos de carga de un archivo cuentan como un resultado, no como sus casos internos.

Cada fallo tiene clasificación y evidencia en [suite-classification.json](./suite-classification.json). Clasificar no significa corregir: las aserciones estáticas no demuestran por sí solas una regresión del producto y las diferencias de comportamiento requieren confirmar el requisito. No se desactivó ni eliminó ninguna prueba.

| Categoría | Resultados |
|---|---:|
| Entorno o fixture incompleto | 9 |
| Contrato retirado: idiomas distintos de EN/ES | 25 |
| Archivo o export ausente tras la migración | 29 |
| Aserción estática sobre una ubicación antigua | 46 |
| Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento | 66 |
| Diferencia de comportamiento: validar el requisito vigente | 0 |

## Archivos afectados

| Archivo | Fallos | Clasificación |
|---|---:|---|
| action-menu-modal-layer.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| audio-page-policy.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| audio-picker-policy.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| auto-load-cpu-fallback-toast.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| auto-load-cpu-fallback-toast.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| chat-adapter-scan-cost.test.ts | 3 | Aserción estática sobre una ubicación antigua |
| chat-adapter-scan-cost.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| chat-only-route-guard.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| chat-remembers-its-model.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| chat-stream-publish-gate.test.ts | 11 | Aserción estática sobre una ubicación antigua |
| chat-stream-publish-gate.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| code-tool-placement.test.ts | 2 | Aserción estática sobre una ubicación antigua |
| composer-keystroke-subscription-budget.test.ts | 2 | Aserción estática sobre una ubicación antigua |
| connections-empty-opens-form.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| copy-to-clipboard.test.ts | 9 | Entorno o fixture incompleto |
| dataset-data-recipes-navigation.test.ts | 1 | Archivo o export ausente tras la migración |
| delete-chat-files-preference.test.ts | 3 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| delete-chat-files-preference.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| desktop-closing-overlay.test.ts | 2 | Archivo o export ausente tras la migración |
| desktop-closing-overlay.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| external-model-selection-label.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| external-model-selection-label.test.ts | 1 | Archivo o export ausente tras la migración |
| fork-count-batching.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| hosted-image-tool-with-studio-tools.test.ts | 2 | Aserción estática sobre una ubicación antigua |
| keyboard-shortcuts.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| lazy-locale-loading.test.ts | 25 | Contrato retirado: idiomas distintos de EN/ES |
| linked-folders-lease-gate.test.ts | 1 | Archivo o export ausente tras la migración |
| llama-extra-args-diagnostics.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| llama-extra-args-panel-hydration.test.ts | 3 | Aserción estática sobre una ubicación antigua |
| llama-extra-args-panel-hydration.test.ts | 5 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| loaded-build-panel-rows.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| loaded-models-backcompat.test.ts | 1 | Archivo o export ausente tras la migración |
| loaded-models-platform-matrix.test.ts | 1 | Archivo o export ausente tras la migración |
| loaded-models-sources.test.ts | 1 | Archivo o export ausente tras la migración |
| mac-titlebar-optical-alignment.test.ts | 1 | Archivo o export ausente tras la migración |
| media-eject-busy-state.test.ts | 1 | Archivo o export ausente tras la migración |
| media-generation-preset-claims.test.ts | 1 | Archivo o export ausente tras la migración |
| media-idle-unload-api-only.test.ts | 1 | Archivo o export ausente tras la migración |
| media-load-cancel.test.ts | 1 | Archivo o export ausente tras la migración |
| media-status-sequencing.test.ts | 2 | Archivo o export ausente tras la migración |
| mmproj-fallback.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| native-drop-targets.test.ts | 1 | Archivo o export ausente tras la migración |
| padded-response.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| per-model-params-hydration.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| pr9057-video-simulation.test.ts | 1 | Archivo o export ausente tras la migración |
| preserve-thinking-user-preference.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| project-attachment-target-adoption.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| project-attachment-target-adoption.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| project-source-reply-destination.test.ts | 3 | Aserción estática sobre una ubicación antigua |
| project-source-reply-destination.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| project-source-reply-markdown.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| provider-max-output-tokens.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| provisional-hardware-verdict.test.ts | 3 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| provisional-hardware-verdict.test.ts | 1 | Archivo o export ausente tras la migración |
| qwen-thinking-size-gate.test.ts | 1 | Archivo o export ausente tras la migración |
| rag-availability-marker.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| rag-refresh-sequencing.test.ts | 3 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| rag-refresh-sequencing.test.ts | 2 | Aserción estática sobre una ubicación antigua |
| read-aloud-tts-model-row.test.ts | 1 | Archivo o export ausente tras la migración |
| research-render-budget.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sandbox-reveal-path.test.ts | 2 | Aserción estática sobre una ubicación antigua |
| sandbox-reveal-path.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| settings-finetune-action-loading.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| settings-panel-prefs.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| settings-search.test.ts | 1 | Archivo o export ausente tras la migración |
| sidebar-action-rows-inert.test.ts | 4 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-nav-backend-parity.test.ts | 2 | Archivo o export ausente tras la migración |
| sidebar-nav-migration.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-scroll-fade-deps.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-selection-coverage.test.ts | 4 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-spinner-column.test.ts | 4 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-touch-reorder.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| sidebar-unread-dot.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| tauri-details-toggle.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| thread-delete-render-budget.test.ts | 3 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| thread-part-components-stable.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| thread-scoped-pairing-invariants.test.ts | 5 | Aserción estática sobre una ubicación antigua |
| thread-scoped-pairing-invariants.test.ts | 2 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| trailing-placeholder-prefix-safety.test.ts | 1 | Aserción estática sobre una ubicación antigua |
| update-banner-flex-priority.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| verdict-poll-stall-guard.test.ts | 1 | Archivo o export ausente tras la migración |
| video-capability-plumbing.test.ts | 1 | Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento |
| video-download-plan-payload.test.ts | 1 | Archivo o export ausente tras la migración |
| video-gallery-clear-confirmation.test.ts | 1 | Archivo o export ausente tras la migración |
| video-generate-refusal-resync.test.ts | 1 | Archivo o export ausente tras la migración |
| video-h3-task-dialog.test.ts | 1 | Archivo o export ausente tras la migración |
| video-keyframe-canvas.test.ts | 1 | Archivo o export ausente tras la migración |

## Backend

23462 tests collected, 224 errors in 52.30s. Se intentó la colección completa con las dependencias del perfil CPU de autenticación. Los imports requieren otros perfiles; no se interpreta como ejecución ni aprobación de esas pruebas. Las causas por módulo están en el JSON.

## Criterios para corregir

- Fixtures: representar el entorno real; no relajar las aserciones funcionales.
- Idiomas: reescribir los casos de carga/cancelación/fallback alrededor de los catálogos EN/ES vigentes, conservando los escenarios.
- Archivos y exports: seguir la implementación nueva. No restaurar módulos retirados solo para satisfacer un import.
- Aserciones estáticas: mover la comprobación al módulo propietario y reemplazarla por comportamiento observable cuando sea posible.
- Diferencias de producto: registrar una decisión antes de cambiar una expectativa.
- Backend: separar perfiles de autenticación/CPU, inferencia y pruebas con servidor/modelos; no instalar ni descargar modelos durante la colección.
