<div align="center">
  <img src="public/sparta-escritorio.png" alt="Sparta Agent Logo" width="120" />
  <h1>Sparta Agent</h1>
  <p><strong>Plataforma de Desarrollo Agéntica Local-First para Equipos de Ingeniería de Alto Rendimiento</strong></p>

  <p>
    <a href="https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.1.9"><img src="https://img.shields.io/badge/Versi%C3%B3n-v0.1.9-6366f1?style=for-the-badge&logo=github&logoColor=white" alt="Version 0.1.9" /></a>
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/MCP-Standard-8b5cf6?style=for-the-badge" alt="MCP Standard" />
    <img src="https://img.shields.io/badge/Licencia-MIT-10b981?style=for-the-badge" alt="License MIT" />
  </p>
</div>

---

<div align="center">
  <img src="docs/assets/sparta-principal.png" alt="Entorno de Trabajo Sparta Agent" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
  <br />
  <sub><b>Entorno de Desarrollo y Orquestación Agéntica en Tiempo Real</b></sub>
</div>

<br />

<div align="center">
  <table width="100%">
    <tr>
      <td width="50%" align="center">
        <img src="docs/assets/sparta-permisos.png" alt="Control de Permisos y Acciones Sensibles" width="100%" style="border-radius: 8px;" />
        <br />
        <sub><b>Diálogo Modal de Permisos y Validación Previa</b></sub>
      </td>
      <td width="50%" align="center">
        <img src="docs/assets/sparta-contexto.png" alt="Selector de Modelos y Gestión de Contexto" width="100%" style="border-radius: 8px;" />
        <br />
        <sub><b>Gestión Dinámica de Contexto y Proveedores</b></sub>
      </td>
    </tr>
  </table>
</div>

---

## 📑 Tabla de Contenidos

- [Propuesta de Valor](#-propuesta-de-valor)
- [Características Principales](#-características-principales)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Matriz de Seguridad y Privacidad](#-matriz-de-seguridad-y-privacidad)
- [Ecosistema MCP (Model Context Protocol)](#-ecosistema-mcp-model-context-protocol)
- [Proveedores de IA Compatibles](#-proveedores-de-ia-compatibles)
- [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Licencia](#-licencia)

---

## 🎯 Propuesta de Valor

En la era de la Inteligencia Artificial aplicada al desarrollo de software, la productividad real de los equipos de ingeniería requiere herramientas autónomas con comprensión holística del código.

**Sparta Agent** ofrece un **IDE agéntico autónomo y local-first**, diseñado para desarrolladores y equipos exigentes:

1. **Privacidad y Cumplimiento (Compliance)**: Ejecución y análisis dentro de tu máquina local. Protección de datos confidenciales y código propietario.
2. **Optimización de Costos**: Alterna libremente entre modelos locales (Ollama, LM Studio, llama.cpp) y APIs cloud avanzadas (Gemini 2.5, Claude 3.7, OpenAI, DeepSeek).
3. **Autonomía con Control Humano**: Planificación transparente, ejecución de comandos supervisada mediante permisos modales y diffs precisos.

---

## ⚡ Características Principales

* **Chat Temporal / Modo Incógnito**: Sesiones de conversación efímeras que no se guardan en el historial local para consultas rápidas o pruebas aisladas.
* **Control de Permisos Granular**: Validación previa obligatoria para cada acción de creación, modificación o borrado de archivos y ejecución de terminal.
* **Motor de Diferenciales Inteligentes**: Revisión precisa de cambios de código con soporte sintáctico avanzado.
* **Terminal Integrado Multi-Shell**: Ejecución de comandos en PowerShell, Bash y Zsh protegida por filtros de seguridad.
* **Previsualización de Documentos**: Visores integrados para archivos Excel (`.xlsx`, `.xls`), Word (`.docx`), PDF, Markdown e imágenes.
* **Conexión MCP Universal**: Integración inmediata con herramientas de base de datos, Git, navegadores web, APIs y servicios en la nube.

---

## 🏗️ Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CAPA DE PRESENTACIÓN (React 19 / Vite / TailwindCSS / Radix UI)       │
│ Interfaz moderna con soporte de temas, chat temporal, diffs interactivos│
│ y paneles de control contextuales.                                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ Canal IPC Seguro (Electron Preload / ContextBridge)
┌────────────────────────────┴────────────────────────────────────────────┐
│ 2. MOTOR AGÉNTICO Y ORQUESTACIÓN (Electron Main / Node.js Engine)       │
│ Orquestador de herramientas MCP, broker de permisos nativo, terminal    │
│ PTY interactivo y gestor de almacenamiento seguro.                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ Conectores Locales / REST / Stdio
┌────────────────────────────┴────────────────────────────────────────────┐
│ 3. HERRAMIENTAS Y SERVICIOS CONECTADOS (MCP Core)                       │
│ Filesystem, GitHub, Git, Bases de Datos (Postgres/MySQL/SQLite),        │
│ Servicios Google, Slack, Notion y Modelos Locales/Cloud.                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Matriz de Seguridad y Privacidad

| Componente | Función | Descripción |
| :--- | :--- | :--- |
| **Permission Dialog** | Aprobación Obligatoria | Cada acción que modifique el sistema de archivos o ejecute comandos requiere confirmación explícita del usuario. |
| **Command Sanitizer** | Inspección de Comandos | Prevención de comandos destructivos o llamadas que comprometan el sistema operativo. |
| **Path Guard** | Aislamiento de Espacios | Restricción de lectura y escritura al directorio de trabajo autorizado del proyecto. |
| **Vault Cifrado** | Credenciales Seguras | Almacenamiento local protegido de claves de API mediante `electron.safeStorage`. |

---

## 🔌 Ecosistema MCP (Model Context Protocol)

Sparta Agent incorpora conectividad nativa con el estándar oficial de Anthropic Model Context Protocol:

* **Control de Versiones**: GitHub, Git Local
* **Archivos y Nube**: Filesystem Local, Google Drive, OneDrive
* **Bases de Datos**: PostgreSQL, MySQL, SQLite, Supabase, MongoDB
* **Productividad**: Notion, Gmail, Google Calendar
* **Colaboración**: Slack, Figma
* **Navegación Web**: Playwright, Chrome DevTools, Fetch RAG

---

## 🧠 Proveedores de IA Compatibles

* **Locales (100% Offline y Privados)**: Ollama, LM Studio, llama.cpp, Servidores OpenAI-compatible.
* **Cloud (Máximo Rendimiento)**: Google Gemini (2.5 Flash, 2.0 Flash, 1.5 Pro), Anthropic Claude, OpenAI (GPT-4o, o3-mini), DeepSeek, Groq, Mistral, OpenRouter, Together AI, Fireworks AI.

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos
* **Node.js**: `v20.0.0` o superior (Recomendado `v22+ LTS`)
* **npm**: `v10+`

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent

# 2. Instalar dependencias
npm install

# 3. Instalar dependencias del frontend desktop
npm --prefix desktop/frontend-spartan install

# 4. Iniciar en modo desarrollo
npm run dev
```

### Comandos de Utilidad

```bash
# Verificar tipos de todo el proyecto
npm run typecheck

# Ejecutar linter
npm run lint

# Ejecutar suite de pruebas unitarias
npm test

# Compilar landing page
npm run landing:build

# Compilar binarios de escritorio
npm run build
```

---

## 📁 Estructura del Proyecto

```text
Sparta-Agent/
├── desktop/
│   ├── frontend-spartan/     # Interfaz de usuario principal (React + Vite + Assistant-UI)
│   ├── backend-spartan/      # Servicios y motor de soporte de backend
│   ├── ia-sparta-app-shell/  # Proceso principal de Electron y gestor de ventanas
│   └── ia-sparta-ipc-bridge/ # Canales IPC de comunicación segura
├── docs/                     # Documentación técnica y capturas de pantalla
├── landing/                  # Landing page oficial (Vite + React + TailwindCSS)
├── public/                   # Recursos estáticos, logotipos e iconos
├── skills/                   # Habilidades y plugins agénticos modulares
├── tests/                    # Pruebas unitarias del sistema
├── electron-builder.config.cjs # Configuración de empaquetado para Win/Mac/Linux
└── package.json              # Configuración y scripts del proyecto
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

<div align="center">
  <sub>Desarrollado con dedicación para la comunidad de ingeniería de software.</sub>
</div>
