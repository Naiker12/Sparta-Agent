# 25. Reglas de Importación y Separación de Capas (Main vs Renderer)

## Contexto y Diagnóstico
En arquitecturas de escritorio con Electron, Vite y Monorepos (pnpm workspace), el proceso **Main** (Node.js) y el proceso **Renderer** (React / Browser UI) se compilan con configuraciones de bundler independientes.

Si un archivo perteneciente a la capa Main (`desktop/ia-sparta-app-shell/src/electron-main.ts`, `ia-sparta-ipc-bridge`, `ia-sparta-chat-ipc`) importa un archivo barrel (`index.ts`) de un paquete mixto (`ia-sparta-providers`, `ia-sparta-core`, `ia-sparta-design-system`), el bundler (Rollup/Vite) intentará incluir todo el árbol de dependencias re-exportado en el barrel, incluyendo componentes `.tsx` y hooks que dependen de `react`.

Debido a que `react` está excluido del empaquetador del instalador (`!node_modules/**` en `electron-builder.config.cjs`), esto causa un fallo fatal `ERR_MODULE_NOT_FOUND: react` al ejecutar el ejecutable producido.

---

## Capas de la Arquitectura

| Capa | Ubicación | Acceso a React / UI | Uso de Barrels Mixtos |
|---|---|---|---|
| **Main Process** | `ia-sparta-app-shell/src/electron-main.ts`, `ia-sparta-ipc-bridge`, `ia-sparta-chat-ipc` | ❌ NUNCA | ❌ Prohibido barrel raíz |
| **Puro / Compartible** | `ia-sparta-core` (lib/utils/types), `ia-sparta-providers/src/transports`, `ia-sparta-platform` | ⚠️ Solo en submódulos de React | ⚠️ Debe importarse por submódulo interno |
| **Renderer / UI** | `ia-sparta-app-shell/src/main.tsx`, `ia-sparta-chat`, `ia-sparta-design-system`, `components/ui` | ✅ SIEMPRE | ✅ Permitido |

---

## Reglas Obligatorias

### Regla 1: Prohibido importar barrels mixtos desde el proceso Main
Cualquier archivo que forme parte del proceso Main debe importar directamente el submódulo de lógica pura:

```ts
// ❌ INCORRECTO en el proceso Main (arrastra React en cascada)
import { ChatCompletionsTransport } from 'ia-sparta-providers'
import { IGNORED_DIR_SET } from 'ia-sparta-core'

// ✅ CORRECTO (importa directamente la lógica o constantes sin UI)
import { ChatCompletionsTransport } from '../../ia-sparta-providers/src/transports'
import { IGNORED_DIR_SET } from '../../../ia-sparta-core/src/lib/filesystem-constants'
```

### Regla 2: Uso obligatorio de `import type` para interfaces y tipos
Si un archivo del proceso Main únicamente requiere tipos o interfaces definidos en `ia-sparta-core` o `ia-sparta-providers`, debe usarse explícitamente `import type`:

```ts
// ✅ Los imports de tipo son eliminados en la transpilación a JavaScript y no producen require/import en runtime
import type { ProviderVendor, ModelInfo } from 'ia-sparta-core'
```

### Regla 3: Verificación Automática en CI / Build
Se incluye el script `scripts/check-main-bundle.js` en el proceso de build. Si se detecta `react` u otra librería de UI en `dist-electron/electron-main.js`, el build fallará de forma inmediata.

### Regla 4: Definición de nuevos paquetes `ia-sparta-*`
Al crear un paquete en `desktop/`:
1. **Paquete Main-only:** No debe exportar componentes `.tsx` ni hooks en su barrel raíz.
2. **Paquete Renderer-only:** Puede incluir componentes y hooks libremente.
3. **Paquete Mixto:** Debe documentar claramente en su `README.md` la separación de submódulos para no ser consumido mediante el barrel raíz desde el proceso Main.

### Regla 5: Sincronización entre Vite y Electron Builder
Si se agrega una dependencia nativa de Node.js requerida en runtime por el proceso Main:
1. Declararla en `externalNodeModules` en `vite.config.ts`.
2. Incluir la excepción en `files` y `asarUnpack` en `electron-builder.config.cjs`.

### Regla 6: Orden de Inicialización IPC en `electron-main.ts`
1. Flags de Chromium (`app.commandLine.appendSwitch`).
2. Ajuste de entorno/PATH (`getEnhancedEnv`).
3. Inicio de Sidecar Python (`startSidecar`).
4. Registro de IPC de Seguridad Rust (`registerSecurityIPC`).
5. Creación de ventana (`createWindow`).
6. Registro de handlers IPC (`chat:send`, `filesystem`, `terminal`, etc.).
7. Sincronización final de claves e integración de pipeline (`waitForSidecarReady`, `pushAllKeys`).
