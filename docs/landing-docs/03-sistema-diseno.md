# 03 · Sistema de Diseño

## 1. Tokens de Diseño y Paleta

La documentación se alinea con la estética visual de la landing de Sparta Agent (`src/styles/globals.css`), manteniendo compatibilidad plena con el modo oscuro y alto contraste:

| Elemento | Clases / Tokens | Propósito |
|---|---|---|
| **Fondo Principal** | `bg-black`, `text-white` | Base inmersiva dark-first del visor de docs. |
| **Superficies y Tarjetas** | `bg-zinc-950`, `bg-white/[.03]`, `border-white/10` | Paneles con elevación sutil y separación visual limpia. |
| **Tipografía Display (Hero)** | `text-4xl sm:text-6xl font-semibold tracking-[-0.045em]` | Títulos de gran impacto para la página de inicio. |
| **Títulos de Sección (`h2`)** | `text-3xl font-semibold tracking-tight text-white` | Encabezados principales en cada vista. |
| **Eyebrows (Categoría)** | `text-sm font-medium text-zinc-500` | Contexto previo al título principal. |
| **Párrafos de Cuerpo** | `text-zinc-400 leading-7 max-w-2xl` | Texto legible con ritmo vertical óptimo. |
| **Acentos y Énfasis** | `text-amber-300`, `selection:bg-amber-400/20` | Toques dorados/ámbar característicos de Sparta Agent. |

---

## 2. Anatomía Estándar de una Sección

Cada componente en `content/` sigue una estructura estandarizada y predecible:

```
[ SectionHeader ]
  ├── Eyebrow (Categoría superior)
  ├── Título (h2 semántico)
  └── Descripción (Párrafo introductorio)
        ↓
[ Contenido Central ]
  ├── Diagrama Editorial (DiagramEmbed) o Screenshot de Producto
  ├── Rejilla de Tarjetas / Acordeón / Pasos / CodeBlock
  └── Tablas / Detalles técnicos
        ↓
[ SectionCta ] (Presente en todas las páginas excepto Inicio)
```

---

## 3. Patrones de Tarjetas Reutilizables

1. **Feature Card**:
   - Icono `lucide-react` con `strokeWidth={1.6}`.
   - Borde `border-white/10` con transición a `border-white/30` en hover.
   - Tipografía estructurada con título y descripción clara.
2. **Security & Alert Banner**:
   - Fondo `bg-white/[.03]` con borde suave `border-white/10`.
   - Icono distintivo destacado dentro de un contenedor dedicado.
