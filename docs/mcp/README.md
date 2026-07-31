# Ecosistema MCP en Sparta Agent — Documentación Técnica (v2)

> **Versión**: 2.0  
> **Fecha**: Julio 2026  
> **Estado**: Planificación y Refactorización  

---

## Estructura de la Documentación

Esta suite de documentación técnica divide el análisis, rediseño y plan de trabajo del protocolo MCP en 5 documentos modulares de responsabilidad única:

| # | Archivo | Descripción | Audiencia |
|---|---|---|---|
| 01 | [01-diagnostico-tecnico.md](01-diagnostico-tecnico.md) | Diagnóstico profundo de las 7 brechas de backend y los 3 bugs de UX identificados. | Backend / Electron |
| 02 | [02-ux-flujo-conexion-mcp.md](02-ux-flujo-conexion-mcp.md) | Rediseño de la UX: estados (Configurado, Autenticado, Conectado) e indicador visual en el Chat. | Frontend / UX / UI |
| 03 | [03-sistema-reglas-permisos-mcp.md](03-sistema-reglas-permisos-mcp.md) | Motor de selección de herramientas por el agente y sistema de permisos `mcpRules`. | Agent Runtime / Seguridad |
| 04 | [04-arquitectura-refactor-codigo.md](04-arquitectura-refactor-codigo.md) | Refactorización modular de `ia-sparta-chat-ipc` (`McpProcessManager`, `JsonStreamSplitter`, etc.). | Backend Architecture |
| 05 | [05-hoja-de-ruta.md](05-hoja-de-ruta.md) | Cronograma secuencial por fases y criterios de aceptación (Definition of Done). | Product Lead / Devs |

---

## Los 3 Problemas Reales del Sistema Actual

1. **No hay ejecución en runtime:** Falta el handler `mcp:call-tool` y un gestor de procesos persistente (`McpProcessManager`) → las tarjetas quedan en **"Desconectado"** y el inspector en **"Sin herramientas"**.
2. **La UX confunde instalación, conexión y autenticación:** Ante errores de entorno como `spawn npx ENOENT`, la app sugiere "Instalar" de forma errónea en lugar de diagnosticar el entorno ($PATH de Node.js).
3. **Falta motor de reglas e indicador visual en Chat:** El agente carece de heurísticas claras para usar o descartar MCPs, y el usuario no ve el bloque de actividad ("MCP Working") en el chat durante las invocaciones.
