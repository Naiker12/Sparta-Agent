# Mascotas de perfil y chat — 7 de octubre de 2026

## Resultado

Perfil, avatar lateral, saludo del chat (incluido el temporal) e indicador de generación utilizan la misma selección del perfil. Se elimina la rotación aleatoria del saludo. Cambiar la mascota actualiza estas vistas inmediatamente y conserva la elección al recargar, mediante el almacenamiento y la sincronización de personalización existentes.

El selector ofrece 58 opciones organizadas en animales, personas, robots y estilos. Conserva la subida de fotografías y las formas circular y redondeada. Los avatares anteriores de Blobatar se convierten de forma determinista a una mascota; las fotos y los recursos antiguos de perfil se conservan.

## Recursos y organización

- Componente React `page-mascot@0.1.0`, con carga diferida para el chat interactivo.
- Recursos locales en `desktop/frontend-spartan/src/assets/mascots`: 116 hojas WebP, aproximadamente 20,4 MiB, importadas por Vite mediante `mascot-assets.ts`. Ambos servidores y las compilaciones incluyen las mismas hojas. No necesitan un servidor externo durante el uso.
- Procedencia: [page-mascot de Koboyo](https://github.com/nilbuild/page-mascot), revisión `76a44ed9180063bf4852b9dd724b656f4a828ac7`. Se incluyen la licencia MIT y un registro de tamaños y hashes Git en `provenance.json`.
- Catálogo central en `mascot-catalog.ts`; representación en `MascotAvatar`; selección compartida para chat en `ProfileChatAvatar`.
- Las miniaturas son estáticas y de carga diferida; solo el saludo activa la interacción. Respeta la preferencia del sistema de movimiento reducido y utiliza etiquetas en español e inglés.
- El backend admite exclusivamente identificadores del catálogo `mascot:<personaje>`, además de los formatos de foto ya admitidos.

## Limpieza realizada

Se retiraron `blobatar-avatar.tsx`, `blobatar-avatars.ts`, las dependencias `@blobatar/react` y `blobatar`, y su importación de estilos de movimiento. El reemplazo del catálogo de propietarios conserva las imágenes reales y usa iniciales cuando faltan. Los recursos antiguos compatibles con perfiles guardados permanecen disponibles.

## Verificación

La compilación de producción y la paridad de traducciones pasan. Tres pruebas del frontend verifican las hojas locales, migración estable, fotos y rechazo de identificadores inválidos. La revisión con navegador comprueba cambio simultáneo en perfil/chat/lateral/generación, persistencia, movimiento reducido, categorías y ausencia de desbordamiento móvil. Hay capturas en `output/channels/profile-mascots-desktop.png` y `profile-mascots-mobile.png`.

Las 13 pruebas específicas del backend pasan de forma aislada con `--noconftest`, incluido el guardado y lectura mediante la API y la conservación de la mascota al actualizar solo el apodo. La revisión ESLint de los componentes de perfil y saludo no presenta errores; el saludo mantiene dos avisos existentes de Fast Refresh por exportaciones auxiliares. La suite normal del backend está bloqueada por una fixture compartida que importa el módulo ausente `core.inference.diffusion_prequant`. En la revisión previa de personalización apareció además una expectativa desactualizada sobre la navegación `train`, ajena a la selección de mascota.

## Corrección de rutas en escritorio

Se corrigió la resolución de recursos bajo `file://`: las hojas de mascotas y la imagen de respaldo se resuelven junto a `index.html`, evitando que Electron busque en la raíz del disco y muestre el logo en todas las opciones. La prueba de regresión cubre bases `/` y `./` en escritorio y rutas profundas de la versión web.

La comprobación de la ventana en desarrollo reveló otra causa: el servidor del shell (5173) sirve el `public` de la raíz, mientras las hojas estaban en el `public` del frontend. Por eso las peticiones devolvían HTML y se activaba el logo de respaldo. Las hojas ahora son importaciones explícitas de recursos mediante `import.meta.glob`, con URL generada por Vite, sin depender de esas carpetas públicas. La prueba `output/channels/mascot-shell-assets-smoke.mjs` verifica en navegador la carga de las 116 hojas desde el servidor real 5173; pasa, al igual que las cuatro pruebas específicas y la compilación.

## Pendientes de canales

Este cambio aborda las mascotas. Continúan pendientes el acceso al contenido de archivos no indexados y la conservación de conversaciones separadas por proyecto; no se consideran resueltos con esta integración.
