# Reorganización de la documentación

Fecha: 2026-10-02. Superficie: documentación pública de `landing`.

## Resultado

29 guías organizadas en siete secciones: proyecto, primeros pasos, conversaciones, herramientas, configuración, arquitectura y desarrollo. Se añadieron guías del espacio de trabajo, arquitectura general, entorno local, estructura del repositorio y alcance del proyecto.

La documentación utiliza el fondo oscuro de la landing, logotipo original monocromo y acentos violeta, azul, verde y arena. La navegación, búsqueda, paginación e índice están en español. La versión se obtiene de la misma fuente que la landing.

## Diagramas

Componentes React accesibles para arquitectura, recorrido del mensaje, tarea, permisos y MCP. El mapa distingue IPC, HTTP y ciclo de vida del backend; las API compatibles pueden ser remotas o estar alojadas por el usuario. Los diagramas se reorganizan en vertical en móvil.

## Revisión del alcance

La edición descrita es por API, conforme al README actual. Se corrigieron referencias a carga de modelos locales, hardware GPU y entrenamiento incorporado. La presencia de módulos históricos no se utiliza como prueba de disponibilidad. Las prioridades propuestas aparecen como dirección de mejora, sin promesas de fechas o lanzamientos aprobados.

## Mantenimiento

Las páginas MDX son la fuente de contenido; el catálogo de búsqueda se genera desde ellas. La navegación conserva los alias existentes. La búsqueda incluye el nombre de sección y normaliza acentos. No se cambió el runtime de escritorio ni del backend.

## Verificación

- `npm run docs:check`: 29 páginas, 39 enlaces internos y cobertura completa de navegación.
- `npm run build:gh`: TypeScript y compilación de producción bajo `/Sparta-Agent/`.
- Navegador local: navegación de guías, búsqueda y selección de resultado; fondo `rgb(26, 26, 26)`.
- Vista de escritorio y móvil: diagramas presentes, índice adaptable y sin desbordamiento horizontal de la página.

Estas comprobaciones cubren documentación y presentación. No son una validación funcional de todas las capacidades del producto ni una ejecución del backend contra proveedores reales.
