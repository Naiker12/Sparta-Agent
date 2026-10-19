# Aplicación instalada: recursos y preparación de varios chats

## Fallo reproducido en 0.4.1

Se descarga el instalador publicado `Sparta-Agent-Windows-0.4.1-Setup.exe` y se inspecciona su `resources/app.asar`, sin instalarlo ni usar el perfil del usuario. Los logos de proveedores existen bajo `dist/provider-logos/`. No es un fallo causado por la ausencia de esos SVG, PNG o JPG.

Reproducción en Electron, con perfil temporal y sandbox: `./provider-logos/openai.svg` carga en `file:///.../app.asar/dist/index.html`. Después de navegar con historial de navegador a `/chat`, el documento pasa a `file:///C:/chat` y el mismo recurso relativo busca `file:///C:/provider-logos/openai.svg`: falla y el componente muestra el icono genérico de respaldo. Cambiar solo el SVG o el CSS no corrige esta causa.

La comprobación anterior del paquete verificaba entradas, versión y recursos backend, pero no este comportamiento después de navegar. Las pruebas HTTP de navegador no reproducían la semántica de `file://`.

## Corrección

- Electron con `file://` usa historial hash: conserva `index.html` y navega con `#/chat`. HTTP y otros protocolos conservan el historial de navegador.
- La lectura de ruta y query se centraliza para que autenticar, recuperar el hilo y crear proyectos lean la ruta lógica, no el nombre físico de index.html. Los redirects de autenticación conservan la recarga completa para reiniciar el estado de sesión.
- Los enlaces a secciones conservan la ruta del chat. Se comprueba volver atrás y recargar sin perder recursos ni parámetros.
- Los alias de proveedores locales usan también la normalización del logo para la inversión monocroma en tema oscuro.

## Inventario del instalador

De 66 archivos bajo el public del frontend, 34 no tienen su ruta pública en el ASAR publicado. Se incluyen los cuatro logos de agentes y recursos de perfiles del Hub. Algunas fuentes ya existen como assets con hash en el CSS: el dato no significa 34 funciones rotas.

El build raíz copiaba su propio public, pero no el public adicional del frontend. Ahora incorpora ambos. El verificador del paquete exige cada ruta pública en `dist/`, además de sus controles anteriores del renderer, proceso principal, versión y backend. Esto cubre archivos cargados por URL en tiempo de ejecución, que no forman parte del grafo de imports de JavaScript.

## Validación

`test:assets:electron` construye un ASAR y lo abre mediante `BrowserWindow.loadFile`, con perfil temporal, contextIsolation y sandbox. Renderiza el componente real de proveedores y usa el mismo historial que el router de producción. Comprueba 26 proveedores/alias, imágenes decodificadas, aliases monocromos, navegación, vuelta atrás, recarga, query de hilo/proyecto, anclas y redirección de autenticación con recarga. Se añade a CI Linux mediante xvfb.

Las pruebas de rutas cubren arranque frío, parámetros codificados, comportamiento HTTP y autenticación. En esta ronda pasan inicialmente 3.633 pruebas frontend, 84 pruebas raíz, tipos y lint raíz; el caso adicional de recarga de autenticación pasa también de forma dirigida. Se genera y valida un paquete Windows local con el inventario ampliado: 66/66 entradas del public del frontend presentes, frente a 32/66 del ASAR publicado. El CI del commit final se registra por separado.

El tag y los archivos públicos de 0.4.1 permanecen intactos. El arreglo debe distribuirse mediante una nueva versión de parche después de revisar el PR y sus comprobaciones. El paquete local no se ha publicado.

## Investigación: varios chats o paneles independientes

La comparación existente en `features/chat/components/compare-content.tsx` monta varios `ChatRuntimeProvider`, pero comparte compositor y usa roles fijos de comparación. No equivale a varios trabajos arbitrarios independientes.

El runtime conserva `activeThreadId`, selección de modelo y parámetros globales en `chat-runtime-store.ts`. Ya existen propietarios y cancelaciones por hilo (`runOwnerByThreadId`, `cancelByThreadId`, `serverCancelByThreadId`), que son una base útil. `runtime-provider.tsx` contiene lecturas de selección global y reglas de conversación visible; duplicar ChatPage sin aislarlas puede mezclar parámetros, herramientas, resultados y navegación.

Propuesta de primera etapa: dos paneles con identidad estable. Cada uno debe conservar su hilo, proyecto, proveedor, modelo, parámetros, borrador y desplazamiento. El foco del panel controla la UI global, pero no cambia la configuración capturada por una ejecución que ya trabaja. Las credenciales siguen en el almacén central y no se copian a la disposición guardada.

Antes de habilitar concurrencia deben verificarse:

1. Enviar dos tareas con instrucciones y modelos distintos sin contaminación cruzada.
2. Cancelar una sin detener la otra; no duplicar el envío al cerrar, ocultar o recuperar un panel.
3. Etiquetar cada solicitud de permiso con su tarea y carpeta. Mantener aprobaciones y resultados asociados a su request/run, incluso al cambiar el foco.
4. Mantener documentos, búsquedas, notificaciones, uso y errores asociados al hilo correcto. Una automatización no debe sustituir silenciosamente otro panel abierto.
5. Recuperar la disposición después de reiniciar sin volver a ejecutar mensajes. Limitar paneles y virtualizar historiales para controlar memoria y solicitudes.
6. Coordinar escrituras y operaciones Git si las tareas comparten carpeta; considerar worktrees separados para trabajos de código que necesiten aislamiento.

La implementación de paneles queda como trabajo separado. Primero debe validarse el escritorio instalado y después extraerse el estado de sesión que hoy presupone una única conversación principal.
