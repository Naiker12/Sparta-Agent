# 🚀 Sparta Agent v0.1.1 — Official Release Notes

> **Plataforma de Desarrollo Agéntica Local-First para Equipos de Ingeniería de Alto Rendimiento**

---

## 🌟 Novedades Principales en la Versión v0.1.1

### 📑 Previsualizaciones Nativas Nivel Producción
- **Excel (`.xlsx`, `.xls`)**: Visor de hojas de cálculo con navegación por pestañas (*multi-sheet*), rejilla de datos con encabezados de columna (`A`, `B`, `C`), números de fila y truncado inteligente de celdas.
- **Word (`.docx`)**: Convertidor integrado con `mammoth` que renderiza documentos en vista impresa limpia con tipografía estilizada.
- **Visualizador Multimodal & PDF**: Soporte para documentos PDF, SVG, imágenes y código fuente en el panel de artefactos.

### 📎 Fichas / Tarjetas Visuales de Adjuntos (*Chips UI*)
- **Soporte Drag & Drop y Paste (`Ctrl+V`)**: Los archivos adjuntos e imágenes pegadas desde el portapapeles o arrastrados al chat ahora se muestran como **tarjetas visuales** (con miniatura, peso en KB, badge de extensión y botón de eliminar `X`).
- **Visión Multimodal**: Integración directa de imágenes codificadas en Base64 para modelos con soporte de visión (Claude 3.5 Sonnet, Gemini 2.5 Flash, OpenAI GPT-4o).

### ⚡ Ejecución Ultrarrápida en Windows & Normalización PowerShell
- **Traducción Automática de Comandos**: Mapeo inteligente de comandos Bash a Windows PowerShell (`which` ➔ `where.exe`, `2>/dev/null` ➔ `2>$null`, `export` ➔ `$env:`).
- **Ejecución Instantánea**: Finalización explícita de subprocesos PTY (`exit`) con temporizador de seguridad de 60s, eliminando bloqueos y consumos innecesarios de CPU/RAM.

### 🛡️ Diálogo Modal de Permisos & Aislamiento por Sesión
- **Modal de Confirmación**: Activación obligatoria de `PermissionRequestDialog` al intentar leer o escribir archivos fuera del área de trabajo.
- **Modelos Scoped por Sesión**: Cada conversación conserva de manera persistente su propio modelo de IA seleccionado sin sobreescribir las demás sesiones.

---

## 🛠️ Instrucciones de Instalación y Empleo

### Opción 1: Ejecutable de Instalación para Windows
1. Descarga el ejecutable `Sparta-Agent-Windows-0.1.1-Setup.exe`.
2. Ejecuta el instalador y selecciona el directorio de destino.
3. Inicia **Sparta Agent** desde el acceso directo del escritorio.

### Opción 2: Ejecución desde Código Fuente (Developer Mode)
```bash
# 1. Clonar el repositorio
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent

# 2. Instalar dependencias
pnpm install

# 3. Iniciar en modo desarrollo
pnpm dev
```

---

## 📦 Lista de Archivos Adjuntos para GitHub Release

| Archivo | Plataforma | Descripción |
| :--- | :--- | :--- |
| `Sparta-Agent-Windows-0.1.1-Setup.exe` | Windows x64 | Instalador autoejecutable NSIS para Windows 10/11 |
| `Sparta-Agent-Mac-0.1.1-Installer.dmg` | macOS | Imagen de disco de instalación para macOS |
| `Sparta-Agent-Linux-0.1.1.AppImage` | Linux x64 | Ejecutable portátil AppImage para Linux |

---

<div align="center">
  <sub>Sparta Agent v0.1.1 — Licencia MIT — Naiker12</sub>
</div>
