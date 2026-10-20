# Paneles independientes de chat

Implementación del 20 de octubre de 2026.

## Comportamiento

- Hasta cuatro conversaciones: la principal y tres paneles secundarios.
- Nuevo panel, apertura desde el menú del chat y arrastre con MIME específico.
- Un chat ya abierto recibe foco; no se abre otro escritor para ese mismo chat.
- Separadores redimensionables en escritorio y pestañas con teclado en móvil.
- Cada secundario tiene su modelo, borrador por thread, envío y cancelación propios.
- Cerrar conserva el historial y el borrador. El cierre se deshabilita durante la generación.
- Continuar en otro panel guarda una conversación independiente desde la rama visible.
- El chat principal conserva su árbol React al abrir, cerrar o enfocar secundarios.
- Las cabeceras comparten la fila de controles de escritorio; se reserva espacio
  para el botón de nuevo panel y el chat temporal, sin una franja vacía adicional.
- Un único explorador de archivos permanece en el extremo derecho y consulta el chat
  enfocado. Ya no queda dentro de la columna principal entre conversaciones.
- Los secundarios usan Thread, su bienvenida y su dock flotante con las mismas
  primitivas y superficie visual del compositor principal. Tienen adjuntos, carpeta,
  modelo y ajustes locales. La copia de contexto queda en el menú de la cabecera.
- El asa de la cabecera reordena secundarios sin crear chats ni remontar sus runtimes;
  los separadores de cinco píxeles permiten ajustar el ancho con el ratón.

## Aislamiento

El adaptador recibe un getter estable de configuración por panel. Captura sus parámetros
al comenzar cada envío y no consulta activeThreadId como destino alternativo. Las reservas
de envío tampoco adoptan las del principal. Los secundarios no ejecutan el sincronizador
de ajustes globales, incluyendo su efecto de limpieza cuando está deshabilitado.

El identificador pane: se usa únicamente para aislar runtimes y salidas de herramientas.
Los threads nuevos se guardan previamente como conversaciones base independientes, sin
pairId persistido. El modelo elegido se guarda antes de habilitar el siguiente envío.

La copia reasigna ids y padres, conserva mensajes de texto visibles e incorpora resultados
disponibles como referencias de texto inertes. Selecciona campos visibles de las respuestas,
sin volcar objetos JSON completos. Incluye fuentes públicas, nombres de archivos y extractos
de adjuntos cuando existen. Señala acciones pendientes y resultados con error. No importa
repositorios ejecutables, llamadas pendientes,
metadatos de formularios enviados, contenedores ni aprobaciones. Arranca con aprobación
obligatoria y sin una sesión de investigación activa. Los originales no se modifican.

Las eliminaciones del historial y el cierre de sesión limpian paneles. La apertura desde
otras vistas queda pendiente hasta montar el área de chat. Un enlace directo al principal
que coincide con un secundario vuelve inerte el principal para evitar dos compositores
escribiendo sobre la misma conversación.

## Alcance

Esta versión copia contexto textual y resultados como evidencia, sin transferir archivos
completos ni ejecuciones reproducibles. Las referencias tienen límites de 6.000 caracteres
por resultado, 12.000 por mensaje y 48.000 en total, priorizando los resultados recientes.
Las referencias recortadas llevan una indicación para consultar el original. El texto
normal de la conversación se conserva. Se excluyen imágenes binarias y sesiones de sandbox.
Los secundarios permiten adjuntos mediante el adaptador de su propio runtime. Los ajustes
de búsqueda, código, razonamiento y aprobación se guardan en su conversación. El compositor
principal conserva sus controles avanzados de cola y de investigación.
La lista y el orden de paneles secundarios y su selección se restauran al reiniciar;
los anchos vuelven a su distribución inicial. Las conversaciones y borradores también
quedan guardados. El layout local guarda únicamente ids, selección y versión, sin
mensajes, credenciales, permisos ni estado de ejecución.

La recuperación verifica cada conversación. Elimina referencias ausentes o archivadas,
conserva fallos de transporte para reintentar desde el botón o al recuperar conexión y
no inicia generaciones. El cierre de sesión borra el layout e invalida recuperaciones
en curso para impedir que una respuesta tardía vuelva a abrir paneles de esa sesión.

## Validación

- TypeScript y paridad de traducciones inglés/español.
- Cuatro pruebas unitarias de configuración por envío y copia independiente de contexto.
- Navegador con runtimes reales y backend/modelos simulados: arrastre, duplicados,
  borradores independientes, modelos distintos, dos envíos simultáneos, cancelación
  de uno sin cancelar el otro, copia sin alterar el original, cierre/reapertura con
  borrador, conservación del runtime principal y pestañas móviles con ancho completo.
- Regresión de primer envío: creación diferida, fallo de creación conservado, ausencia
  de auto-bloqueo y runtime montado al publicar el id guardado.
- Capturas de escritorio y móvil inspeccionadas. No se consumieron proveedores reales.
- Dos pruebas del formato persistido: versión, límite, duplicados, ids temporales,
  selección, contenido mínimo y almacenamiento bloqueado o sin cuota.
- Recarga real del navegador: orden, selección, borrador y ausencia de nuevos envíos;
  conversación eliminada, error 503 pendiente, recuperación manual y cierre de sesión
  durante una recuperación diferida.
- Siete pruebas de copia: inmutabilidad, resultados completados y pendientes, errores,
  permisos y campos internos excluidos, fuentes, adjuntos, paneles en texto, JSON de
  búsqueda, envoltorios de archivos/imágenes, límites y prioridad de evidencia reciente.
- La continuación recibe resultados y extractos en el payload de su primer envío;
  conserva el ajuste de aprobación obligatoria y no activa bypass, sin comandos
  anteriores ni identificadores de sesión copiados.
- Corrección visual comprobada en modo oscuro: títulos alineados con la barra existente,
  explorador único en el extremo derecho y bienvenida normal para un panel vacío.
- Ratón real en Playwright: separadores cambian el ancho y asas reordenan secundarios.
- Selector de archivo real con un TXT: el contenido llega al envío de alpha y no al
  de beta. Los adjuntos pendientes que se materializan al enviar no bloquean el botón;
  solo lo hace una carga activa, igual que en el compositor principal.
- Los secundarios comparten el host de vista previa del chat principal para evitar
  abrir varias copias de un mismo diálogo al previsualizar un adjunto.
