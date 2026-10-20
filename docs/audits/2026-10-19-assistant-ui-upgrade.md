# Actualización de assistant-ui

Fecha: 2026-10-19. Alcance: actualizar la base de chat que utilizará la futura integración de OpenUI.

## Dependencias

| Paquete | Antes | Después |
| --- | --- | --- |
| `@assistant-ui/react` | 0.12.28 | 0.15.27 |
| `@assistant-ui/core` | 0.1.17 | 0.3.26 |
| `@assistant-ui/tap` | 0.5.10 | 0.9.22 |
| `assistant-stream` | 0.3.12 | 0.3.49 |
| Zustand, rango directo | ^5.0.11 | ^5.0.15 |

Se conservó React 19. El lockfile resuelve una sola versión de cada paquete de assistant-ui y `assistant-stream`. El paquete React de assistant-ui utiliza Zustand 5.0.15 compartido con la aplicación; XYFlow conserva su dependencia independiente de Zustand 4.

Se eligió 0.15.27 porque la instalación de 0.15.29 fue rechazada por el filtro de antigüedad del instalador. No se desactivó ese filtro ni se forzó la resolución de peers. Para superar un conflicto de resolución con entradas antiguas se regeneraron las entradas de assistant-ui y assistant-stream en el lockfile; npm resolvió y verificó posteriormente el árbol.

## Adaptaciones

- Los cuatro componentes que usaban el hook eliminado `useMessage` ahora leen `s.message` mediante `useAuiState`.
- `RemoteThreadListAdapter` y `useRemoteThreadListRuntime` sustituyen sus nombres experimentales retirados.
- El compositor y el manejo de IME usan `flushTapSync`, el nombre actual de la operación síncrona de tap.
- El script histórico `patch-assistant-tap.mjs` ya no modifica `node_modules`. Verifica la versión revisada: la biblioteca nueva incluye manejo de replay. Se conservó el nombre del script para no romper los comandos de instalación, desarrollo y build.
- La regresión de replay se adaptó al registro de cambios retenido por tap 0.9; comprueba que rebobinar y volver a confirmar no pierde el estado.
- La prueba del menú no modal admite el nuevo nombre interno `DropdownMenu` en el código compilado y sigue verificando que la propiedad se reenvía a Radix.
- Se añadió `npm run test:assistant-ui:browser`, con un fixture aislado y modelo simulado. No necesita proveedor ni modifica el historial real.

Se conservaron los cambios anteriores del usuario en el workspace y las correcciones previas del título y del indicador web. No se ejecutó un codemod masivo ni se modificó el formato del historial.

## Verificación

- `npm run typecheck` desde la raíz: correcto, incluye frontend y TypeScript del proyecto completo.
- `npm run build` en el frontend: correcto. Se mantienen avisos de tamaño de chunks e importaciones dinámicas inefectivas.
- Suite frontend: 3.634 pruebas ejecutadas, 3.633 correctas inicialmente; la única fallida comprobaba el antiguo nombre de importación de Radix. Después de adaptar esa comprobación, las dos pruebas del archivo afectado pasaron.
- `node --test tests/assistant-tap-replay.test.mjs`: correcto.
- `node scripts/patch-assistant-tap.mjs`: correcto, sin reescritura de archivos.
- Prueba en navegador Edge con React StrictMode: primer envío sin duplicados, texto renderizado, conservación de respuesta parcial ante error, cancelación y envío posterior correctos; sin errores de página.

La prueba en navegador usa el runtime local y un adaptador simulado. No certifica llamadas a proveedores reales, permisos de herramientas externas, persistencia completa ni el instalador empaquetado de Electron. Esas rutas requieren sus pruebas de integración al conectar OpenUI.

`npm audit` informa 43 hallazgos en el árbol completo. No se aplicó `audit fix` ni se mezclaron actualizaciones ajenas. El aviso de nanoid afecta ramas antiguas `<3.3.18`; assistant-ui/core actualizado usa la rama 6. La auditoría general de dependencias permanece fuera de esta migración.

## Estado de OpenUI

No se instalaron `@openuidev/assistant-ui` ni `@openuidev/react-lang`. El primer requisito del conector está satisfecho por assistant-ui 0.15, pero `@openuidev/assistant-ui@0.2.0` todavía declara Zustand ^4.5.5. Downgradear el store de Spartan introduciría otro cambio mayor y no resolvería las necesidades de assistant-ui actual.

Siguiente paso: probar el renderer con componentes propios o evaluar una versión del conector cuyos peers admitan Zustand 5. No instalar con `--force` ni `--legacy-peer-deps` para ocultar esa discrepancia.

Referencia oficial de migración: https://www.assistant-ui.com/docs/migrations/v0-15
