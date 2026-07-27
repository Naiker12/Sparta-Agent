# 23 — Arquitectura Modular Desktop (Sparta Agent)

> **Fase 1 del rediseño estructural (Completada).**  
> Descomposición de la aplicación monolítica React/Electron en una arquitectura modular basada en paquetes aislados (`pnpm workspace`).

---

## 1. Visión General

Sparta Agent Desktop ha sido migrado de una estructura monolítica (`src/`) a un **monorepo modular** con 22 paquetes independientes ubicados en `desktop/`. Cada paquete posee sus propias responsabilidades, dependencias explícitas e interfaces tipadas.

---

## 2. Mapa de Paquetes Modular (`desktop/`)

```
desktop/
├── ia-sparta-app-shell        # Punto de entrada de la aplicación Electron/React Shell
├── ia-sparta-core             # Utilidades base, tipos globales y constantes del sistema
├── ia-sparta-design-system    # Componentes UI reutilizables (shadcn/ui, temas, primitivas)
├── ia-sparta-shell-layout     # Layout principal (Sidebar, Header, Paneles de navegación)
├── ia-sparta-platform         # Adaptadores de plataforma (Filesystem, OS, Native integration)
├── ia-sparta-ipc-bridge       # Capa de transporte IPC entre Electron Main y Renderer
├── ia-sparta-chat-ipc         # Handlers IPC específicos para mensajería y streaming LLM
├── ia-sparta-stream-events    # Manejo de eventos en tiempo real, parsers y reducers de eventos
├── ia-sparta-chat             # Módulo UI de Chat (Composer, MessageList, Thinking/Reasoning)
├── ia-sparta-agents           # Orquestación de Agentes, Subagentes y Grafos LangGraph
├── ia-sparta-terminal         # Integración de Terminal interactiva (xterm.js + node-pty)
├── ia-sparta-mcp              # Cliente y servidor MCP (Model Context Protocol)
├── ia-sparta-memory           # Sistema de Memoria a largo plazo (Vectorial + Grafos)
├── ia-sparta-permission       # Sistema de Permisos, Aislamiento y Confirmaciones del usuario
├── ia-sparta-providers        # Conectores y catálogo de proveedores AI (Cloud + Local)
├── ia-sparta-settings         # Gestión de Configuración, Preferencias y Estado Persistente
├── ia-sparta-skills           # Registro, ejecución e inyección de Skills (.agents/skills)
├── ia-sparta-channels         # Integración de Canales externos (Telegram, Discord, Slack, Webhooks)
├── ia-sparta-projects         # Gestión de proyectos, workspaces e indexación de archivos
├── ia-sparta-tabs             # Sistema de pestañas y estado multiventana/multitarea
├── ia-sparta-vault            # Almacenamiento seguro de secretos y llaves API (SafeStorage)
└── ia-sparta-i18n             # Internacionalización y diccionarios multilingüe
```

---

## 3. Beneficios de la Arquitectura Modular

1. **Aislamiento de Responsabilidades:** Cambios en la UI (`design-system` o `chat`) no impactan de forma imprevista la capa de streaming (`stream-events`) o seguridad (`vault`).
2. **Reusabilidad Cross-Platform:** Los paquetes puros (`core`, `design-system`, `providers`, `mcp`, `skills`) son reutilizables directamente en la versión Web y CLI sin depender de Electron.
3. **Builds y Tests Incrementales:** Permite compilar y auditar componentes aislados con `pnpm --filter`.
4. **Mantenibilidad a Largo Plazo:** Previene archivos monolíticos masivos y acoplamiento excesivo.

---

## 4. Matriz de Inserción en pnpm Workspaces

Definido en `pnpm-workspace.yaml`:

```yaml
packages:
  - 'landing'
  - 'desktop/ia-sparta-app-shell'
  - 'desktop/ia-sparta-ipc-bridge'
  - 'desktop/ia-sparta-chat-ipc'
  - 'desktop/ia-sparta-vault'
  - 'desktop/ia-sparta-stream-events'
  - 'desktop/ia-sparta-chat'
  - 'desktop/ia-sparta-agents'
  - 'desktop/ia-sparta-terminal'
  - 'desktop/ia-sparta-mcp'
  - 'desktop/ia-sparta-memory'
  - 'desktop/ia-sparta-permission'
  - 'desktop/ia-sparta-providers'
  - 'desktop/ia-sparta-settings'
  - 'desktop/ia-sparta-skills'
  - 'desktop/ia-sparta-channels'
  - 'desktop/ia-sparta-projects'
  - 'desktop/ia-sparta-shell-layout'
  - 'desktop/ia-sparta-design-system'
  - 'desktop/ia-sparta-i18n'
  - 'desktop/ia-sparta-core'
  - 'desktop/ia-sparta-platform'
  - 'desktop/ia-sparta-tabs'
```

---

## 5. Estado y Relación con Fase 2 (Web AI)

- **Fase 1 (Desktop):** Finalizada. Los 22 paquetes funcionan en entorno Electron / PNPM Workspace.
- **Fase 2 (Web):** Documentada en `docs/24-arquitectura-modular-web.md`. Reutiliza los módulos puros sustituyendo la capa IPC de Electron por API Server (REST/WebSocket).
