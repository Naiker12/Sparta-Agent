# Auditoría: creación de archivos de código y vista previa

Fecha: 21 de octubre de 2026. Repositorio: Sparta-Agent, versión declarada 0.5.3.

## Alcance y resultado

Se revisaron las siete capturas y el recorrido de selección de herramientas, generación de documentos, archivos del sandbox, vinculación de carpetas, tarjetas, lienzos HTML y navegador lateral. El diagnóstico inicial se conserva en las secciones 1–7. La sección 8 registra las correcciones implementadas posteriormente. No se ejecutó la aplicación instalada ni se dispone de los registros de las conversaciones de las capturas; no se atribuye a esas sesiones un resultado de red que no se haya observado.

El problema no se resuelve únicamente cambiando el prompt. Hay tres mecanismos de entrega distintos, con contratos incompatibles: documentos descargables, archivos escritos por herramientas y lienzos HTML extraídos de texto o `render_html`. La interfaz los presenta como si fueran equivalentes.

## 1. Hallazgos y prioridad

### P1 — La tarjeta HTML apunta a una descarga autenticada, no a un visor

Archivos: `desktop/frontend-spartan/src/components/assistant-ui/sandbox-files-view.tsx`, `desktop/frontend-spartan/src/components/assistant-ui/sandbox-files.ts`, `desktop/backend-spartan/routes/inference_pkg/router_sandbox.py`.

En `SandboxFileRow.handleOpen`, un `.html` o `.htm` termina en `navigateBrowser(apiUrl(sandboxFilePath(...)))`. A diferencia de `preview()` y `save()`, ese camino no hace `authFetch`, no refresca la sesión y no proporciona credenciales a la navegación.

El servidor exige cabecera Bearer o token en consulta. Un iframe no hereda la cabecera de `authFetch`. Además, incluso si se resolviera la autenticación, `serve_sandbox_file` publica HTML y CSS como `application/octet-stream` con `Content-Disposition: attachment` y `nosniff`. Esa ruta está diseñada para descargar, no para ejecutar HTML.

Consecuencia: abrir un archivo puede dar una respuesta 401, una descarga o una vista sin contenido útil. Es coherente con la captura 5; falta una traza de red para atribuir su resultado exacto.

Corrección: obtener el contenido con `authFetch`, comprobar tamaño y estado, y abrirlo mediante el visor aislado de artefactos. Mantener la ruta de descarga como descarga. No arreglarlo añadiendo un token al URL de una página que ejecuta código generado ni sirviendo HTML activo en el origen de la API.

### P1 — El navegador lateral evita el aislamiento ya implementado para los lienzos

Archivos: `desktop/frontend-spartan/src/components/workspace-rail/browser-preview-panel.tsx`, `desktop/frontend-spartan/src/features/chat/artifacts/html-frame.tsx`, `desktop/backend-spartan/routes/inference_pkg/router_artifacts.py`.

`BrowserPreviewPanel` usa `srcDoc={selectedArtifact?.code}` y `sandbox="allow-scripts allow-forms allow-same-origin"`. El visor `ArtifactHtmlFrame` ya ofrece un recorrido distinto: marco dedicado, origen opaco, política de red, comunicación validada y aviso de recursos bloqueados.

El panel lateral no aplica ese contrato. La combinación de scripts y mismo origen en `srcDoc` debilita el aislamiento del código generado. Debe eliminarse este segundo camino para artefactos y reutilizar `ArtifactHtmlFrame`. Un navegador de URLs y un visor de archivos generados requieren estados y políticas explícitos.

### P1 — Un artefacto seleccionado puede ocultar la URL que se intenta abrir

Archivo: `desktop/frontend-spartan/src/components/workspace-rail/browser-preview-panel.tsx`.

El iframe elige siempre `selectedArtifact?.code` antes que `previewUrl`. La barra y el historial reflejan `browserUrl`, pero el contenido puede continuar siendo el artefacto seleccionado. Por tanto, cambiar la URL no garantiza que esa sea la página mostrada mientras persista la selección.

Corrección: representar el destino con un estado exclusivo: artefacto, archivo o URL. La navegación debe cambiar ese destino; la selección de un artefacto no debe prevalecer silenciosamente sobre una navegación posterior. Probar atrás, adelante, recargar y cerrar/reabrir el panel.

### P1 — Falta una creación de archivos de texto/código independiente de ejecutar código

Archivos: `desktop/frontend-spartan/src/features/chat/api/code-tool-placement.ts`, `desktop/frontend-spartan/src/features/chat/api/chat-adapter/stream-orchestrator.ts`, `desktop/backend-spartan/core/documents/generation.py`.

`selectCodeToolNames` devuelve listas vacías con Código desactivado. Con ejecución local activa ofrece `python`, `terminal` y `edit_file`. Por otro lado, `generate_document` funciona sin Código, pero valida únicamente PDF, XLSX, DOCX, CSV, TXT y MD, prohíbe rutas y rechaza HTML/CSS/JS.

Así, sin carpeta vinculada y sin Código, pedir un archivo HTML no tiene una herramienta general de escritura equivalente al generador de documentos. Que el modelo rechace HTML en `generate_document` coincide con su contrato real. Pedirle que insista o habilitar Python automáticamente no corrige la ausencia de esa capacidad.

Corrección propuesta: añadir una herramienta limitada para crear archivos de texto en el almacenamiento del chat, sin ejecutar su contenido. Debe aceptar nombre, contenido y tipo, validar rutas/tamaño, escribir de forma atómica y devolver metadatos comprobados. Exponerla independientemente de Python/terminal en los proveedores que soporten herramientas propias. Para una carpeta vinculada, reutilizar `write_file` y sus permisos. No ampliar a ciegas el generador Office: tiene validadores y consumidores en otros canales.

### P2 — `render_html` y la creación de un archivo persistente son capacidades diferentes

Archivos: `desktop/backend-spartan/core/inference/tools.py` (`_render_html_result`), `desktop/frontend-spartan/src/components/assistant-ui/tool-ui-render-html.tsx`, `desktop/frontend-spartan/src/components/assistant-ui/message-html-artifacts.tsx`, `desktop/frontend-spartan/src/features/chat/artifacts/artifact-surface.tsx`.

`_render_html_result` confirma un lienzo; no escribe un archivo en la carpeta pedida. Los bloques HTML del mensaje también pueden convertirse en tarjetas después de terminar la respuesta. Una calculadora visible no demuestra que exista `calculadora.html` en Downloads/test.

Corrección: diferenciar en datos y texto «vista previa disponible», «archivo guardado en el chat» y «archivo guardado en carpeta». La tarjeta debe mostrar la ubicación real y permitir guardar/exportar. El asistente solo debe afirmar que guardó un archivo cuando reciba una escritura exitosa con destino verificable.

### P2 — Las capacidades de Canvas cambian entre modelos locales y externos

Archivo: `desktop/frontend-spartan/src/features/chat/api/chat-adapter/stream-orchestrator.ts`, alrededor de `renderHtmlToolEnabledForThisTurn`.

`render_html` requiere `!isExternalRequest`, soporte de herramientas, `artifactsEnabled` y ausencia de imagen saliente. Por tanto, un modelo externo usa el fallback aunque soporte otras herramientas de Spartan. `MessageHtmlArtifacts` puede extraer HTML al final, pero eso no crea el archivo ni garantiza una vista progresiva.

Corrección: documentar y unificar el contrato para proveedores compatibles con herramientas propias. Mantener un fallback para proveedores sin ese soporte y probar ambos. No confundir la ejecución alojada del proveedor con acceso al disco local.

## 2. Carpeta pegada en el mensaje: qué sucede realmente

Archivos revisados:

- `desktop/frontend-spartan/src/features/chat/utils/pending-workspace.ts`: reclama y materializa la carpeta pendiente para el chat correcto.
- `desktop/frontend-spartan/src/features/chat/api/chat-adapter/stream-orchestrator.ts`: calcula `workspaceEnabled` desde `threadWorkspace` y añade `WORKSPACE_TOOL_NAMES`, incluido `write_file`.
- `desktop/backend-spartan/routes/chat/router_workspaces.py`: valida y persiste la vinculación mediante la API de workspace.
- `desktop/backend-spartan/state/thread_workspace.py`: comprueba ruta canónica, identidad del directorio y nivel de acceso.
- `desktop/backend-spartan/core/inference/automation_workspace.py`: herramientas limitadas al workspace autorizado.

Una ruta escrita como texto no equivale a una vinculación persistida. En las capturas aparece «Trabajar en una carpeta», pero no el nombre de la carpeta elegida. Es un indicio de que no había vinculación; no es prueba suficiente para afirmar que falló el selector.

Además, «Acceso total» y «carpeta vinculada» son dimensiones distintas. El primer control no selecciona una carpeta ni mueve una ejecución alojada a Windows. Para ejecución genérica, `resolve_writable_thread_workspace` exige acceso `write`; excluye intencionalmente `write_no_delete` porque un intérprete arbitrario podría borrar archivos. Conservar esta diferencia.

Mejora propuesta: detectar una ruta local en una petición de guardado y ofrecer una acción concreta para vincularla cuando aún no exista vinculación. Mostrar el destino vigente antes de generar y en la tarjeta final. Si ya existe permiso y vinculación, escribir mediante las herramientas disponibles. Si el destino no está disponible, comunicar el motivo concreto: falta de vínculo, solo lectura, carpeta desaparecida, ejecución remota o error real del sistema. Evitar respuestas genéricas «no puedo acceder» sin un resultado que las sustente.

## 3. HTML con CSS, JavaScript e imágenes en archivos separados

La apertura directa de `index.html` por la ruta actual no resuelve un proyecto web. Los recursos relativos deben conservar su directorio, autorizarse y servirse con tipos correctos. La ruta de sandbox sirve CSS/JS como adjuntos y no aporta credenciales a cada subrecurso. Copiar el HTML a `srcDoc` tampoco resuelve por sí solo `styles.css`, `script.js` o imágenes relativas.

Opciones de implementación:

1. Para un documento autocontenido, usar el marco aislado existente y CSS/JS embebidos.
2. Para varios archivos, construir un bundle de vista previa con resolución de rutas dentro de su raíz o usar un servidor de preview aislado con acceso limitado a ese proyecto.
3. Mantener el código fuente y los archivos originales separados del bundle de visualización. La vista previa no debe modificar silenciosamente lo guardado.

Rechazar traversal, enlaces fuera de la raíz y acceso a archivos del backend. Probar rutas anidadas, espacios, Unicode y referencias ausentes. Mostrar errores de carga y recursos faltantes; una pantalla blanca no debe ser el único resultado.

## 4. UI y animaciones propuestas

La raíz declara `framer-motion` y el frontend declara `motion`; para componentes del frontend conviene reutilizar `motion` según los patrones existentes. Esta propuesta no requiere añadir otra biblioteca ni generar un video.

Ya existen shimmer CSS, Skeleton y Spinner en `tool-ui-document.tsx`, `artifact-card.tsx`, `artifact-surface.tsx` e `index.css`. La solución debe consolidar esos recursos en lugar de sumar indicadores independientes.

Propuesta de tarjeta común para archivos y lienzos:

- Nombre, extensión, ubicación real y acciones con etiquetas accesibles.
- Estados basados en eventos: preparando contenido, escribiendo, validando, listo, error o cancelado. No inventar porcentajes ni estados que el backend no emite.
- Durante la escritura, skeleton estable; al completarse, transición breve de opacidad y posición con Motion. Mantener dimensiones para evitar saltos del chat.
- Acciones diferenciadas: Vista previa, Código, Descargar y Mostrar en carpeta cuando proceda. CSS/JS deben abrir un visor de texto/código en lugar de depender de un visor Office genérico.
- Error visible y recuperable con reintento; no mostrar «Página web creada» solo por detectar una extensión HTML.
- Respetar reducción de movimiento, foco de teclado y anuncios `aria-live` sin repetir cada fragmento transmitido.

Problemas concretos de la UI actual:

- `isHtmlFile` usa `endsWith` sensible a mayúsculas: `.HTML` no recibe el mismo tratamiento que `.html`.
- `SandboxFileRow` es un `div` con rol de botón y contiene el botón Descargar. Su `onKeyDown` no comprueba el origen del evento: Enter/Espacio desde el botón hijo puede activar también la apertura de la tarjeta. Separar controles y probar teclado.
- El texto secundario HTML se basa en la extensión, sin comprobar que el contenido sea válido o la vista funcione.
- El navegador solo limpia carga con `onLoad`; no ofrece un error útil de autenticación, descarga o dependencia ausente. Un `onLoad` de iframe no confirma que la aplicación interna haya renderizado correctamente.
- La barra muestra un candado incluso en HTTP; usar indicadores que correspondan al destino real.
- Hay tarjetas distintas para sandbox y artefactos, con acciones y tamaños diferentes. Compartir la presentación sin borrar las diferencias de persistencia y permisos.

## 5. Plan de cambios por archivo o módulo

| Área | Cambio propuesto | Criterio de aceptación |
| --- | --- | --- |
| `core/documents` o nuevo módulo de archivos de texto | Escritura limitada y atómica sin intérprete | HTML/CSS/JS creados con Código apagado |
| `core/inference/tools.py` y registro de herramientas | Esquema, ejecución y resultado de la nueva herramienta | Resultado solo tras escritura real; límites y cancelación |
| `stream-orchestrator.ts` y `token-counting.ts` | Disponibilidad coherente y conteo del mismo esquema | No exigir Python para guardar texto; respetar capacidades del proveedor |
| `chat-adapter/prompt-assembly.ts` y `multimodal-detection.ts` | Instrucciones de destino y diferencia entre lienzo/archivo | No afirmar acceso o guardado sin evidencia |
| `pending-workspace.ts`, chip y API de workspace | Mostrar vínculo y fallos de materialización | Primer mensaje escribe en la carpeta correcta cuando está vinculada |
| `sandbox-files-view.tsx` | Lectura autenticada, errores, extensión normalizada y controles separados | Abrir HTML no navega al endpoint de descarga |
| `browser-preview-panel.tsx` y workspace store | Destino exclusivo y renderizado aislado | URL, archivo y artefacto no se ocultan mutuamente |
| `artifacts/html-frame.tsx` | Reutilizar el aislamiento y añadir contrato de recursos si corresponde | HTML interactivo sin acceso al origen privilegiado |
| Servicio de bundle/preview | Resolver proyectos con varios archivos | CSS, JS e imágenes relativos cargan correctamente |
| Tarjetas de documento, sandbox y artefacto | Presentación común, estados reales y Motion | Menos saltos; acciones consistentes y accesibles |
| Locales `es`/`en` | Mensajes específicos y nombres de acciones | Sin términos internos como explicación principal al usuario |

Orden recomendado: corregir apertura y aislamiento; añadir creación de texto independiente; aclarar destino/workspace; resolver bundles; unificar UI y animaciones. Cada etapa debe conservar los límites de acceso existentes.

## 6. Verificación realizada y límites

Comando ejecutado desde `desktop/frontend-spartan`:

```powershell
node --import ./tests/helpers/frontend-alias-register.mjs --experimental-strip-types --test tests/code-tool-placement.test.ts tests/artifact-frame-network-access.test.ts tests/document-preview-tabs.test.ts tests/sandbox-reveal-path.test.ts
```

Resultado: 47 pruebas aprobadas, 0 fallidas. Verifican selección de herramientas, política de red del visor de artefactos, pestañas de documentos y rutas de revelado. No demuestran que el iframe del navegador pueda abrir un archivo HTML: precisamente falta esa cobertura integral. No se ejecutaron pruebas Python, compilación completa ni validación visual de Electron en esta auditoría.

Pruebas que deben acompañar la implementación:

1. Pedir una calculadora HTML con Código apagado: archivo real, tarjeta y preview interactivo.
2. Guardar en carpeta vinculada con Código apagado usando `write_file`; verificar bytes y destino.
3. Ruta pegada sin vínculo: explicación específica y acción de vinculación; no afirmar guardado.
4. HTML + CSS + JS separados, subcarpetas e imágenes: preview y exportación coherentes.
5. Sesión expirada: renovar credenciales o mostrar error; nunca dejar un panel vacío.
6. Archivo inexistente, vacío, grande, HTML inválido y extensión `.HTML`.
7. Seleccionar artefacto y navegar a otra URL: el destino y la barra coinciden; atrás/adelante funcionan.
8. Contenido generado intenta acceder al padre, API o almacenamiento: conservar aislamiento y política de red.
9. Cancelación y reintento: no publicar éxito ni duplicar tarjetas; conservar archivos existentes.
10. Teclado sobre Descargar: no abre el archivo; foco estable y reducción de movimiento respetada.
11. Modelo externo con y sin herramientas propias, y ejecución alojada: comunicar dónde viven realmente los archivos.

## 7. Lectura de las capturas

| Captura | Observación | Explicación sustentada |
| --- | --- | --- |
| 1 | Código, lienzo y navegador simultáneos; instrucciones para guardar manualmente | Mostrar HTML no prueba persistencia; existen dos superficies de preview |
| 2 | Python ejecutándose para crear calculadora | La escritura por intérprete depende de Código; falta capacidad limitada independiente |
| 3 | Archivo único HTML y explicación de copiarlo a Downloads/test | El archivo del chat y la carpeta solicitada son destinos diferentes |
| 4 | Se pide copiar HTML/CSS manualmente | No hay evidencia de escritura en carpeta vinculada |
| 5 | Tarjetas HTML/CSS y panel vacío con URL de sandbox | La apertura usa una ruta autenticada de descarga, incompatible con el iframe actual |
| 6 | Se explica que `generate_document` no admite HTML/CSS | Coincide con los formatos y validación de la herramienta actual |
| 7 | Se pegó una ruta y el modelo terminó entregando código | Pegar la ruta no habilita workspace; no se puede determinar el error exacto de las dos actividades sin sus resultados |

Para cerrar el diagnóstico de la versión instalada faltan los resultados de herramienta de esas conversaciones y su traza de red. El código revisado ya permite definir correcciones concretas sin atribuir al modelo o al sistema operativo fallos no comprobados.

## 8. Implementación y verificación posterior

Se corrigió el flujo en el repositorio:

- `generate_document` ahora guarda también archivos fuente completos como UTF-8 sin ejecutarlos. Se reutiliza su registro, políticas, tarjetas y validación existentes para evitar una segunda herramienta de escritura con contratos duplicados. Las validaciones PDF/Office se mantienen. Se conservan archivos existentes y cancelación; se rechazan rutas y nombres reservados de Windows. El título y las tablas nunca se agregan al código fuente.
- La respuesta de generación comunica el directorio real. Las instrucciones del frontend y backend distinguen el almacenamiento activo, la carpeta vinculada y una ruta pegada como texto. Para escribir contenido en el workspace se recomienda `write_file`; `create_file` solo crea archivos vacíos/directorios. No se habilita Python automáticamente.
- La estimación local de tokens incluye las herramientas de generación que se ofrecen aunque Código esté apagado.
- Abrir HTML usa `authFetch`, incluidos los recursos relativos. Ya no navega al endpoint de descarga. Los límites son 25 MB en total y 100 recursos por preview. El bundle se construye en memoria y entra por `ArtifactHtmlFrame`, conservando su aislamiento y política de red.
- El bundle admite CSS local, importaciones CSS entre comillas, JavaScript clásico, imágenes y fuentes referenciadas por CSS. Respeta el directorio de cada dependencia; rechaza escapes de raíz, ciclos y dependencias ausentes. Los scripts clásicos `defer` se colocan al final del documento preparado para que encuentren el DOM. No se modifica ningún archivo guardado.
- `ChatArtifact` separa `code` original de `previewCode`. Código, copiar y descargar conservan el original y su nombre; solo el iframe recibe el bundle.
- El navegador de URLs deja de consumir la selección global de artefactos: una navegación ya no puede quedar oculta por un lienzo anterior. Se eliminan `srcDoc` y los privilegios de mismo origen de ese panel. El campo URL ya no requiere un efecto que duplique estado y el candado solo aparece para HTTPS.
- Las tarjetas separan los botones de abrir, código y descargar, anuncian preparación, muestran tamaño y acceso a la carpeta real. Reconocen `.HTML` y `.HTM`. La entrada usa Motion con respeto por reducción de movimiento. Continúan usando el shimmer/skeleton existente mientras se genera el contenido.

Verificación realizada después de los cambios:

- Backend: 52 pruebas aprobadas de generación, guía de herramientas y workspace de chat. Incluyen 18 extensiones fuente, preservación byte a byte de Unicode/CRLF y ausencia de ejecución, además de documentos existentes.
- Frontend: pruebas de selección de herramientas, rutas, aislamiento, documentos y origen de artefactos aprobadas. Se añadieron pruebas de separación entre fuente/bundle y de nombres de exportación.
- TypeScript del frontend aprobado.
- Lint de los componentes principales corregidos aprobado. La comprobación ampliada sigue señalando problemas anteriores en `stream-orchestrator.ts` y `artifact-surface.tsx`; no se presenta como un lint global limpio.
- Navegador real con Edge/Playwright: apertura desde una respuesta `attachment` autenticada, CSS y su importación, JavaScript funcional, SVG, aislamiento respecto al padre, rechazo de recursos faltantes/ciclos/escape/tamaño y navegación posterior a otra URL aprobados. Comando reproducible: `npm run test:source-files:browser`. Usa el HTML real del marco del backend con transporte y archivos simulados; no llama a un proveedor LLM.

Limitaciones que permanecen explícitas:

- El preview estático no transpila TypeScript ni empaqueta aplicaciones con módulos JavaScript. Los scripts locales `type="module"` y las imágenes locales con `srcset` producen un error explicativo y requieren el preview de proyecto; no dejan una pantalla blanca ni amplían permisos.
- Las referencias de red siguen sujetas a la política existente del visor. Guardar un archivo no concede acceso a Internet ni ejecuta ese archivo.
- Pegar una ruta no sustituye la vinculación de carpeta. Este cambio conserva el control de permisos existente.
- No se recompiló ni sustituyó la aplicación instalada, y no se verificó una conversación real con el modelo de las capturas.

## 9. Pantalla en blanco al arrancar desde la raíz

El arranque real con `npm run dev` reprodujo `A React Element from an older version of React was rendered` antes de dibujar la interfaz. La raíz tiene React/React DOM 18.3.1 y el frontend anidado 19.2.5. Las pruebas anteriores abrían el frontend con su propio Vite y no detectaban esta mezcla en la configuración raíz de Electron.

Se fijó la resolución de `react` y `react-dom` en ambos archivos Vite hacia la instalación que pertenece al frontend. Esto incluye los subpaths `react/jsx-runtime`, `react/jsx-dev-runtime` y `react-dom/client`, también cuando los importa una dependencia instalada en la raíz. No se eliminaron datos, chats ni configuración del usuario.

La nueva prueba `npm run test:react-runtime` carga ambas configuraciones reales y comprueba esas resoluciones desde código del frontend y dependencias raíz. Aprobada. El servidor de desarrollo y la ventana en blanco se reiniciaron para abandonar la optimización anterior que había dejado de responder. Tras regenerar dependencias, Playwright abrió la aplicación completa desde el Vite raíz en `http://localhost:5173`: la bienvenida «Tu espacio de trabajo local» y el botón «Entrar a Sparta» renderizaron sin errores JavaScript. Se inspeccionó la captura `startup-react-fixed.png`. Esta comprobación usa la página de arranque completa; no sustituye una conversación con el backend/proveedor.

## 10. Dos paneles de vista previa simultáneos

Una captura posterior mostró el lienzo HTML junto al navegador lateral vacío. La corrección anterior cerraba el navegador únicamente desde la tarjeta de archivos del sandbox; los bloques HTML y `render_html` abrían el lienzo por otra entrada. Los dos stores conservaban selecciones independientes.

Se trasladó la coordinación a `openArtifact` y a las acciones de apertura del workspace. Cualquier lienzo cierra el navegador lateral; navegar o abrir la pestaña del navegador cierra el lienzo visible sin borrar su contenido. Se mantienen el historial y el explorador de archivos del proyecto. El navegador comienza sin URL, en lugar de intentar cargar `http://localhost:4200` de forma predeterminada.

Se añadieron ocho pruebas de coordinación, incluidas todas las acciones de apertura, conservación del artefacto/historial y explorador. Junto a las nueve pruebas de origen y exportación de artefactos: 17 aprobadas.

## 11. Redirección global que reemplazaba el lienzo por un navegador vacío

La siguiente captura permitió encontrar una segunda causa en `hooks/use-workspace-relay.ts`: el provider global observaba la selección de HTML y abría el navegador con `http://localhost:4200`, aunque el lienzo no correspondiera a ningún servidor. Con la coordinación del apartado 10, esa apertura incluso cerraba el lienzo correcto. Se eliminó el hook y su montaje en `app/provider.tsx`. El helper imperativo conserva únicamente la navegación hacia una URL explícita.

La prueba de coordinación incluye ahora el montaje global: comprueba que el provider no registre el relay antiguo y que este no fabrique URLs ni observe artefactos. Nueve pruebas de coordinación aprobadas. La prueba de navegador sigue comprobando alternar entre URL y lienzo y mostrar solo un iframe.

El navegador tiene una cabecera más compacta y un campo URL con nombre accesible y placeholder. Sin URL, explica cómo introducir una dirección o abrir un archivo del chat. Al navegar muestra carga; ante un evento de error o 15 segundos sin evento de carga muestra ayuda y Recargar. Si la navegación se completa después, retira el aviso. La prueba de navegador simula demora, adelanta el reloj y verifica el aviso y la recuperación. Un evento `load` de un iframe de otro origen no permite determinar su código HTTP ni leer su contenido: no se presenta esa señal como validación de la página remota.

## 12. Causa comprobada del HTML vacío en Electron: CSP de la página principal

Se consultó directamente el backend de la sesión de escritorio: `/api/inference/artifact-preview-frame` respondió HTTP 200 y entregó el marco correcto. Al incrustarlo bajo la CSP real de `index.html`, Chromium reprodujo: `Framing 'http://127.0.0.1:…/' violates ... "default-src 'self'"`. La política de la página principal no tenía `frame-src`: el puerto distinto del backend hacía que el iframe se bloqueara antes de poder recibir HTML. Las pruebas anteriores del visor usaban una página de fixture sin esa CSP y no cubrían este límite entre orígenes. El ajuste de sincronización del apartado anterior no resolvía este bloqueo.

Se añadió `frame-src 'self' http: https: blob:` a `index.html` para permitir el visor servido por el backend y las URLs explícitas del navegador. Se mantienen `object-src 'none'`, el sandbox del iframe sin privilegios de mismo origen y la CSP restrictiva propia del contenido generado; no se habilita acceso de red para el HTML ni se incluyen tokens en su URL.

La nueva prueba `tests/artifact-live-backend.browser.mjs` usa la política padre leída de `index.html` y el backend real, sin simular su respuesta. Verificó HTML visible, CSS aplicado, botón JavaScript funcional y denegación de acceso al documento padre. Comando: `npm run test:preview:live -- http://127.0.0.1:PUERTO`. Se ejecutó contra el puerto de la sesión actual y aprobó. El puerto es dinámico y no se fija en la aplicación.
