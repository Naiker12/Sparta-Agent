# 02 · Arquitectura de Componentes

## 1. Estructura de Carpetas Propuesta

```
landing/src/components/docs/
├── docs-page.tsx                 # Orquestador delgado (routing + layout), ~40-50 líneas
├── on-this-page.tsx               # Tabla de contenidos lateral derecha
├── layout/
│   ├── docs-header.tsx            # Breadcrumb, nav desktop y botón móvil
│   ├── docs-mobile-nav.tsx        # Panel de navegación móvil
│   └── docs-sidebar.tsx           # Navegación lateral por categorías
├── content/
│   ├── docs-nav.config.ts         # Datos de navegación desacoplados del JSX
│   ├── section-header.tsx         # Encabezado estándar (<eyebrow> + <h2> + <descripción>)
│   ├── section-cta.tsx            # CTA final de repositorio
│   ├── code-block.tsx             # Bloque interactivo de código / comandos
│   ├── inicio-section.tsx         # Sección Hero / Introducción
│   ├── primeros-pasos-section.tsx # Instalación y Desarrollo Local
│   ├── arquitectura-section.tsx   # Arquitectura de 4 capas
│   ├── agentes-section.tsx        # Ciclo de agentes (Plan, Actividad, Revisión)
│   ├── terminal-section.tsx       # Terminal nativa y canal IPC
│   ├── mcp-section.tsx            # Catálogo, conexión y OAuth de MCP
│   ├── providers-section.tsx      # Gestión de proveedores LLM
│   ├── skills-section.tsx         # Catálogo de skills y auditoría
│   ├── permisos-section.tsx       # Modelo de seguridad, validación y confirmaciones
│   └── vault-section.tsx          # Almacenamiento seguro y Vault IPC
└── diagrams/
    ├── diagram-embed.tsx          # Contenedor y marco visual para diagramas SVG
    └── assets/                    # Diagramas vectoriales SVG optimizados
```

---

## 2. Ficha Técnica por Componente

### `docs-page.tsx` (Orquestador)
- **Responsabilidad**: Determinar `currentPage`, renderizar el shell (`DocsHeader`, `DocsSidebar`, `OnThisPage`) y delegar la sección de contenido a través de un mapa declarativo `Record<string, React.ReactNode>`.
- **Props**: `onBackToLanding?: () => void`.

### `layout/docs-header.tsx`
- **Responsabilidad**: Barra de navegación superior fija con breadcrumbs interactivos, navegación rápida a secciones clave, botón hacia GitHub y disparador de menú móvil.
- **Props**: `onHomeClick: (e: React.MouseEvent) => void`, `menuOpen: boolean`, `onToggleMenu: () => void`, `docsHref: (slug?: string) => string`.

### `layout/docs-mobile-nav.tsx`
- **Responsabilidad**: Menú desplegable animado para pantallas móviles.
- **Props**: `open: boolean`, `onHomeClick: (e: React.MouseEvent) => void`, `docsHref: (slug?: string) => string`.

### `layout/docs-sidebar.tsx`
- **Responsabilidad**: Sidebar lateral con grupos semánticos (`Primeros pasos`, `Producto`, `Extensibilidad`, `Seguridad`), resaltado de enlace activo y enlace al repositorio.
- **Props**: `currentPage: string`, `docsHref: (slug?: string) => string`.

### `content/section-header.tsx`
- **Responsabilidad**: Garantizar una jerarquía visual homogénea en todas las páginas.
- **Props**: `eyebrow: string`, `title: string`, `description?: string`.

### `content/section-cta.tsx`
- **Responsabilidad**: Bloque de acción al final de cada página con enlace al repositorio de GitHub.

### `content/code-block.tsx`
- **Responsabilidad**: Renderizado de terminal con botón para copiar al portapapeles y retroalimentación de estado.
- **Props**: `command?: string`, `title?: string`.

### `diagrams/diagram-embed.tsx`
- **Responsabilidad**: Contenedor con borde glassmorphism, fondo adaptativo y soporte de SVG / esquemas vectoriales.
- **Props**: `src?: string`, `children?: React.ReactNode`, `caption?: string`, `alt?: string`.
