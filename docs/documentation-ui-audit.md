# Auditoría de componentes de documentación

Fecha: 2026-10-06. Cambios locales en `canales`; sin publicación.

## Referencias oficiales

- https://www.fumadocs.dev/docs/ui/components
- https://www.fumadocs.dev/docs/ui/components/codeblock
- https://www.fumadocs.dev/docs/ui/components/tabs
- https://www.fumadocs.dev/docs/ui/components/steps

Se contrastó la documentación actual con los componentes de la versión instalada. No se incorporaron dependencias nuevas.

## Hallazgos y cambios

| Área | Hallazgo | Aplicación |
| --- | --- | --- |
| Navegación | Lista extensa y nombres largos | Grupos nativos plegables, etiquetas breves e iconos; Telegram disponible y próximos sin enlaces ficticios |
| Lectura | Márgenes exteriores excesivos e índice pegado | Ventana utilizada por el layout; texto acotado y separación de columnas |
| Cabecera | Categoría repetida en breadcrumb y aviso superior | Retirada de la etiqueta duplicada |
| Código | Ejemplos sin título | Todos los bloques tienen encabezado; Shiki y copiar nativos, controles en español |
| Alternativas | Ejemplos repetidos verticalmente | Pestañas ES/EN en Canales y por superficie en Desarrollo |
| Procedimientos | Configuración MCP como párrafos separados | Steps y Step nativos con recorrido de conexión y prueba |
| Detalles | Párrafos de requisitos y privacidad extensos | Tablas, avisos y detalles plegables según su función |
| Movimiento | Evitar efectos que distraigan | Transiciones de color y borde, sin animaciones de entrada; preferencia de movimiento reducido respetada |

## Criterios para mantener la documentación

- Título de código: nombre de archivo, terminal o finalidad del ejemplo.
- Pestañas: opciones alternativas; no ocultar pasos obligatorios del mismo proceso.
- Pasos: recorridos ordenados con una comprobación final.
- Tarjetas: rutas de aprendizaje y comparaciones breves; no envolver cada párrafo.
- Avisos: limitaciones o requisitos concretos; evitar repetir advertencias.
- Tablas: comparaciones, estados y síntomas con acciones.
- Diagramas: flujos y fronteras de datos, con descripción textual.
- Animación: solo respuesta discreta a interacción y sin movimiento obligatorio.

## Comprobaciones

Las 30 páginas se revisaron en la auditoría editorial. Se comprobó el cambio de pestañas y el estado «Código copiado» en el navegador; no se ejecutaron los comandos de los ejemplos. Se revisaron tarjetas de código en escritorio y límites del documento en una ventana móvil, restaurando después el tamaño original.

La compilación de la landing y `docs:check` verifican MDX, tipos, catálogo y enlaces. Estas comprobaciones no prueban el runtime de Telegram ni las credenciales de proveedores de voz.
