# 04 · Integración de Diagramas

## 1. Filosofía de los Diagramas Editoriales

Para comunicar conceptos técnicos avanzados sin saturar al usuario, los diagramas se conciben como esquemas vectoriales SVG limpios, autocontenidos y de alta densidad visual, basados en los principios de la skill `diagram-design`:
- **Vectoriales y Ligeros**: Cero dependencias de librerías JS pesadas de diagramación en tiempo de ejecución.
- **Focalización Visual**: 1 o 2 puntos focales destacados con acentos ámbar / esmeralda.
- **Modo Oscuro Integrado**: Colores de trazo y fondo adaptados al fondo negro/zinc de la documentación.

---

## 2. Mapa: Sección → Tipo de Diagrama

| Sección | Qué comunica el diagrama | Tipo de Diagrama |
|---|---|---|
| **`arquitectura`** | Capas del sistema: App Shell (Electron) ➔ Flujo Agéntico ➔ Capa MCP ➔ Herramientas Nativas (IPC). | **Layer Stack / Arquitectura Modular** |
| **`agentes`** | Ciclo de ejecución de tareas: Objetivo ➔ Generación del Plan ➔ Ejecución / Subagentes ➔ Revisión de Cambios. | **Workflow / Process Flow** |
| **`mcp`** | Protocolo MCP: Catálogo ➔ Handshake/OAuth ➔ Listado de Herramientas ➔ Invocación segura por IPC. | **Protocol Flow / Sequence** |
| **`permisos`** | Matriz de seguridad: Validación de rutas, detección de comandos destructivos, modal de confirmación del usuario. | **Security Matrix & Guardrails** |
| **`terminal`** | Puente IPC entre el renderer y el proceso principal para spawn de terminal nativa. | **IPC Bridge Diagram** |
| **`vault`** | Aislamiento criptográfico de credenciales y API keys fuera del contexto del agente. | **Enclave / Nested Isolation** |

---

## 3. Integración en los Componentes

Los diagramas se alojan en `landing/src/components/docs/diagrams/assets/` o se renderizan directamente mediante componentes SVG especializados con `<DiagramEmbed>`, asegurando borde redondeado, padding consistente y pie de figura opcional.
