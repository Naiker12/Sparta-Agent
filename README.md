<div align="center">
  <img src="public/sparta-icon.png" alt="Sparta Agent" width="80" />
  <h1>Sparta Agent</h1>
  <p><strong>IDE de agentes de IA local-first</strong></p>
  <p>
    React + TypeScript + Vite + Electron
  </p>
</div>

![Sparta Agent Screenshot](public/readmin.png)

---

## Objetivo

**Sparta Agent** es un IDE de agentes de IA local-first que orquesta agentes de lenguaje desde el escritorio, el navegador o la terminal. Combina chat unificado, sistema de agentes real con subagentes y ejecución paralela, memoria semántica vectorial (ChromaDB), grafo 3D de conocimiento, servidores MCP, skills reutilizables, canales de comunicación y 13 temas visuales.

Cuenta con un **sidecar Python** (LangGraph + ChromaDB) para la capa de IA y un **módulo nativo Rust** (napi-rs) para validación de mensajes y auditoría en el proceso de Electron.

---

## Características principales

- **Chat unificado** con sesiones persistentes, pin, archive y rename.
- **Sistema de agentes real** con loop LLM→tools→subagentes y ejecución paralela.
- **Sidecar Python** (LangGraph + ChromaDB) para la capa de IA con streaming vía stdio JSON-RPC (Desktop) o WebSocket (Web).
- **Terminal en 3 superficies**: Desktop (PTY real vía node-pty), Web (shell vía WebSocket al sidecar) y CLI (REPL propio con Typer + Rich, `sparta chat` desde la terminal del sistema). El terminal persiste entre vistas de la app (no se destruye al navegar a Skills/MCP/Memoria).
  > ⚠️ El modo Web del terminal está en integración: el endpoint `/ws/terminal` todavía necesita el paso de autenticación y sanitización de comandos antes de considerarse listo para exponerse fuera de `localhost`. Ver `docs/`.
- **Módulo de seguridad Rust** (napi-rs, sólo Desktop): validador de framing de mensajes JSON-RPC entre Electron y el sidecar Python, con log de auditoría. La sanitización y el rate limiting de tool calls y comandos de shell los aplica hoy el propio sidecar Python (`CommandSanitizer` / `RateLimiter`), no el módulo Rust — éste valida el transporte, no gatea la ejecución.
- **Memoria semántica vectorial** con ChromaDB y embeddings vía OpenAI / Ollama.
- **Grafo 3D de conocimiento** interactivo (Three.js) con extracción automática de entidades y relaciones.
- **Skills reutilizables** con explorador, creador y exportador a `.skill.json`.
- **Servidores MCP** con listado de conectados y marketplace de servidores populares.
- **Canales de comunicación** internos e integraciones (Telegram funcional, Discord/Slack/WhatsApp/Email planeados).
- **Proveedores de modelos** con test connection real y fetch de modelos disponibles.
- **Vault cifrado** para API keys con safeStorage de Electron (AES-256-GCM).
- **Editor de código** con Monaco Editor (9 lenguajes, file tree, toolbar).
- **13 temas visuales** (8 oscuros + 5 claros) con selección visual.
- **Internacionalización** español / inglés.
- **Iconos de marca** con detección automática de tema claro/oscuro.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| UI Framework | React 18 + TypeScript |
| Bundler | Vite 5 |
| Desktop Shell | Electron 30 |
| State Management | Zustand 5 (persist middleware) |
| UI Library | shadcn/ui + @base-ui/react |
| Estilos | Tailwind CSS v4 |
| Animaciones | Framer Motion |
| Grafo 3D | three.js 0.184 (lazy-loaded) |
| Editor Código | Monaco Editor |
| Terminal | xterm.js — node-pty en Desktop, WebSocket a FastAPI en Web, Typer+Rich en CLI |
| AI Sidecar | Python 3.11+ / LangGraph / LangChain / ChromaDB / FastAPI (modo Web) |
| Security Layer | Rust / napi-rs (validador de framing + auditoría, Desktop) · Python (`CommandSanitizer`, `RateLimiter`, Web/CLI) |
| Vector DB | ChromaDB (HTTP directo) |
| Vault | Electron safeStorage (AES-256-GCM) |
| Iconos | Lucide React + SVGs propios |
| Fuentes | Inter, Space Grotesk, Geist Variable |
| Tests JS | vitest (59 tests) |
| Tests Python | pytest (32 tests) |
| Tests Rust | cargo test (9 tests) |
| Package Manager | pnpm |
| Builder | electron-builder |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) (versión LTS recomendada)
- [pnpm](https://pnpm.io/)
- [Python](https://www.python.org/) 3.11+ (para el sidecar de IA)
- [Rust](https://www.rust-lang.org/) (para el módulo de seguridad nativo, opcional para desarrollo)

Instalar pnpm si no lo tienes:

```bash
npm install -g pnpm
```

---

## Instalación

1. Clonar o ubicarse en el directorio del proyecto:

```bash
cd sparta-agent
```

2. Instalar dependencias:

```bash
pnpm install
```

3. Configurar el sidecar Python:

```bash
pnpm sidecar:setup
```

4. (Opcional) Compilar el módulo de seguridad Rust:

```bash
pnpm rust:napi
```

5. Iniciar el entorno de desarrollo:

```bash
pnpm dev
```

Esto levanta el servidor de Vite, lanza Electron e inicia el sidecar Python automáticamente.

### Usar el CLI

```bash
python -m sparta_ai.cli chat
```

Abre un REPL en la terminal del sistema contra el mismo agente LangGraph que usan Desktop y Web, con historial persistente en `~/.sparta_cli_history`.

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia Vite + Electron + sidecar Python en modo desarrollo |
| `pnpm build` | Compila TypeScript, build Vite y empaqueta con electron-builder |
| `pnpm test` | Ejecuta tests JS (vitest, 59 tests) |
| `pnpm lint` | Ejecuta ESLint sobre `.ts` y `.tsx` |
| `pnpm preview` | Previsualiza el build de Vite |
| `pnpm sidecar:setup` | Crea venv Python e instala dependencias del sidecar |
| `pnpm sidecar:test` | Ejecuta tests Python (pytest, 32 tests) |
| `pnpm sidecar:run` | Ejecuta el sidecar manualmente (stdin/stdout) |
| `pnpm rust:test` | Ejecuta tests Rust (cargo test, 9 tests) |
| `pnpm rust:build` | Compila el módulo Rust en modo release |
| `pnpm rust:napi` | Compila el native addon N-API de Rust |

---

## Estructura del proyecto

```
sparta-agent/
├── electron/           # Proceso principal + handlers IPC
├── public/             # Assets estáticos, iconos, skills
├── src/                # Código fuente React + TypeScript
│   ├── components/     # Componentes React (incluye terminal/: TerminalSlot,
│   │                   #   PersistentTerminal, TerminalWorkspace)
│   ├── hooks/          # Hooks personalizados
│   ├── i18n/           # Internacionalización ES/EN
│   ├── lib/            # Utilidades, fetch de modelos, xterm-theme, terminal-ws-driver
│   ├── services/       # Capa de servicios (AI, memory, agents, chat, MCP)
│   ├── stores/         # Stores Zustand (con persist)
│   ├── styles/         # CSS global + 13 temas visuales
│   └── types/          # Definiciones de TypeScript
├── python/
│   └── sparta_ai/      # Sidecar Python: LangGraph, ChromaDB, agentes
│       ├── agents/     # StateGraph + subagentes (research, code, memory)
│       ├── tools/      # web_search, file_tools, memory_tools, terminal_tools, mcp_bridge
│       ├── security/   # CommandSanitizer, RateLimiter (gatean ejecución real de shell)
│       ├── memory/     # ChromaDB VectorStore + grafo de conocimiento
│       ├── streaming/  # Event bridge LangGraph → JSON-RPC / WebSocket
│       ├── cli.py      # REPL de terminal (Typer + Rich)
│       ├── server_web.py # Servidor FastAPI para modo Web (chat + terminal)
│       └── tests/      # 32 tests Python (pytest)
├── rust/
│   └── sparta-security/ # Validador de framing JSON-RPC + auditoría (Desktop, napi-rs)
│       └── src/        # validator, sanitizer (no conectado a ejecución de tools), guard, audit
├── docs/               # Documentación técnica
├── package.json
├── vite.config.ts
└── README.md
```

---

## Uso rápido

1. Abre la aplicación con `pnpm dev` (el sidecar Python se inicia automáticamente).
2. Configura un proveedor de modelo desde **Configuración → Models** e ingresa tu API key (se cifra en el vault).
3. Crea una nueva sesión desde el sidebar y empieza a chatear.
4. Usa el panel de **Agentes** para ejecutar tareas complejas con subagentes.
5. Activa la **memoria semántica** desde Configuración → Memory para búsqueda contextual.
6. Explora las vistas de **Skills**, **MCP**, **Canales**, **Memoria** y **Editor** desde la barra lateral.
7. Abre el **Terminal** desde la barra inferior — la misma sesión sigue viva aunque navegues a otras vistas.

---

## Roadmap / Pendientes

- [x] Chat conectado con APIs reales (Anthropic, OpenAI, Ollama)
- [x] Monaco Editor integrado con 9 lenguajes
- [x] Terminal Desktop con PTY real (node-pty + PowerShell/bash), persistente entre vistas
- [x] Terminal Web (WebSocket al sidecar) y Terminal CLI (REPL Typer + Rich)
- [x] Sistema de agentes real con subagentes y ejecución paralela
- [x] Sidecar Python con LangGraph, ChromaDB, streaming JSON-RPC / WebSocket
- [x] Módulo Rust de validación de framing JSON-RPC + auditoría
- [x] Vault cifrado para API keys con safeStorage de Electron
- [x] Memoria semántica vectorial con ChromaDB + embeddings
- [x] Lazy loading de Three.js y vistas pesadas
- [x] Thinking block, tool calls, interrupt-and-redirect
- [ ] Endurecer `/ws/terminal` (token de auth, sanitizar input por línea, bind a `127.0.0.1` por defecto)
- [ ] Rate limiter Rust persistente entre llamadas napi (hoy se reinicia en cada invocación)
- [ ] Terminal Web con pty real (hoy usa pipes: sin job control, programas interactivos como `vim`/`htop` no redibujan bien)
- [ ] Adjuntos reales (archivos, snippets, imágenes, URLs)
- [ ] Grabación de audio por micrófono
- [ ] Integraciones reales de Discord, Slack, WhatsApp y Email
- [ ] Conexión real a servidores MCP (stdio/http)
- [ ] Auto-learning de la memoria
- [ ] Tests y CI/CD completo

---

## Licencia

MIT — Uso libre bajo los términos de la licencia.

---

<div align="center">
  <sub>Hecho con disciplina espartana.</sub>
</div>
