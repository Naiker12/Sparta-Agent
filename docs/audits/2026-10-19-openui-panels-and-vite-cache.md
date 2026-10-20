# Formularios, paneles y caché de Vite

Fecha: 2026-10-19. Continuación autorizada de la integración de OpenUI.

## Error de flushTapSync

Se verificó una discrepancia concreta: `desktop/frontend-spartan/node_modules/@assistant-ui/tap@0.9.22` exportaba `flushTapSync`, pero `node_modules/.vite/deps/@assistant-ui_tap.js` de la raíz todavía exportaba `flushResourcesSync`. La caché del frontend y la del Vite de Electron eran diferentes. No era necesario volver a la API retirada.

Se añadió `scripts/frontend-dependency-cache.mjs`: ambas configuraciones de Vite usan una ruta de caché derivada del hash del lockfile del frontend. El Vite de la raíz ya no depende únicamente de su propio lockfile para detectar actualizaciones de las dependencias anidadas. No se borraron recursivamente dependencias ni chats.

La prueba de migración de assistant-ui ahora monta el hook real de IME y utiliza la caché versionada. También se ajustaron tres scripts de prueba de navegador que asumían la ruta fija `/node_modules/.vite/deps`: ahora descubren la ruta optimizada del servidor.

Para una sesión de desarrollo que seguía abierta con la caché antigua, reiniciar `npm run dev` y recargar permite aplicar la nueva configuración. Las actualizaciones posteriores del lockfile seleccionarán otra caché automáticamente.

## Paneles compuestos por el modelo

Se registró `present_ui` como herramienta de presentación, disponible en rutas compatibles con herramientas de Spartan cuando **Respuestas visuales** está activado. Las rutas de generación de imágenes y de continuación no añaden esta herramienta. La instrucción al modelo indica cuándo usarla y evita repetir el panel como respuesta textual.

El contrato v1 permite combinar:

- Texto y encabezados.
- Métricas con etiquetas y valores explícitos.
- Tablas, que conservan el acceso al gráfico cuando sus datos lo permiten.
- Formularios con texto corto, texto largo, números, fechas, opciones y casillas.
- Distribución vertical o cuadrícula con adaptación al ancho disponible.

Es composición de componentes nativos de Spartan mediante OpenUI. No ejecuta HTML, JavaScript, comandos, URLs de envío ni nombres de herramientas proporcionados por el modelo. «Panel arbitrario» significa una combinación personalizada de estos componentes, no código ejecutable en el contexto de la aplicación.

Se validan el contrato y sus límites en backend y cliente: hasta 24 bloques, dos formularios, doce campos por formulario, identificadores únicos, listas de opciones acotadas, límites numéricos finitos y un tamaño total de 40.000 caracteres. Se rechazan componentes, campos y acciones desconocidos. Se conserva el texto alternativo y el historial existente.

## Envío de formularios

El botón **Enviar al chat** crea un mensaje del usuario con los valores estructurados. No escribe archivos, envía correos ni aprueba herramientas. Las acciones que el agente proponga después conservan los modos y permisos actuales.

El cliente vuelve a comprobar la conversación activa, el estado de ejecución y la validez de los datos justo antes de enviar. Se evita el doble envío mediante una guardia inmediata y la referencia persistida al mensaje, llamada de herramienta y formulario de origen.

Los valores enviados se conservan como metadatos del mensaje del usuario y se validan al restaurar la presentación. Las casillas falsas y el número cero no se pierden. El borrador de un formulario no enviado permanece en memoria al alternar entre presentación y texto; todavía no se persiste tras cerrar la aplicación. Los formularios ya enviados se muestran con sus valores y quedan deshabilitados en el historial restaurado.

El resultado completo de `present_ui` se conserva para la interfaz. Para el modelo se serializa un recibo compacto con el título, los identificadores de formularios y `externalActionExecuted: false`, evitando reenviar una segunda copia completa del panel. Esta reducción se aplica al resultado inmediato del backend y a la reproducción del historial en el adaptador.

## Validación realizada

- TypeScript del frontend y del proyecto completo: correcto.
- Compilación del frontend: correcta; conserva advertencias de tamaño de chunks e importaciones de canales.
- Suite frontend: **3.646 pruebas correctas**.
- Pruebas específicas de presentación y serialización tras los últimos ajustes: **12 correctas**.
- Prueba de invalidación de caché por cambio del lockfile: correcta.
- Prueba de navegador con el compositor IME real: primer envío, StrictMode, error parcial, cancelación y siguiente envío correctos, sin errores de página.
- Prueba de navegador de OpenUI: panel y formulario, validación de obligatorios, envío único, conservación de cero y falso, alternancia de vista sin perder borrador, reconstrucción del historial con valores y estado enviado, ausencia de solicitudes externas del panel. Se mantienen las pruebas de tablas, imágenes y carga fallida del módulo visual.
- Pruebas del backend de paneles, imágenes, controlador de herramientas y permisos: **1.739 correctas**. Después se añadió una comprobación del recibo compacto y se ejecutaron **40 pruebas** de paneles y controlador, todas correctas.
- Paridad de traducciones y revisión de espacios del diff: correctas.

La descarga bloqueada intencionalmente del renderizador en la prueba de fallback produce el diagnóstico esperado de React en desarrollo; el mensaje conserva la alternativa textual y no pasa a un error de generación.

No se hicieron llamadas a proveedores reales ni se publicó un nuevo instalador. Los modelos que no admiten las herramientas locales de Spartan conservan las respuestas de texto/tablas anteriores; no se fuerza un protocolo de herramientas sobre proveedores incompatibles.

## Cómo probar en Spartan

1. Reiniciar el servidor de desarrollo si estaba usando la caché anterior y recargar.
2. Activar **Ajustes → Chat → Respuestas visuales** y usar un modelo compatible con herramientas de Spartan.
3. Pedir un panel con métricas/tablas o un formulario para recoger los datos que falten.
4. Enviar los valores, comprobar el mensaje del usuario y revisar por separado cualquier permiso de acción externa que aparezca después.

Comandos de navegador: `npm run test:assistant-ui:browser` y `npm run test:openui:browser`. Caché: `node --test tests/frontend-dependency-cache.test.mjs`.
