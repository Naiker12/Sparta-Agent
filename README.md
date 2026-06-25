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

**Sparta Agent** es una aplicación de escritorio pensada para orquestar agentes de inteligencia artificial desde un único entorno local. Combina una interfaz de chat moderna con gestión de sesiones, skills reutilizables, servidores MCP, canales de comunicación, memoria persistente visualizada como grafo 3D y configuración de proveedores de modelos de lenguaje.

El objetivo es ofrecer un centro de control donde el usuario pueda interactuar con múltiples agentes, conectar herramientas externas mediante MCP, mantener contexto a través de la memoria del proyecto y personalizar la experiencia con temas, idioma y proveedores de modelos.

---

## Características principales

- **Chat unificado** con sesiones persistentes, pin, archive y rename.
- **Skills reutilizables** con explorador, creador y exportador a `.skill.json`.
- **Servidores MCP** con listado de conectados y marketplace de servidores populares.
- **Canales de comunicación** internos e integraciones (Telegram con test real de token, Discord/Slack/WhatsApp/Email en desarrollo).
- **Memoria persistente** con vista de grafo 3D interactivo (Three.js) y vista lista.
- **Proveedores de modelos** con test connection real y fetch de modelos disponibles.
- **13 temas visuales** (8 oscuros + 5 claros) con selección visual.
- **Internacionalización** español / inglés.
- **Iconos de marca** con detección automática de tema claro/oscuro.
- **Barra de título y ventana personalizadas** de Electron.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| UI Framework | React 18 + TypeScript |
| Bundler | Vite 5 |
| Desktop Shell | Electron 30 |
| State Management | Zustand 5 |
| UI Library | shadcn/ui + @base-ui/react |
| Estilos | Tailwind CSS v4 |
| Animaciones | Framer Motion |
| Grafo 3D | three.js 0.184 |
| Iconos | Lucide React + SVGs propios |
| Fuentes | Inter, Space Grotesk, Geist Variable |
| Package Manager | pnpm |
| Builder | electron-builder |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) (versión LTS recomendada)
- [pnpm](https://pnpm.io/)

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

3. Iniciar el entorno de desarrollo:

```bash
pnpm dev
```

Esto levanta el servidor de Vite y lanza Electron.

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia Vite + Electron en modo desarrollo |
| `pnpm build` | Compila TypeScript, hace build de Vite y empaqueta con electron-builder |
| `pnpm lint` | Ejecuta ESLint sobre archivos `.ts` y `.tsx` |
| `pnpm preview` | Previsualiza el build de Vite |

---

## Estructura del proyecto

```
sparta-agent/
├── electron/           # Proceso principal y preload de Electron
├── public/             # Assets estáticos, iconos, skills, screenshot
├── src/
│   ├── components/     # Componentes React organizados por dominio
│   ├── hooks/          # Hooks personalizados
│   ├── i18n/           # Diccionarios ES/EN
│   ├── lib/            # Utilidades, fetch de modelos, iconos, grafo
│   ├── stores/         # Stores de Zustand
│   ├── styles/         # CSS global y temas
│   └── types/          # Tipos compartidos de TypeScript
├── docs/               # Documentación técnica adicional
├── package.json
├── vite.config.ts
└── README.md
```

---

## Uso rápido

1. Abre la aplicación con `pnpm dev`.
2. Configura un proveedor de modelo desde **Configuración → Models**.
3. Crea una nueva sesión desde el sidebar.
4. Escribe tu tarea en el chat y usa el menú de adjuntos para activar búsqueda web, razonamiento o conectores MCP.
5. Explora las vistas de **Skills**, **MCP**, **Canales** y **Memoria** desde la barra lateral.

---

## Roadmap / Pendientes

- [ ] Conectar el chat con APIs reales de IA (Claude, GPT, Gemini, etc.)
- [ ] Integrar Monaco Editor en el panel de Editor
- [ ] Integrar xterm.js en el panel de Terminal
- [ ] Implementar Agent Management UI completa
- [ ] Adjuntos reales (archivos, snippets de código, imágenes, URLs)
- [ ] Grabación de audio por micrófono
- [ ] Integraciones reales de Discord, Slack, WhatsApp y Email
- [ ] Conexión real a servidores MCP (stdio/http)
- [ ] Auto-learning de la memoria
- [ ] Tests y CI/CD

---

## Licencia

MIT — Uso libre bajo los términos de la licencia.

---

<div align="center">
  <sub>Hecho con disciplina espartana.</sub>
</div>
