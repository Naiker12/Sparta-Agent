# Actualización del frame de la landing

El frame conserva la interfaz interactiva local y actualiza los cambios recientes del escritorio. No se publica ni se cambia la instalación de Windows.

- Se eliminan imports y dependencias Blobatar que apuntaban a archivos ya borrados. Se usa page-mascot 0.1.0 con el catálogo y las 116 hojas WebP del escritorio, sin descargar imágenes al navegar.
- Las cuatro categorías incluyen 58 mascotas. Perfil, barra lateral, bienvenida y estados del chat comparten la selección de la sesión. Se conservan foto personalizada, forma y movimiento reducido.
- Telegram separa Conexiones y Actividad. Un botón abre Configuración → Canales y permisos; los controles de perfil, proyecto y voz actualizan el resumen del bot de ejemplo.
- Automatizaciones permite simular inicio, progreso y final, con avisos Telegram identificados como ejemplo. Abrir chat conduce al resultado asociado a sparta-demo. No se simulan herramientas de archivo ejecutadas y se ocultan edición, regeneración y eliminación del resultado de automatización.
- Se usan los colores secundarios del tema para mejorar legibilidad de las tarjetas, y se amplían los campos de nombre y apodo.

Prueba de navegador: output/channels/landing-frame-smoke.mjs recorre mascota, categorías, permisos, actividad, ejecución, apertura del chat, carga de imágenes y ancho móvil. Capturas: output/channels/landing-frame-updated.png, landing-frame-automation.png, landing-frame-mobile.png.

Corrección de navegación: la barra principal contiene una sola entrada Canales, igual que app-sidebar.tsx. Telegram, Discord, WhatsApp y Slack se muestran dentro de la página Canales; los futuros canales abren un estado Próximamente. Se eliminan el desplegable y sus estilos antiguos. La prueba comprueba que la barra principal no contiene plataformas.
