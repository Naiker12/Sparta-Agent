# Auditoría y especificación de la nueva landing de Sparta Agent

Fecha: 2 de octubre de 2026. Alcance: página de inicio de Openbot y landing local de Sparta. Entrega: auditoría y diseño propuesto; no se ha sustituido ni publicado la landing.

## Decisión de diseño

La aplicación debe ser la protagonista. Simplificar la página alrededor de una demostración navegable de Sparta, con mensajes y actividad animados, construida con elementos de interfaz y datos de ejemplo. Sustituir la captura principal y las capturas repetidas por esta experiencia. Conservar el logotipo y las imágenes útiles de documentación y redes sociales.

Mantener identidad propia: nombre, logotipo, tipografía y UI de Sparta. Adoptar de Openbot la jerarquía y la demostración del producto; no trasladar su contenido, personajes, precios ni promesas sobre proveedores.

## 1. Qué se comprobó en Openbot

Se abrió la página, se inspeccionó su DOM y se revisó visualmente la página completa. Se navegó dentro de la demostración desde Chief hacia Research y se observaron contenidos posteriores en esa conversación.

La estructura pública es: navegación, presentación con descarga, aplicación interactiva, explicación de coste, descargas por plataforma y pie de página. Las noticias, guías y plugins están en menús y páginas secundarias; no convierten el cuerpo de la landing en un catálogo largo. [Página analizada](https://openbot.run/).

La presentación utiliza un fondo gris oscuro, cuadrícula discreta, título grande, párrafo breve y una acción principal de descarga. La aplicación aparece a continuación en un marco ancho con bordes suaves. Las tarjetas de plataforma introducen más color al final.

La demostración está en un iframe con origen `/app-preview`, título accesible y permisos de sandbox `allow-forms allow-same-origin allow-scripts`. Su interior contiene navegación, conversaciones, tablas, adjuntos y compositor como elementos DOM. No se encontró un video en la página principal. Se pudo cambiar de conversación con un control de la demo: no es una captura estática.

Se observaron cambios de contenido durante la visita. Esto acredita una experiencia dinámica, pero no establece cómo está programado su guion ni si utiliza un backend real. No se auditó su servidor, tráfico de inferencia ni código fuente completo.

### Qué adoptar y qué mejorar

| Elemento | Decisión para Sparta |
| --- | --- |
| Presentación corta y producto visible | Adoptar; explicar en una frase qué hace Sparta y ofrecer descarga desde el hero. |
| Aplicación navegable | Adoptar con la apariencia de Sparta, datos de ejemplo y casos verificables. |
| Fondo discreto | Adoptar; evitar partículas detrás de textos y controles. |
| Descarga adaptada a plataforma | Adoptar conservando una elección manual visible. |
| Precio protagonista | Solo incluir un mensaje de coste después de distinguir aplicación y consumo del proveedor. |
| Pie con muchas comparaciones | Simplificar; mantener documentación, releases, GitHub y soporte. |
| Aplicación completa en móvil | Adaptar a móvil; no reducir una ventana de escritorio hasta que su texto sea ilegible. |
| Animación automática | Añadir pausa, reinicio y una transición clara al control manual. |

## 2. Auditoría de Sparta actual

Se ejecutó la landing local, se revisaron escritorio y un ancho de 390 px, y se inspeccionaron los componentes utilizados por `landing/src/landing-page.tsx`. No se confundieron los componentes antiguos que existen en el repositorio con los que la página monta actualmente.

### P0: claridad, confianza y navegación

1. **El hero no tiene botones propios.** El DOM de `#about` no contiene enlaces ni botones. La descarga queda en la navegación y muy abajo en el recorrido. Añadir descarga y documentación debajo del mensaje principal.
2. **Un anuncio interrumpe la primera visita.** `ReleaseModal` abre tras 600 ms si no se ha visto el anuncio de esa versión. Sustituir la apertura automática por un enlace pequeño a novedades.
3. **Promesas de privacidad contradictorias.** El footer promete «privacidad absoluta», mientras la FAQ explica correctamente que contenido de solicitudes puede llegar al proveedor elegido. Usar una explicación consistente del control local y de la transmisión por API.
4. **Permisos explicados de forma incompatible con los modos existentes.** La sección MCP y partes de la FAQ presentan la aprobación como universal para cada acción. El compositor permite distintos modos de aprobación. Explicar que el comportamiento depende del modo y del acceso a la carpeta.
5. **Hay dos IDs `mcp`.** Uno pertenece al bloque del recorrido y otro a la sección de conectores. Un enlace a `#mcp` puede llevar al bloque distinto del que pretende la navegación. Cada sección debe tener un identificador único.
6. **Separar publicado y en desarrollo.** La landing ya distingue v0.3.2 de las próximas mejoras. La nueva demo debe conservar esa distinción: el compositor recién cambiado no puede presentarse como incluido en un instalador anterior.

### P1: exceso de contenido y coherencia visual

7. **La misma captura aparece cuatro veces.** `SPARTAN-PRINCIPAL.png` está en el hero y en tres capacidades. Hay seis imágenes de producto en el DOM principal, pero solo tres archivos distintos. Las repeticiones no explican nuevas acciones.
8. **La captura muestra el producto en reposo.** La pantalla inicial vacía comunica menos que una tarea con carpeta, actividad y resultado. Reemplazarla por un flujo demostrativo.
9. **Página extensa.** Se observó una altura de documento de 8.211 px a 1.280 px de ancho y 12.725 px a 390 px de ancho. Son mediciones de desarrollo y de esas condiciones concretas, no valores universales. La nueva estructura debe reducir bloques repetidos.
10. **Demasiados efectos independientes.** Fondo canvas, carruseles, ráfagas en botones, elevación al pasar el cursor, terminal animada y grafo MCP compiten por atención. Concentrar el movimiento en la demo.
11. **Tecnologías antes que utilidad.** El carrusel React/TypeScript/Python/Electron describe implementación. El usuario necesita entender qué puede conseguir con Sparta. Llevar arquitectura a documentación.
12. **Textos técnicos sin evidencia suficiente.** El flujo MCP menciona Tokio Sidecar IPC «sub-milisegundo» y otras etiquetas de arquitectura. Revisar esos textos contra la edición actual de Electron/Python y retirar métricas sin mediciones que las sostengan.
13. **Confundir compatibilidad con disponibilidad.** Mostrar un logo MCP no acredita que la integración esté instalada, autenticada o lista. Presentar conexiones como configurables y enlazar sus requisitos.

### P1: contraste y accesibilidad

Se calcularon contrastes de colores sólidos definidos en el código. Transparencias, gradientes, estados y fondos efectivos necesitan una comprobación adicional durante la implementación.

| Texto / fondo | Contraste aproximado | Evaluación |
| --- | ---: | --- |
| `#6a6b6c` / `#040506` | 3,82:1 | Insuficiente para texto normal pequeño. |
| `#6a6b6c` / `#07080a` | 3,75:1 | Insuficiente para texto normal pequeño. |
| Blanco / coral `#ff6363` | 2,91:1 | La variante coral definida en Button necesita corrección. |
| `#9c9c9d` / `#040506` | 7,44:1 | Buena base para texto secundario. |
| `#454647` / `#e6e6e6` | 7,58:1 | Buena legibilidad del botón neutro definido. |

La variante coral existe en el componente; no se afirma que todos los botones actuales la usen. WCAG requiere al menos 4,5:1 para texto normal y 3:1 para texto grande. [Referencia de contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

La FAQ tiene `aria-expanded`, pero no enlaza cada disparador con su panel mediante `aria-controls`. Sus respuestas colapsadas siguen apareciendo en el árbol de accesibilidad. El disparador utiliza `focus:outline-none` sin un indicador alternativo en ese componente. Usar el Accordion accesible existente o ajustarlo antes de reutilizarlo.

El botón de menú móvil mide 32 px de alto y la descarga 36 px en la comprobación. Proponer 44–48 px para las acciones principales como decisión de comodidad táctil; no presentar ese tamaño como el único mínimo normativo aplicable.

El anuncio tiene `role="dialog"` y `aria-modal`, pero no se encontró gestión explícita de foco o Escape en su implementación. No se realizó una auditoría completa con lector de pantalla. Al retirarlo del arranque se elimina esa interrupción; cualquier diálogo restante debe usar una primitiva accesible.

### P2: mantenimiento y rendimiento

El archivo de entrada de la landing combina navegación, secciones, contenido, iconos y lógica de interacción. Además existen secciones alternativas que no se montan. Dividir el recorrido final en componentes pequeños y dejar una única composición activa.

`InteractiveSpiderWeb` recorre parejas de partículas y continúa solicitando frames mientras está montado. No tiene una comprobación propia de visibilidad o movimiento reducido. Algunas otras secciones sí usan `useReducedMotion`; la cobertura es desigual.

La terminal de `ProductTour` crea un intervalo interior cuya referencia no aparece en el cleanup exterior. Al sustituirla por el guion único de la demo, gestionar cancelación y limpieza de todos los temporizadores.

Los tres PNG de producto suman aproximadamente 251 KiB: no son, por sí solos, evidencia de una carga extraordinaria. La justificación principal para retirarlos del recorrido es la repetición y su baja capacidad de demostrar trabajo. No se han medido Lighthouse ni Core Web Vitals de producción; no se atribuyen tiempos de carga a estos hallazgos.

## 3. Estructura propuesta completa

| Orden | Bloque | Contenido |
| --- | --- | --- |
| 1 | Navegación | Logo Sparta, Producto, Documentación, GitHub y Descargar. |
| 2 | Hero | Título, explicación de dos líneas, descarga por sistema y enlace a documentación. |
| 3 | Demo de Sparta | Ventana navegable, guion automático, selector de ejemplos, pausa y reinicio. |
| 4 | Tres beneficios | Tu proyecto como contexto; tu proveedor de IA; herramientas bajo tu control. |
| 5 | Descargas | Windows, macOS y Linux; versión y requisitos comprobados. |
| 6 | FAQ breve | API, coste, privacidad, permisos y primer arranque. |
| 7 | Footer | Marca, documentación, código, releases, soporte y licencia. |

Texto sugerido del hero:

> Tu proyecto. Tu IA. Un solo espacio.
>
> Conecta tu proveedor de IA y trabaja con tus archivos, herramientas y conversaciones desde Sparta Agent.

Acciones: **Descargar para Windows** —adaptada al sistema detectado— y **Ver documentación**. Permitir escoger otro sistema; la detección nunca debe bloquear una descarga.

Las novedades pasan a una página o al enlace de releases. MCP y skills se integran en un beneficio breve y en la demo; su explicación técnica queda en documentación. No incluir otro CTA gigante con el mismo mensaje antes del footer.

## 4. Demo dinámica: experiencia y funcionamiento

Construir `SpartaPreview` con React y componentes ligeros. El visitante debe reconocer nuestra barra lateral, conversación, franja de carpeta, modelo, permisos y panel de archivos. El resultado se compone de texto, controles, estados y archivos de ejemplo, no de una imagen con un cursor moviéndose encima.

### Tres ejemplos

1. **Trabajar con un proyecto:** seleccionar una carpeta ficticia, escribir una solicitud, mostrar lectura de archivos, presentar una propuesta y abrir su diff.
2. **Entender documentos:** adjuntar un documento de ejemplo, mostrar preparación de contexto y una respuesta con referencias al material incluido.
3. **Controlar herramientas:** mostrar una acción propuesta, su alcance y una aprobación manual en el modo que corresponda.

Cada escena debe mapearse a funciones verificadas de Sparta. Si una función pertenece al próximo lanzamiento, indicarlo junto a la demo. Evitar prometer rendimiento, ejecución local de modelos o integraciones disponibles sin comprobarlos.

### Guion inicial propuesto, de unos 20 segundos

| Tiempo orientativo | Acción visible |
| --- | --- |
| 0–3 s | Proyecto de ejemplo y carpeta visible. |
| 3–6 s | Aparece una solicitud breve en el compositor y se envía. |
| 6–10 s | Actividad de lectura de dos archivos con estados claros. |
| 10–15 s | Respuesta y propuesta de cambio. |
| 15–20 s | Panel de diff y resumen del resultado. |

Pausa y reinicio visibles. Al elegir una pestaña, conversación o archivo, detener el guion y conservar el control manual hasta que el visitante lo reanude. No reiniciar mientras escribe ni cambiar de panel por sorpresa.

Ofrecer mensajes sugeridos que producen respuestas predefinidas. Si se permite escribir texto libre, indicar que es una demo y utilizar una respuesta de ejemplo coherente; no fingir que el sitio está conectado al agente instalado.

La demo será autónoma, sin API keys, herramientas del sistema ni acceso a carpetas del visitante. Los datos viven en memoria y se reinician con la demo. Cargarla de forma diferida y aislar estilos y estado. No importar el backend ni los stores completos del escritorio para mostrar una demostración pública.

No es obligatorio usar un iframe: Openbot lo utiliza, pero un componente aislado dentro de nuestra landing puede evitar otra carga de aplicación. Elegir iframe solo si necesitamos una ruta independiente y un aislamiento más fuerte de estilos. Mantener el resultado desplegable en el hosting estático actual.

### Movimiento y móvil

Animar aparición de contenido y estados, con desplazamientos cortos y transiciones de 150–250 ms. Evitar partículas, inclinaciones de toda la ventana y escritura extremadamente lenta. Con movimiento reducido, mostrar la escena completa y navegación manual. Pausar al salir del área visible o al ocultarse la pestaña.

El contenido en movimiento automático que cumple las condiciones de WCAG debe poder pausarse, detenerse u ocultarse. [Referencia de movimiento](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

En móvil, mostrar conversación y compositor como vista principal; abrir proyectos y archivos desde controles. Mantener texto legible, sin encoger toda la ventana mediante `transform: scale`. La demo debe usar espacio acotado y evitar atrapar el scroll de la página.

## 5. Sistema visual y botones

Paleta propuesta: fondo `#181818`, superficies `#222222`, controles `#2c2c2c`, texto principal `#f5f5f5`, texto secundario `#a8a8a8` y acento Sparta `#63a1ff`. Son decisiones propuestas, no colores extraídos íntegramente de Openbot.

Contrastes sólidos de la propuesta: principal/fondo 16,29:1; secundario/fondo 7,47:1; azul/fondo 6,83:1. Los bordes decorativos pueden ser discretos; límites y estados esenciales de controles requieren su propia verificación.

Una tipografía principal —Inter ya disponible— y monoespaciada solo para código. Texto de lectura de 16–18 px, controles de 14 px y metadatos de 12–13 px. Titular de aproximadamente 56–72 px en escritorio y 36–42 px en móvil. Ancho máximo aproximado de 1.120 px, con párrafos de 600–680 px.

Descarga principal: fondo `#f0f0f0`, texto `#101010`, altura de 44–48 px y radio consistente. Acción secundaria con borde y fondo neutro. Reservar el azul para foco, selección y enlaces. El hover debe tener una variación suave; eliminar explosiones de partículas.

La landing tiene configuración shadcn `base-nova` y componentes locales. Reutilizar y ajustar Button, Accordion, Badge, Card y Separator; añadir Popover o Tabs solo si hacen falta para la demo. Evitar varias implementaciones de botones con colores y estados divergentes. La configuración no reemplaza la revisión de accesibilidad de los componentes modificados. [Button](https://ui.shadcn.com/docs/components/base/button), [Accordion](https://ui.shadcn.com/docs/components/base/accordion).

## 6. Imágenes, contenido y descargas

Retirar del recorrido principal `SPARTAN-PRINCIPAL.png` y sus repeticiones. Mantener el archivo para README/documentación si sigue siendo útil. Las capturas de contexto y permisos pueden pasar a las guías. Conservar logo, favicon e imagen Open Graph: quitar una captura del hero no requiere eliminar todos los recursos gráficos.

Unificar los textos de privacidad y permisos. Aclarar que el consumo de API depende del proveedor. No trasladar a Sparta la promesa de Openbot sobre usar planes de suscripción: debe corresponder a nuestro mecanismo real de autenticación.

Se comprobó la existencia de la release v0.3.2 y de los instaladores Windows, macOS y Linux listados en sus metadatos públicos. Esto no verifica que el paquete macOS sea universal ni todos los requisitos que hoy declara la landing; revisar los artefactos y la configuración de empaquetado antes de reiterar esas afirmaciones. [Release comprobada](https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.3.2).

Mantener título, descripción, canonical, Open Graph y rutas de documentación. Probar los enlaces con el base path de GitHub Pages, no solamente con `/` en desarrollo.

## 7. Orden de implementación y aceptación

1. Reorganizar la página en los siete bloques, retirar el anuncio automático y reducir contenido repetido.
2. Unificar tokens, botones, tipografía y foco visible.
3. Construir la demo manual con los tres ejemplos y comprobar su fidelidad respecto al escritorio.
4. Añadir el guion automático, pausa, reinicio, movimiento reducido y suspensión fuera de pantalla.
5. Verificar móvil, descargas, documentación, estados y compilación de producción.

La aceptación requiere: una sola jerarquía de encabezados e IDs únicos; CTA de descarga visible desde el hero; ausencia de capturas repetidas en el recorrido; demo con controles útiles; ninguna conexión requerida al backend de escritorio; pausa y reinicio operables con teclado; UI móvil legible sin desbordamientos a 360, 390 y 768 px; contratos de privacidad y versión consistentes; enlaces de descarga comprobados; build y documentación válidos; y medición de rendimiento sobre el build de producción.

Esta auditoría no acredita conformidad WCAG completa ni tiempos de carga de producción. Sus hallazgos están basados en el código actual, navegación, DOM, colores y comprobaciones públicas descritas; la implementación deberá cerrar las verificaciones pendientes.

## 8. Implementación y verificación

Implementado el 2 de octubre de 2026 siguiendo la autorización posterior de usar la paleta de Openbot: fondo `#1a1a1a`, acción principal `#f0f0f0`, y descargas verde `#61c985`, violeta `#d6adf2` y arena `#e3b866`. Se conserva la identidad de Sparta. El recorrido queda en presentación, demo, tres ventajas, descargas, preguntas frecuentes y pie de página.

La demo es React con tres recorridos, selección de carpeta, compositor, envío local de un mensaje, panel de archivo, aprobación simulada, reproducción, pausa y reinicio. No realiza solicitudes a proveedores ni al backend. Se identifica como vista de la próxima versión con datos de ejemplo. El guion se suspende fuera de pantalla y al ocultar la pestaña; con movimiento reducido muestra el resultado sin reproducción automática. Esta última preferencia se verificó en el código, sin emularla en el navegador.

Se eliminaron 32 archivos de componentes/lógica antiguos y 18 recursos públicos sin referencias, además de Three.js y sus tipos. Se conservan las capturas referenciadas por README o documentación, la imagen social, los recursos de marca usados por documentación y sus vídeos.

Comprobaciones realizadas:

- `npm run build` y `npm run build:gh`: compilación TypeScript y producción correctas.
- `npm run docs:check`: 24 páginas, 16 enlaces internos y navegación completa.
- Navegador: reproducción, pausa, reinicio, los tres ejemplos, apertura/cierre de archivo, selección de carpeta, envío por Enter, aprobación manual y FAQ.
- Diseño a 360, 390 y 768 px: sin desbordamiento horizontal; revisión visual de escritorio y móvil.
- Build servido bajo `/Sparta-Agent/`: documentación, enlaces entre guías y regreso al sitio mantienen el prefijo. Se corrigió `build:gh` para usar ese base path explícito.
- Sin imágenes rotas en la landing ni errores de consola observados en la versión comprobada.
- El chunk de la demo pesa aproximadamente 12 kB, 4.16 kB con gzip; no se cargan capturas grandes ni vídeos en el recorrido principal. Es una medida del artefacto, no de Core Web Vitals ni latencia pública.

Capturas de verificación: `artifacts/landing-redesign/desktop.jpg` y `artifacts/landing-redesign/hero-demo.jpg`. No se publicó ni desplegó el cambio.
