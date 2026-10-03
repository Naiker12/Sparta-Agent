# Revisión del frontend de escritorio para la demo de la landing

Fecha: 2026-10-02. Fuente: código local actual de desktop/frontend-spartan y captura del usuario.

## Alcance y método

Se inventariaron los 1.272 archivos de src (264.428 líneas contadas incluyendo datos, traducciones, comentarios y líneas vacías). El inventario registra ruta, tamaño, imports, exports y señales de acoplamiento. Se leyeron específicamente los componentes que construyen el shell, el chat, el composer, los mensajes, el tema, los selectores y el workspace. Este inventario no significa una auditoría manual línea por línea ni una verificación funcional de los 1.272 archivos. Las señales de imports son heurísticas de dependencias directas; no certifican que un componente sea independiente.

Inventario completo: ../../artifacts/landing-redesign/desktop-frontend-inventory.json.

Esta revisión no modifica el frontend de escritorio. No se ha ejecutado su aplicación nativa; la referencia visual de escritorio es la captura facilitada por el usuario. La landing tenía cambios en curso anteriores a esta revisión; no deben confundirse con componentes compartidos ya extraídos.

## Estructura completa del código inventariado

| Área | Archivos | Papel |
| --- | ---: | --- |
| app | 20 | Rutas y composición de la aplicación |
| components | 188 | Shell, sidebar, mensajes, workspace y primitivas UI |
| features/chat | 255 | Runtime, composer, proyectos, proveedores, herramientas y artefactos |
| features/hub | 147 | Catálogo y administración de modelos |
| features/recipe-studio | 153 | Editor y ejecución de recetas |
| features/settings | 89 | Apariencia, perfil, voz, conexiones y configuración |
| features/model-picker | 48 | Inventario, selección y configuración de modelos |
| features/rag | 24 | Documentos, contexto y vista previa |
| features/profile | 19 | Perfil y personalización |
| features/native-intents | 17 | Integración con acciones nativas |
| features/data-recipes | 15 | Recetas de datos |
| features/api-monitor | 13 | Monitor de solicitudes y consumo |
| Otras features | 70 | Auth, audio, credenciales, seguridad, memoria, tareas, tours, setup y más |
| hooks | 33 | Comportamiento compartido y dispositivos |
| i18n | 111 | Traducciones y utilidades |
| lib | 57 | APIs, archivos, plataforma y utilidades |
| Otros archivos/directorios | 13 | CSS, entrada, tipos, assets y utilidades |

Se detectaron 41 archivos con imports relacionados con escritorio, 227 con stores, 210 con APIs/fetch, 48 con router, 72 con assistant-ui y 143 con i18n. Las categorías se solapan y no incluyen toda dependencia transitiva.

## Identidad visual real

Fuente: src/index.css y features/settings/stores/theme-store.ts.

El valor inicial es light con palette standard. No es la paleta violeta de Openbot. La captura confirma la superficie cálida, la barra lateral beige y las acciones azules.

| Token | Claro estándar | Oscuro estándar |
| --- | --- | --- |
| background | #f2ebe0 | #181818 |
| card / popover | #fbf7f0 | #212121 |
| primary | #339cff | #4dabff |
| sidebar | #e8dfd3 | #1f1f1f |
| border | #d9cebf | #303030 |

El composer tiene reglas específicas que no equivalen a pintar todas las tarjetas con card: la captura muestra una superficie blanca. Hay que reutilizar también sus reglas de superficie, sombras, radio, espaciado, controles y estados.

Texto normal: Inter Variable. Encabezados: Hellix con Space Grotesk como alternativa. Existe escalado de UI, iconos y texto; copiar solamente tamaños en px pierde esa relación. El radio base es 1.1rem. La sidebar usa principalmente Hugeicons; el rail usa Lucide. No conviene sustituir todos los iconos por una sola biblioteca.

El branding del sidebar en el código combina spartan-logo.svg, color primary y el nombre SPARTAN AGENT. Los logos blanco/negro pedidos para la landing pertenecen al branding exterior; no deben reemplazar arbitrariamente el aspecto del producto dentro de la demo.

## Shell y navegación

Fuentes: components/app-sidebar.tsx y components/sidebar/*.

SidebarBrandHeader integra logo, búsqueda, colapso y diferencias de titlebar por plataforma. NavItem aplica iconos azules, tipografía, alturas y badges; MoreMenuItem coloca acciones secundarias en Más. La navegación visible depende de preferencias, estado y contexto. La captura muestra Nuevo chat, Chat temporal, Proyectos, Canales deshabilitado con Próximo, Más, grupos Proyectos/Recientes y perfil al pie.

La demo anterior exponía Memoria, Monitor y Recetas como un menú plano permanente. Eso no reproduce el estado capturado. La demo debería usar el mismo orden inicial y colocar opciones adicionales en Más. Canales no debe parecer funcional si el producto lo presenta como próximo.

Los proyectos contienen conversaciones; no son solo etiquetas estáticas. Nuevo chat y chat temporal tienen comportamientos diferentes. La búsqueda y los ajustes son acciones reales, no decoración.

## Bienvenida y composer

Fuentes: components/assistant-ui/thread/thread-welcome.tsx, components/ui/blobatar-avatar.tsx, components/assistant-ui/thread.tsx, thread/composer-right-controls.tsx y features/chat/shared-composer.tsx.

La bienvenida utiliza GeneratedAvatar de @blobatar/react, cargado con lazy y Suspense. Cambia entre ocho semillas cada cuatro segundos y respeta prefers-reduced-motion. El avatar verde de la captura no es el logo de Sparta ni una imagen de Openbot. El saludo varía según hora, nombre y modo temporal.

El composer utiliza ComposerPrimitive.Input con autoajuste entre 1 y 12 filas, composición IME, adjuntos, dictado, envío, parada y colas. ComposerRightControls contiene el selector de modelo, ReasoningToggle, dictado y el botón enviar/parar. Mientras genera, el control cambia; no basta con mostrar una flecha siempre.

La carpeta se gestiona con ThreadWorkspaceChip: vinculación al hilo, selección de proyecto, permisos, estado pendiente y acciones nativas. El chip va en su banda de contexto encima del input. El selector de permisos no debe cambiar de conversación ni de ejemplo: cambia el modo de autorización. El código contempla ask, auto, off y full, con descripciones y confirmación para el caso correspondiente.

### Aclaración sobre arriba

En este checkout ChatComposerModelSelectorProvider entrega ApiProviderModelSelector al composer y ComposerRightControls lo renderiza junto a las acciones. ApiProviderModelSelector abre su PopoverContent con side=top. La captura muestra free abajo a la derecha. Por tanto, arriba puede describir el desplegable que se abre hacia arriba, no necesariamente mover el botón a la cabecera del chat. La demo en curso había movido el botón a la cabecera antes de esta revisión; eso no debe presentarse como una copia fiel del checkout. La referencia actual favorece conservar la colocación del componente real y su menú superior; una ubicación distinta sería una decisión de diseño explícita.

El selector real tiene búsqueda por modelo/proveedor, logos, grupos, estado de carga, actualización de catálogo y configuración de conexiones. Un menú con tres modelos fijos no es el componente real.

## Streaming y mensajes

Fuentes: features/chat/api/chat-adapter.ts, components/assistant-ui/thread/assistant-message-view.tsx, markdown-text.tsx, streaming-markdown.ts y streaming-render-schedule.ts.

El runtime alimenta assistant-ui. Los mensajes se componen de partes de texto, razonamiento y herramientas. GeneratingIndicator permanece visible cuando el mensaje está running y todavía no hay texto ni razonamiento, incluso si ya existen herramientas. Usa ThinkingAvatar y un spinner de fallback.

El Markdown utiliza Streamdown y estabilización para bloques incompletos, código, tablas y matemáticas. Hay tarjetas de herramientas, fuentes, adjuntos, artefactos, acciones, cancelación y errores. Un efecto slice sobre un párrafo puede simular crecimiento de texto, pero no reutiliza el renderer real ni representa esos estados.

Para la landing conviene un runtime local de demostración con mensajes por partes y generación controlada, renderizado por la misma capa visual extraída. Los textos y las herramientas deben estar claramente identificados como ejemplo. No conectar credenciales, terminal, archivos del usuario ni proveedores para que la demo parezca real.

## Rail, panel y sheets

Fuentes: components/workspace-rail/*, features/chat/stores/use-workspace-store.ts, features/chat/components/single-content.tsx.

El WorkspaceRail es un rail de 48px a la derecha. Tiene Archivos, Cambios, GitHub, Subagentes y Vista previa web. Archivos está disponible; las otras pestañas dependen de hasGit, hasGithub, hasAgents y hasBrowser. La pestaña activa se colapsa al pulsarla otra vez. El panel empieza cerrado; su ancho inicial es 352px y se ajusta entre 280 y 900px.

El panel tiene cabecera, cierre, contenido desplazable y redimensionado mediante puntero y teclado. Hay estados de carga/error y ámbito de carpeta. FilesPanel y DiffViewer no son lo mismo que un bloque genérico de código.

Parte del contenido de GitHub/Subagentes del checkout está representado con registros estáticos en WorkspacePanelContainer; no implica ejecución real de esas acciones. BrowserPreviewPanel y FileSource sí tienen dependencias del entorno y necesitan adaptadores.

Además del workspace hay panel de artefactos, ResearchActivityPanel/Sheet y MessageResponseDetailsSheet. No todo panel lateral es un mismo sheet. SingleContent utiliza divisiones redimensionables en escritorio y un sheet específico de investigación en móvil. La landing no debe agrupar todos esos casos bajo una pestaña de archivo.

## Reutilización recomendada

| Capa | Acción | Motivo |
| --- | --- | --- |
| Tokens, fuentes y logos | Compartir una fuente de tema limitada al contenedor de demo | Fidelidad sin cambiar el tema de documentación/landing |
| Button, Popover, Command, Tooltip, Sheet, Tabs | Extraer o reutilizar primitivas tras revisar imports transitivos | Evitar mantener dos sistemas visuales distintos |
| GeneratedAvatar / ThinkingAvatar | Reutilizar el wrapper existente y sus dependencias | Es el avatar real del producto |
| Sidebar, rail y panel | Separar componentes de presentación con props y callbacks | Actualmente consumen stores, i18n, router y contexto de escritorio |
| Composer y modelo | Compartir presentación; inyectar catálogo y callbacks de demo | Evitar conexión a proveedores y cambios de configuración real |
| Mensajes y streaming | Extraer renderer + runtime local de ejemplo | Mostrar las mismas partes, markdown y estados |
| APIs, stores, Tauri, archivos y credenciales | Mantener fuera del bundle de landing | No son necesarios para la presentación |

La landing usa React Router; el escritorio usa TanStack Router. Ambos usan React 19, Tailwind 4 y shadcn, pero las primitivas locales no son idénticas: Button de escritorio usa Slot/asChild y variantes Tailwind; el Button actual de landing usa clases CSS propias. Compartir el nombre Button no significa reutilizar el mismo componente.

No importar AppSidebar, Thread o ChatPage directamente desde la landing ni aplicar un alias global @ al src de escritorio. Arrastraría stores, APIs, router, assets absolutos y código de plataforma. Tampoco copiar el frontend completo para formar una segunda aplicación. La extracción debe crear componentes de presentación compartidos y dejar adaptadores distintos para escritorio y demo.

## Orden concreto de corrección de la landing

1. Definir contrato de presentación del tema, sidebar, composer, modelos, rail y mensajes a partir de estos archivos reales.
2. Extraer primero las primitivas y el avatar que no tienen efectos de aplicación; comprobar imports transitivos.
3. Crear los adaptadores de demo con datos locales, catálogo buscable y capacidades de un proyecto de ejemplo.
4. Reproducir primero el estado de bienvenida de la captura: claro cálido, logo azul de producto, Más, avatar real y composer centrado.
5. Mostrar la transición a conversación, generación, herramientas, resultado y apertura del panel con el renderer compartido.
6. Verificar fidelidad en escritorio y comportamiento móvil, teclado, cierre de popovers y movimiento reducido.
7. Eliminar las implementaciones de demo anteriores solo cuando la nueva versión las sustituya y no tengan consumidores.

Openbot sigue siendo una referencia para la composición exterior de la landing y el pie. Los componentes y la identidad de la demo deben proceder de Sparta.

## Verificación de esta revisión

- Inventario generado leyendo todos los archivos de src.
- Lectura dirigida de los componentes y cadenas descritos arriba.
- Landing: npx tsc --noEmit pasó al finalizar la revisión.
- No se ejecutó un build ni pruebas funcionales del escritorio porque esta fase no modifica su código.
- La extracción compartida y la nueva demo todavía no están implementadas ni verificadas. El inventario y este informe son la base para esa implementación.

## Implementación posterior a la revisión

La landing reutiliza directamente GeneratedAvatar y ThinkingAvatar desde components/ui/blobatar-avatar.tsx y el Button de components/ui/button.tsx mediante un adaptador de clases de layout. El frontend de escritorio no se modificó. Vite deduplica React y resuelve las dependencias compartidas desde landing/node_modules; TypeScript tiene las correspondientes rutas de tipos.

El script landing/scripts/sync-desktop-demo.mjs genera los tokens locales de demo desde el CSS real del escritorio para claro y oscuro. Corre antes de dev/build/build:gh y falla si falta un token. La fuente Hellix se referencia desde el asset original de escritorio, sin otra copia.

La demo inicial usa claro estándar, bienvenida con el avatar real, controles de modelo junto al composer con menú superior buscable, carpeta, adjunto local y permisos independientes de la conversación. La navegación presenta Chat temporal, Proyectos, Canales próximo y Más. El panel tiene cinco vistas y colapso; los contenidos son datos locales de ejemplo.

El texto progresivo usa Streamdown 2.5.0, el mismo motor del escritorio. Todavía es un runtime de ejemplo controlado por etapas: no se ha importado AssistantMessageView ni el adaptador/API de chat completos. La reproducción, pausa y parada no ejecutan solicitudes a proveedores. La fidelidad de todas las herramientas y estados del renderer completo no queda certificada por esta implementación.

Comprobaciones: build:gh y tsc pasan; docs:check verifica 24 páginas y 16 enlaces internos. En navegador se comprobaron búsqueda/selección de modelo, envío/parada, panel de archivos/cambios/GitHub/subagentes/vista previa, cierre con Escape, tema oscuro y ausencia de errores. Sin desbordamiento horizontal en 360, 390 y 768px de viewport.
