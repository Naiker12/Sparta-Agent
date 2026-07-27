# 01 — Arquitectura General de Sparta Agent

> **Documentación Técnica Actualizada del Sistema Modular**  
> **Fecha:** Julio 2026  
> **Estado:** Actualizado a la arquitectura modular (22 paquetes `pnpm workspace`)

---

## 1. Visión General del Sistema

**Sparta Agent** es un IDE agéntico "local-first" y multiplataforma para la orquestación de agentes de IA de alto rendimiento.

Combina:
- **Frontend Modular (React + TypeScript + Vite):** Organizado en 22 paquetes reutilizables bajo `desktop/`.
- **Capa de Aplicación (Electron / Web):** Soporta ejecución local nativa vía Electron (IPC) o ejecución Web ligera (REST/WebSocket).
- **Sidecar de Inteligencia (Python + LangGraph):** Motor agéntico con grafos de decisión, streaming multimodelo y herramientas integradas.
- **Capa de Seguridad Nativa (Rust napi-rs):** Validación de esquemas, sanitización de tool calls y rate limiting a nivel de sistema de archivos y red.

```
   ┌─────────────────────────────────────────────────────────────┐
   │            MODULAR FRONTEND (desktop/* 22 paquetes)          │
   │  ia-sparta-chat | ia-sparta-agents | ia-sparta-terminal ... │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ IPC / WebSocket
   ┌──────────────────────────────▼──────────────────────────────┐
   │                 ELECTRON MAIN / API SERVER                  │
   │           ia-sparta-ipc-bridge | ia-sparta-vault            │
   └──────────────┬───────────────────────────────┬──────────────┘
                  │ stdio JSON-RPC                │ napi-rs
   ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
   │       PYTHON SIDECAR        │ │     RUST SECURITY LAYER      │
   │   (LangGraph + Sidecar)     │ │   (Sanitizer / RateLimit)   │
   └─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Estructura del Proyecto

### 2.1 Paquetes en `desktop/`
El sistema ha sido descompuesto de un directorio monolítico `src/` a 22 módulos desacoplados:

1. **`ia-sparta-app-shell`**: Entry point y orquestador de componentes UI.
2. **`ia-sparta-core`**: Tipos compartidos, constantes e interfaces base.
3. **`ia-sparta-design-system`**: Componentes visuales UI (shadcn, Tailwind, temas).
4. **`ia-sparta-shell-layout`**: Estructura general de navegación y paneles.
5. **`ia-sparta-platform`**: Integración con sistema operativo y archivos.
6. **`ia-sparta-ipc-bridge`**: Transporte IPC tipado entre procesos.
7. **`ia-sparta-chat-ipc`**: Handlers IPC dedicados a mensajería.
8. **`ia-sparta-stream-events`**: Dispatcher y manejador de streaming de eventos LLM.
9. **`ia-sparta-chat`**: Interfaz y lógica principal de conversaciones.
10. **`ia-sparta-agents`**: Gestión de agentes, subagentes y flujos agénticos.
11. **`ia-sparta-terminal`**: Terminal integrada con xterm.js y pty.
12. **`ia-sparta-mcp`**: Cliente/Servidor de Model Context Protocol.
13. **`ia-sparta-memory`**: Memoria vectorial (ChromaDB) y de grafo de conocimiento.
14. **`ia-sparta-permission`**: Control de acceso, confirmaciones y sandboxing.
15. **`ia-sparta-providers`**: Catálogo e integración con proveedores LLM (Cloud/Local).
16. **`ia-sparta-settings`**: Estado global de configuración y preferencias.
17. **`ia-sparta-skills`**: Sistema de habilidades y herramientas dinámicas.
18. **`ia-sparta-channels`**: Integraciones multicanal (Discord, Slack, etc.).
19. **`ia-sparta-projects`**: Gestión de proyectos e indexación de código.
20. **`ia-sparta-tabs`**: Gestión de pestañas y espacios de trabajo.
21. **`ia-sparta-vault`**: Almacén encriptado de llaves y secretos API.
22. **`ia-sparta-i18n`**: Diccionarios y localización multilingüe.

---

## 3. Sidecar Python & LangGraph

Ubicado en `python/sparta_ai/`:
- **Protocolo:** JSON-RPC sobre `stdin` / `stdout`.
- **Motor:** LangGraph StateGraph (nodos: `planner` → `agent` → `tools` → `reflection`).
- **Streaming:** `astream_events` formateados línea a línea para el frontend.
- **Herramientas (Tools):** `file_tools`, `terminal_tools`, `memory_tools`, `skill_tools`, `web_search`, `mcp_tools`.

---

## 4. Capa Novedosa de Seguridad Rust (`napi-rs`)

Módulo nativo `.node` en `rust/sparta-security/`:
- **Sanitización:** Limpieza previa de llamadas a herramientas (URLs, rutas de archivos).
- **Control de Frecuencia:** Rate limiting en invocaciones agénticas y ejecución de comandos.
- **Auditoría:** Registro de eventos sensibles de seguridad.

---

## 5. Mantenimiento y Eliminación de Documentos Legados

Con la adopción de este estándar modular en formato Markdown (`.md`), se establece el plan de migración de la documentación previa en texto plano (`.txt`):
- Los archivos `01-arquitectura.txt` a `17-canales-channels.txt` se consideran **documentación de referencia histórica** y su contenido conceptual ha sido consolidado en los nuevos documentos modulares (`01-arquitectura-general.md`, `23-arquitectura-modular-desktop.md`, `24-arquitectura-modular-web.md`).
