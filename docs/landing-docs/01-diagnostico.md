# 01 · Diagnóstico del Estado Actual

## 1. Dónde vive el problema

El archivo `landing/src/components/docs/docs-page.tsx` concentra **190 líneas** en un único `export function DocsPage(...)` que mezcla lógica de enrutamiento, layout visual, navegación móvil/escritorio, datos estáticos y renderizado condicional de 10 secciones distintas de documentación.

Los otros dos archivos de la carpeta son de apoyo:
- `on-this-page.tsx` (28 líneas) — tabla de contenidos lateral derecha.
- `providers-section.tsx` (61 líneas) — la única sección que ya estaba extraída como componente propio.

---

## 2. Cómo está armada la página actualmente

`docsQuery` lee `?docs=slug` (o el path) y guarda el resultado en `currentPage`. Todo el elemento `<main>` es una cadena de sentencias condicionales inline:

```tsx
{currentPage === 'inicio' ? <section>...</section> : null}
{currentPage === 'arquitectura' ? <section>...</section> : null}
{currentPage === 'agentes' ? <section>...</section> : null}
// ... 7 bloques condicionales adicionales
```

Cada bloque mezcla en la misma línea:
- Texto descriptivo en español.
- Clases utilitarias de Tailwind.
- Íconos de `lucide-react`.
- Iteraciones `.map()` sobre arrays literales declarados dentro o fuera del componente.

---

## 3. Inventario de las 10 Secciones Actuales

| Slug | Título visible | Qué contiene hoy | Líneas |
|---|---|---|---|
| `inicio` | Construye con un agente que entiende tu espacio de trabajo | Hero + `Alert` "documentación basada en código" + 1 screenshot (`escritorio.png`) | 123–133 |
| `instalacion` / `desarrollo-local` | Ejecuta Sparta Agent localmente | `CodeBlock` con `git clone` + 3 tarjetas de pasos | 135–139 |
| `arquitectura` | Capas claras, responsabilidades separadas | Grid de 4 tarjetas (App shell, Flujo agéntico, MCP, Terminal) | 141–149 |
| `agentes` | Agentes, planes y actividad | Grid de 3 tarjetas (Plan, Actividad, Revisión) | 151–154 |
| `terminal` | Terminal nativa con permisos explícitos | Un párrafo, sin visual de soporte | 156–158 |
| `mcp` | Conecta herramientas con MCP | Párrafo + `Accordion` de 3 ítems (catálogo, ejecución, OAuth) | 160–167 |
| `proveedores` | Configuración y gestión de LLMs | Ya delegado a `<ProvidersSection />` | 169 |
| `skills` | Skills para especializar el agente | Un párrafo, sin visual de soporte | 171–173 |
| `permisos` | La ejecución sensible no queda oculta | Panel con 2 sub-tarjetas (Vault, Decisiones visibles) | 175–177 |
| `vault` | Vault y gestión de claves | Un párrafo, sin visual de soporte | 179–181 |

---

## 4. Por qué el diseño monolítico no escala

1. **Falta de componentes reutilizables**: Cada bloque repite manualmente la misma estructura de encabezado (`<p className="text-sm font-medium text-zinc-500">` + `<h2>` + `<p className="mt-4 max-w-2xl...">`).
2. **Cero diagramas explicativos**: Conceptos críticos de la arquitectura (capas del sistema, bridge IPC, ciclo de tareas de agentes, protocolo MCP) están explicados solo con texto plano.
3. **Secciones con contenido insuficiente**: `terminal`, `skills` y `vault` tienen apenas un párrafo, a pesar de ser funcionalidades clave de Sparta Agent.
4. **Acoplamiento alto**: Agregar una nueva sección exige modificar el array de navegación, el cuerpo del JSX de `docs-page.tsx` y `on-this-page.tsx`.
