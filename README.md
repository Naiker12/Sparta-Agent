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

**Sparta Agent** es un IDE de agentes de IA local-first que orquesta agentes de lenguaje desde el escritorio. Combina chat unificado, sistema de agentes real con subagentes y ejecución paralela, memoria semántica vectorial (ChromaDB), grafo 3D de conocimiento, servidores MCP, skills reutilizables, canales de comunicación y 13 temas visuales.

Cuenta con un **sidecar Python** (LangGraph + ChromaDB) para la capa de IA y un **módulo nativo Rust** (napi-rs) para validación, sanitización y auditoría de seguridad.

---

## Características principales

- **Chat unificado** con sesiones persistentes, pin, archive y rename.
- **Sistema de agentes real** con loop LLM→tools→subagentes y ejecución paralela.
- **Sidecar Python** (LangGraph + ChromaDB) para la capa de IA con streaming vía stdio JSON-RPC.
- **Módulo de seguridad Rust** (napi-rs): validador JSON-RPC, sanitizador de tool calls, rate limiting y log de auditoría.
- **Memoria semántica vectorial** con ChromaDB y embeddings vía OpenAI / Ollama.
- **Grafo 3D de conocimiento** interactivo (Three.js) con extracción automática de entidades y relaciones.
- **Skills reutilizables** con explorador, creador y exportador a `.skill.json`.
- **Servidores MCP** con listado de conectados y marketplace de servidores populares.
- **Canales de comunicación** internos e integraciones (Telegram funcional, Discord/Slack/WhatsApp/Email planeados).
- **Proveedores de modelos** con test connection real y fetch de modelos disponibles.
- **Vault cifrado** para API keys con safeStorage de Electron (AES-256-GCM).
- **Terminal con PTY real** (node-pty + PowerShell/bash) con resize sincronizado.
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
| Terminal | xterm.js + node-pty (PTY real) |
| AI Sidecar | Python 3.11+ / LangGraph / LangChain / ChromaDB |
| Security Layer | Rust / napi-rs (validator, sanitizer, guard, audit) |
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
│   ├── components/     # Componentes React (~101 archivos)
│   ├── hooks/          # Hooks personalizados (13 hooks)
│   ├── i18n/           # Internacionalización ES/EN
│   ├── lib/            # Utilidades, fetch de modelos, xterm-theme
│   ├── services/       # Capa de servicios (AI, memory, agents, chat, MCP)
│   ├── stores/         # Stores Zustand (15 stores, 11 con persist)
│   ├── styles/         # CSS global + 13 temas visuales
│   └── types/          # Definiciones de TypeScript
├── python/
│   └── sparta_ai/      # Sidecar Python: LangGraph, ChromaDB, agentes
│       ├── agents/     # StateGraph + subagentes (research, code, memory)
│       ├── tools/      # web_search, file_tools, memory_tools, mcp_bridge
│       ├── memory/     # ChromaDB VectorStore + grafo de conocimiento
│       ├── streaming/  # Event bridge LangGraph → JSON-RPC
│       └── tests/      # 32 tests Python (pytest)
├── rust/
│   └── sparta-security/ # Módulo de seguridad nativo (napi-rs)
│       └── src/        # validator, sanitizer, guard, audit (9 tests)
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

---

## Roadmap / Pendientes

- [x] Chat conectado con APIs reales (Anthropic, OpenAI, Ollama)
- [x] Monaco Editor integrado con 9 lenguajes
- [x] Terminal integrada con PTY real (node-pty + PowerShell/bash)
- [x] Sistema de agentes real con subagentes y ejecución paralela
- [x] Sidecar Python con LangGraph, ChromaDB, streaming JSON-RPC
- [x] Módulo de seguridad Rust (validador, sanitizador, rate limit, auditoría)
- [x] Vault cifrado para API keys con safeStorage de Electron
- [x] Memoria semántica vectorial con ChromaDB + embeddings
- [x] Lazy loading de Three.js y vistas pesadas
- [x] Thinking block, tool calls, interrupt-and-redirect
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
