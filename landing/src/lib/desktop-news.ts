export const desktopNews = {
  key: 'sparta_desktop_october_2026_seen',
  label: 'Próxima actualización de Desktop',
  title: 'Un escritorio más claro para trabajar con IA',
  description: 'Estamos preparando mejoras en el chat, las conexiones y el trabajo con carpetas. Estas novedades están en desarrollo y llegarán en una próxima versión del instalador.',
  features: [
    { title: 'Un chat que se adapta a tu espacio', summary: 'Mensaje arriba; carpeta, permisos, modelo y envío en una barra más ordenada.', details: ['El compositor se ajusta al ancho disponible cuando abres el panel de archivos.', 'Los nombres largos de modelos se abrevian sin perder su identificador completo.', 'Carpeta y permisos se compactan en pantallas pequeñas.'], docSlug: 'guides/first-task' },
    { title: 'Modelos y esfuerzo desde el chat', summary: 'Busca en el catálogo de tus proveedores y ajusta el razonamiento del modelo elegido.', details: ['Un selector reúne los modelos de las conexiones configuradas.', 'La búsqueda filtra por modelo y proveedor.', 'El esfuerzo muestra los niveles compatibles; máximo aparece cuando el modelo lo admite.'], docSlug: 'quickstart' },
    { title: 'Una carpeta y permisos para cada tarea', summary: 'Conecta el proyecto y elige cómo puede trabajar el agente con sus archivos.', details: ['La carpeta conectada permanece visible en el compositor.', 'Puedes elegir lectura, edición sin eliminar o edición según tu tarea.', 'Los controles de aprobación están junto al mensaje.'], docSlug: 'guides/first-task' },
    { title: 'Arranque y respuestas más estables', summary: 'Mejoras en la reutilización del motor instalado y en los errores del chat.', details: ['El arranque comprueba el motor instalado antes de pedir una preparación nueva.', 'Los hilos provisionales evitan consultas de archivos que todavía no existen.', 'Una respuesta interrumpida conserva el texto parcial y muestra el error en el chat.'], docSlug: 'quickstart' },
  ],
};

export const currentRelease = {
  version: '0.3.2',
  url: 'https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.3.2',
  windows: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.3.2/Sparta-Agent-Windows-0.3.2-Setup.exe',
  mac: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.3.2/Sparta-Agent-Mac-0.3.2-Installer.dmg',
  linux: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.3.2/Sparta-Agent-Linux-0.3.2.AppImage',
};
