# Pruebas pendientes y arranque en Electron

## Seis fallos resueltos

| Prueba | Causa y cambio |
| --- | --- |
| Dos aserciones de `code-tool-placement` | Leían la fachada del adaptador. Ahora comprueban el orquestador que construye la solicitud, conservando la separación entre ejecución local y sandbox del proveedor. |
| `gallery-item-menu-visibility` | Leía una página de imágenes eliminada. Se mantienen las comprobaciones de hover, teclado, touch y foco sobre el componente del menú. |
| `loaded-models-surface` | La expresión regular solo aceptaba tabuladores antes de las variables CSS. Ahora acepta espacios y tabuladores y sigue comprobando igualdad entre card y popover. |
| Guarda de lecturas en `native-drop-targets` | La comprobación esperaba un `return` sin llaves. Se adaptó a la forma actual del bloque. |
| Formatos en `native-drop-targets` | Dependía de un archivo Rust ausente. Ahora verifica el contrato de formatos del chat y su clasificación de archivos soportados y rechazados. No pretende probar enforcement nativo. |

## Defectos reales corregidos

El FileReader del selector de imágenes podía terminar después del desmontaje y llamar a `onChange`. Los errores de lecturas antiguas también podían generar un toast tardío. Ahora las lecturas web y los errores web/nativos comprueban que el selector siga montado y la selección siga vigente. `image-dropzone-lifecycle.test.ts` ejecuta los callbacks del componente con fronteras simuladas y reproduce selecciones sucesivas, errores actuales y finalización tras desmontaje.

La compilación independiente del frontend no definía `__SPARTA_VERSION__`. Compilaba, pero Electron mostraba una pantalla en blanco por un ReferenceError. Su configuración Vite ahora lee la versión del package.json raíz, igual que la distribución principal.

## Validación

- 167 pruebas seleccionadas del frontend aprobadas, incluidas las seis que fallaban y la nueva regresión del selector.
- 20 pruebas de contrato API-only y autenticación de Electron aprobadas.
- Compilación de producción del frontend y comprobación de tipos del proyecto correctas.
- Prueba con el ejecutable real de Electron, ventana oculta, perfil temporal y preload compilado desde el código actual: bienvenida, preparación, carga del logo, aislamiento de Node, rechazo IPC y recuperación de un fallo controlado aprobados; sin errores JavaScript del renderer.

Repetir con `npm run test:electron:smoke`. La prueba recompila el frontend y limpia su perfil temporal al terminar. Simula la frontera del backend; no instala componentes, consulta credenciales ni ejecuta un proveedor.

## Pendiente

El recorrido completo requiere backend y proveedor reales: enviar una cola, observar streaming y resultados, cancelar, cerrar y reabrir, recuperar pendientes y revisar permisos. El arranque verificado no sustituye esa prueba. Tampoco se declara aprobada toda la suite del repositorio ni el enforcement de una plataforma nativa ausente.
