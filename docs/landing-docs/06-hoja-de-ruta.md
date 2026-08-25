# 06 · Hoja de Ruta de Implementación

Este documento detalla la secuencia de ejecución para modernizar la documentación de Sparta Agent sin causar regresiones ni tiempos de inactividad.

---

## 🚀 Fases de Implementación

### Fase 1: Extracción y Arquitectura Base
- [x] Crear layout desacoplado: `layout/docs-header.tsx`, `layout/docs-mobile-nav.tsx`, `layout/docs-sidebar.tsx`.
- [x] Extraer configuración de navegación a `content/docs-nav.config.ts`.
- [x] Crear componentes reutilizables: `content/section-header.tsx`, `content/section-cta.tsx`, `content/code-block.tsx`.
- [x] Extraer las 10 secciones a componentes dedicados en `content/`.

### Fase 2: Diagramas Editoriales y Visuales
- [x] Crear `diagrams/diagram-embed.tsx`.
- [x] Diseñar e integrar diagramas vectoriales claros (arquitectura, agentes, mcp, seguridad/permisos).
- [x] Vincular capturas de pantalla de la aplicación real.

### Fase 3: Ampliación de Contenido Técnico
- [x] Enriquecer secciones clave (`terminal`, `skills`, `vault`) con detalles técnicos precisos sobre los paquetes del monorepo (`ia-sparta-terminal`, `ia-sparta-vault`, catálogo de skills).

### Fase 4: Orquestador Delgado y Verificación
- [x] Convertir `docs-page.tsx` en un switch limpio y declarativo (~45 líneas).
- [x] Validar compilación de TypeScript (`pnpm run build`) y verificar navegación interactiva.
