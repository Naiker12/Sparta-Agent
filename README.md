<div align="center">
  <img src="public/sparta-icon.png" alt="Sparta Agent" width="100" />
  <h1>Sparta Agent</h1>
  <p><strong>IDE de agentes de IA local-first con arquitectura de tres capas</strong></p>
  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Electron-30-47848F?logo=electron&logoColor=white" />
    <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white" />
    <img src="https://img.shields.io/badge/Rust-1.85-000000?logo=rust&logoColor=white" />
    <img src="https://img.shields.io/badge/LangGraph-LG-FF6F00?logo=langchain&logoColor=white" />
    <img src="https://img.shields.io/badge/license-MIT-green" />
  </p>
</div>

![Sparta Agent](public/readmin.png)

---

## Características

- **Agente con planificación real** — tool call `create_plan` con schema estructurado, sin fugas de JSON a la respuesta visible
- **Terminal Bridge** — el output de comandos se muestra al modelo y al usuario simultáneamente
- **Docker Sandbox** — ejecución de comandos en contenedores efímeros (opcional)
- **Diagnósticos de código** — lint y type-check estructurados (tsc, eslint, ruff, mypy, cargo, go vet, stylelint)
- **Subagentes con tu modelo** — `delegate_code` y `delegate_research` usan el mismo proveedor/configuración que el agente principal
- **Editor sincronizado** — evento `file:changed` para refrescar tabs abiertos tras escritura del agente
- **Múltiples proveedores** — Anthropic, OpenAI, Google Gemini, Ollama, OpenRouter, Groq, DeepSeek, etc.
- **Memoria semántica vectorial** — ChromaDB + embeddings
- **Servidores MCP reales** — SDK oficial `mcp`, stdio + HTTP, catálogo curado
- **Vault cifrado** — API keys almacenadas con `safeStorage` (AES-256-GCM)
- **Tres superficies** — Desktop (Electron), Web (FastAPI), CLI (REPL)
- **13 temas visuales** — 8 oscuros + 5 claros
- **i18n** — Español e Inglés

---

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18, TypeScript, Vite 5, Zustand 5, Tailwind CSS v4, shadcn/ui |
| Desktop | Electron 30, node-pty, safeStorage |
| Editor | Monaco Editor, xterm.js |
| Agente | Python 3.11+, LangGraph, LangChain |
| Memoria | ChromaDB, embeddings (OpenAI / Ollama) |
| Seguridad | Rust (napi-rs), CommandSanitizer, RateLimiter, PermissionPolicy |
| Web | FastAPI, Uvicorn, WebSocket |
| Builder | electron-builder, pnpm |

---

## Seguridad por capas

```
┌────────────────────────────────────────────┐
│  PermissionPolicy (BUILD vs PLAN)          │
│  ├─ BUILD: todas las tools disponibles     │
│  └─ PLAN: solo lectura (read, search, diag)│
├────────────────────────────────────────────┤
│  PermissionBroker (diálogo de confirmación) │
│  ├─ delete_file_tool → SIEMPRE pregunta    │
│  ├─ terminal_execute → si no es seguro     │
│  ├─ write/patch → si autonomy=always_ask   │
│  └─ MCP install, out-of-workspace → siempre│
├────────────────────────────────────────────┤
│  CommandSanitizer (lista negra + blanca)   │
│  ├─ Bloquea: rm -rf /, dd, mkfs, chmod 777│
│  ├─ Bloquea: curl|sh, nmap, nc -lv, etc.   │
│  └─ SAFE_COMMANDS: ls, cat, git status,... │
├────────────────────────────────────────────┤
│  RateLimiter (token bucket)                │
│  ├─ Tools: 30 req/s, 5 refill              │
│  └─ Terminal Web: 15 req/s, 3 refill       │
├────────────────────────────────────────────┤
│  Rust napi module (Desktop)                │
│  ├─ Validación de framing JSON-RPC         │
│  ├─ Rate limiting por sesión               │
│  └─ Auditoría en JSONL                     │
├────────────────────────────────────────────┤
│  PathGuard + Denylist                      │
│  ├─ Bloquea: .., ~, $HOME, %USERPROFILE%   │
│  ├─ Bloquea: .env, .pem, .key, vault.json  │
│  └─ Bloquea: node_modules, .git, .venv     │
└────────────────────────────────────────────┘
```

---

## Inicio rápido

```bash
# 1. Clonar e instalar dependencias
git clone <repo> && cd sparta-agent
pnpm install
pnpm sidecar:setup

# 2. (Opcional) Compilar módulo de seguridad nativo
pnpm rust:napi

# 3. Iniciar desarrollo
pnpm dev
```

Más opciones: [Instalación detallada](#instalación-detallada), [Modo Web](#modo-web), [CLI](#cli).

---

## Requisitos

- Node.js LTS + pnpm
- Python 3.11+
- Rust (solo para módulo nativo)
- Docker (opcional, para sandbox)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (React/Electron/Web)                                  │
│  Chat · Terminal · Editor · Skills · Memoria 3D · Settings         │
│  Zustand stores ↔ IPC (Electron) / WebSocket (Web)                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────────┐
│  ORQUESTACIÓN (Electron Main / FastAPI)                             │
│  ├─ Sidecar Python (stdin/stdout JSON-RPC o WebSocket)              │
│  ├─ Rust napi: validación + rate limiting + auditoría               │
│  └─ Handler IPC: chat, terminal, filesystem, vault, skills, MCP     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────────┐
│  INTELIGENCIA (Python Sidecar)                                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  LangGraph StateGraph                                         │   │
│  │  START → agent → tools/subagent → reflection → agent → END   │   │
│  │  └─ create_plan (tool call, no planner ciego)               │   │
│  │  └─ get_diagnostics_tool (lint/type-check estructurado)      │   │
│  │  └─ get_open_files_tool (sabe qué archivos tenés abiertos)   │   │
│  │  └─ terminal_check_tool (consulta procesos en background)     │   │
│  │  └─ Subagentes en paralelo (asyncio.gather)                   │   │
│  │  └─ Síntesis forzada al llegar al límite de pasos             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Tools: file (read/write/patch/delete/search) · terminal · web      │
│  · memory · MCP · skills · diagnostics · plan                       │
│                                                                      │
│  Seguridad: CommandSanitizer · PermissionPolicy · PathGuard         │
│  · RateLimiter · Vault cifrado                                       │
│                                                                      │
│  Memoria: ChromaDB (vector) + Grafo de conocimiento + Graph Memory  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo del agente

```
Usuario escribe → LLM decide → tool call? → permission gate? → ejecuta → modelo ve resultado
                                                                      │
                                                              ┌───────┴───────┐
                                                              │  ¿siguiente?  │
                                                              └───────┬───────┘
                                                                      │
                                                              sí → vuelve al LLM
                                                                      │
                                                              no → síntesis final
                                                                    (nunca corta en
                                                                     silencio)
```

---

## Tools del agente

| Tool | Descripción | Disponible en PLAN |
|------|------------|-------------------|
| `read_file_tool` | Lee archivos del workspace | ✅ |
| `search_files_tool` | Busca archivos por glob + grep | ✅ |
| `get_diagnostics_tool` | Lint/type-check (tsc, eslint, ruff, mypy, cargo, etc.) | ✅ |
| `get_open_files_tool` | Consulta archivos abiertos en el editor | ✅ |
| `create_plan` | Registra un plan de pasos (tool call, no JSON) | ✅ |
| `terminal_check_tool` | Consulta resultado de procesos en background | ✅ |
| `web_search_tool` | Búsqueda web | ✅ |
| `write_file_tool` | Escribe archivos | ❌ |
| `patch_file_tool` | Edita archivos con diff | ❌ |
| `delete_file_tool` | Elimina archivos (siempre pide permiso) | ❌ |
| `terminal_execute_tool` | Ejecuta comandos en terminal | ❌ |
| `terminal_execute_background_tool` | Ejecuta comandos en background | ❌ |
| `mcp_manage_tool` | Instala/desinstala servidores MCP | ❌ |
| `skill_manage_tool` | Gestiona skills | ❌ |

---

## Instalación detallada

### Desktop

```bash
pnpm install
pnpm sidecar:setup
pnpm rust:napi       # opcional, para módulo de seguridad
pnpm dev             # Vite + Electron + sidecar
```

### Web

```powershell
# Terminal 1
$env:SPARTA_WS_TOKEN = [guid]::NewGuid().ToString()
pnpm sidecar:web

# Terminal 2
pnpm dev:web
```

### CLI

```bash
python -m sparta_ai.cli repl
```

---

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `SPARTA_WS_TOKEN` | Token de autenticación WebSocket (modo Web) |
| `SPARTA_WORKSPACE_ROOT` | Raíz del proyecto (fail-closed si no se define) |
| `SPARTA_DATA_DIR` | Directorio de datos del sidecar |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `OPENAI_API_KEY` | API key de OpenAI |
| `GOOGLE_API_KEY` | API key de Google Gemini |

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Desarrollo Desktop |
| `pnpm dev:web` | Desarrollo Web |
| `pnpm build` | Build producción |
| `pnpm test` | Tests JS |
| `pnpm sidecar:setup` | Instalar dependencias Python |
| `pnpm sidecar:test` | Tests Python |
| `pnpm sidecar:web` | Servidor FastAPI |
| `pnpm rust:napi` | Compilar módulo Rust |
| `pnpm rust:test` | Tests Rust |

---

## Roadmap

### Versión actual

- [x] Agente con planificación vía tool call (`create_plan`)
- [x] Terminal Bridge: output visible al modelo y al usuario
- [x] Docker Sandbox para comandos
- [x] Diagnósticos de código estructurados
- [x] File `:changed` event para sincronizar editor
- [x] Subagentes con el mismo modelo del usuario
- [x] PermissionPolicy BUILD/PLAN
- [x] Síntesis forzada al llegar al límite de pasos
- [x] Turn accumulator (sin duplicación de texto)
- [x] Errores estructurados (`status="error"`)
- [x] get_open_files_tool, terminal_check_tool
- [x] Múltiples proveedores, vault cifrado, memoria semántica
- [x] 13 temas visuales, i18n ES/EN

### Próximos

- [ ] Diff view en Monaco antes de aplicar cambios del agente
- [ ] Terminal Web con PTY real
- [ ] Scrollback persistente
- [ ] Integraciones: Discord, Slack, WhatsApp, Email
- [ ] Auto-learning de memoria
- [ ] CI/CD completo

---

## Licencia

MIT

---

<div align="center">
  <sub>Hecho con disciplina espartana..</sub>
</div>
