/**
 * Sparta Agent - Chat API Barrel
 * Re-exporta de forma centralizada todas las APIs de Chat modularizadas:
 * - base: Utilidades de petición, errores y eventos de sincronización.
 * - threads: Gestión y ciclo de vida de conversaciones/hilos.
 * - messages: Persistencia, streaming y recuperación de mensajes.
 * - projects: Espacios de trabajo y proyectos.
 * - models: Gestión de modelos locales, GGUFs y descargas.
 * - inference: Monitorización, cómputo de tokens y confirmaciones.
 * - attachments: Gestión de adjuntos en mensajes.
 * - workspaces: Vinculación de carpetas de trabajo con hilos.
 */

export * from "./modules/base";
export * from "./modules/threads-api";
export * from "./modules/messages-api";
export * from "./modules/projects-api";
export * from "./modules/models-api";
export * from "./modules/inference-api";
export * from "./modules/attachments-api";
export * from "./modules/workspaces-api";
