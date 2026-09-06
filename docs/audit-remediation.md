# Correcciones de la auditoría técnica

Base revisada: `845c9905669b41e38d75d05a790467512f89959b`.

## Etapa 1: acceso y decisiones

- **A01:** las dependencias protegidas rechazan credenciales ausentes. También se corrigieron `/login` (verificación de contraseña), `/refresh` (consumo y rotación del token real), `/status` (estado persistido) y la firma con un secreto fijo cuando no existía el usuario. Las sesiones se vinculan al secreto verificado para respetar una rotación concurrente.
- **Escritorio:** `desktop_bootstrap.py` crea el secreto local y lo entrega por stdout al proceso padre. Electron filtra esa línea de los diagnósticos, mantiene el secreto en memoria y lo intercambia exclusivamente con su backend de loopback. El IPC solo entrega tokens de sesión a la ventana principal y al origen configurado del renderer. StartupGate espera la autenticación; las peticiones rechazadas pueden recuperar la sesión mediante el mismo puente.
- **A03:** `useT()` se ejecuta antes del retorno por ajustes pendientes. Las infracciones de reglas de hooks pasan a ser errores de lint. `useCatalogTemplate` se renombró como `applyCatalogTemplate`, pues no es un hook.
- **A05:** la terminal conserva el comando, estado, salida y archivos. No oculta automáticamente comandos de instalación; durante la aprobación fuerza visible el detalle.
- **Pruebas:** se normalizaron CRLF en la lectura de código de las pruebas existentes de VRAM. Las nuevas regresiones de autenticación e interfaz se añadieron al CI; esto no incorpora todavía la suite completa del producto.

## Verificación local

- `npm run typecheck` y `npm run lint`.
- `npm test`: 9 casos, incluidos intercambio de credenciales y montaje de componentes en Chrome.
- Frontend: `vram-budget.test.ts`, `backend-preflight-message.test.ts` y `desktop-app-version.test.ts`: 38 casos.
- Python con `--noconftest`: `test_auth_access_boundary.py` y `test_credential_rotation_race.py`: 26 casos.
- Selección existente de `test_desktop_auth.py`: 7 casos de login, refresh y consumo de tokens; 41 deseleccionados.
- Build Vite de renderer, main y preload; verificador de dependencias del bundle principal.

Las pruebas de interfaz montan los cuerpos de los componentes reales con React y servicios controlados; no arrancan la aplicación Electron completa. Las pruebas Python usan SQLite temporal y rutas FastAPI reales, sin cargar inferencia ni GPU. El build mantiene avisos sobre chunks grandes y dependencias circulares. No se generaron instaladores ni se verificó una instalación remota real.

## Trabajo pendiente

1. A04: permitir lectura/edición/relectura sin perder la prevención de bucles.
2. A02: clasificar la suite completa y conectar sus pruebas válidas y smoke tests de aplicación al CI.
3. A06–A11 y A13: cerrar contratos heredados, persistencia, terminal y ciclo de vida del runtime. El buffer de arranque se acotó al introducir el intercambio, pero todavía falta el timeout y el cierre completo de procesos.
4. A12 y A14: presupuesto del bundle, exportación/restauración y conservación de datos al desinstalar.
5. Checkpoints, contexto de proyecto y tareas reanudables después de estabilizar el ejecutor.

Esta etapa no certifica la seguridad de todos los endpoints ni da por completada la auditoría.
