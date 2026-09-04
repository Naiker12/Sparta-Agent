/**
 * Sparta Agent - Chat Adapter Barrel
 * Re-exporta todos los submódulos modulares del adaptador de chat:
 * - autosave-handle: Gestión del guardado en background.
 * - context-limits: Detección de límites de tokens y URLs seguras.
 * - tool-args-parser: Parser incremental de argumentos de herramientas.
 * - tool-results: Formateo y desempaquetado de respuestas MCP y sandbox.
 * - multimodal-detection: Detección y extracción de imágenes, audio y video.
 * - token-counting: Cómputo de tokens y resolución de proyecto.
 * - stream-timing: Cálculo de tiempos, tokens/segundo y estadísticas.
 * - message-serialization: Serialización de mensajes y herramientas al formato OpenAI.
 * - prompt-assembly: Ensamblado de prompts, directivas de sistema, idioma y workspaces.
 * - auto-load: Máquina de estados de autocarga y resolución de modelos vacíos.
 * - model-autoload-selection: Prioridad de autocarga de modelos.
 * - replay-content: Reconstrucción de historial y reasoning.
 * - system-prompt: Inyección de variables temporales en el system prompt.
 * - stream-orchestrator: Bucle asíncrono SSE del adaptador (@assistant-ui/react) y eventos de herramientas.
 */

export * from "./autosave-handle";
export * from "./context-limits";
export * from "./tool-args-parser";
export * from "./tool-results";
export * from "./multimodal-detection";
export * from "./token-counting";
export * from "./stream-timing";
export * from "./message-serialization";
export * from "./prompt-assembly";
export * from "./auto-load";
export * from "./model-autoload-selection";
export * from "./replay-content";
export * from "./system-prompt";
export * from "./stream-orchestrator";
