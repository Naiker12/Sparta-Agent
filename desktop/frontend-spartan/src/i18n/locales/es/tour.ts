export const tour = {
  badge: "recorrido guiado",
  quickTour: "Recorrido rápido",
  defaultBody: "Te orientamos paso a paso.",
  skipTour: "Omitir recorrido",
  skip: "Omitir",
  back: "Atrás",
  next: "Siguiente",
  done: "Listo",
  tip: "Consejo: `Esc` omite. El recorrido bloquea clics para que puedas leer.",
  chat: {
    welcomeTitle: "Bienvenido a Spartan",
    welcomeBody: "Conoce la aplicación en 12 pasos. Puedes omitir este recorrido y volver a abrirlo cuando quieras desde tu menú de usuario → Recorrido guiado. No enviaremos mensajes ni cambiaremos tus ajustes.",
    navigationTitle: "Tus conversaciones, siempre a mano",
    navigationBody: "La barra lateral reúne tus chats recientes, la búsqueda y las secciones de Spartan. Abre una conversación para retomar su historial; cada chat conserva sus propios ajustes.",
    projectsTitle: "Organiza el trabajo en proyectos",
    projectsBody: "Agrupa conversaciones relacionadas en Proyectos. Cuando conectas una carpeta, puedes consultar sus archivos y trabajar con ellos según los permisos del chat. Crear o abrir un proyecto no reorganiza tus archivos por sí solo.",
    workspaceTitle: "La carpeta de este chat",
    workspaceBody: "Aquí aparece la carpeta conectada a esta conversación. Puedes elegirla, cambiarla o desconectarla. Si es un repositorio Git, también verás su rama y podrás revisar los cambios. Cada panel conserva su propia carpeta.",
    permissionsTitle: "Tú decides qué puede hacer la IA",
    permissionsBody: "Revisa el modo de aprobación antes de pedir cambios en archivos o ejecutar herramientas. Los modos de aprobación y Acceso total tienen alcances distintos; lee sus avisos y elige el que necesites. Una respuesta en el chat no equivale a una acción ejecutada.",
    searchTitle: "Búsqueda e investigación",
    searchBody: "Activa Buscar para permitir consultas en internet cuando el modelo y la conexión lo admitan. La actividad muestra el progreso; comprueba las fuentes de la respuesta. Desde el menú + también puedes acceder a investigación cuando esté disponible.",
    panelsTitle: "Varias conversaciones a la vez",
    panelsBody: "El botón + de la cabecera abre un chat en otro panel. Puedes abrir chats existentes, arrastrar sus cabeceras y ajustar el ancho. Cada panel tiene su modelo y compositor; Continuar en otro panel copia el contexto sin compartir la ejecución ni los permisos.",
    activityTitle: "Actividad compacta y verificable",
    activityBody: "Cuando la IA usa herramientas, verás un resumen de Actividad. Empieza contraído: púlsalo para consultar las operaciones, sus resultados o errores y vuelve a pulsarlo para ocultarlo. Las solicitudes de aprobación permanecen visibles hasta responderlas.",
    visualsTitle: "Respuestas visuales e interactivas",
    visualsBody: "Además del texto, Spartan puede presentar tablas, tarjetas, formularios y otros paneles visuales cuando el modelo los genere. Completa un formulario y envíalo al chat para continuar. Ver como texto permite consultar su representación alternativa.",
    finishTitle: "Todo listo para empezar",
    finishBody: "Elige tu modelo, revisa la carpeta y los permisos y escribe tu primera tarea. Puedes adjuntar archivos o dictar desde el compositor. Si necesitas recordar alguna función, abre de nuevo Recorrido guiado en tu menú de usuario.",
    modelTitle: "Elige un modelo",
    modelBody:
      "Elige un modelo habilitado en tus conexiones de proveedores. La respuesta usa el modelo seleccionado para este chat; otros paneles pueden usar modelos distintos. Si no aparecen modelos, revisa tus conexiones en Ajustes.",
    modelTabsTitle: "Buscar un modelo",
    modelTabsBody:
      "Busca modelos de Sparta o pulsa en Buscar en el Centro para ver todo Hugging Face. Alterna entre Recomendados y En dispositivo, filtra por formato y ordena por tendencias o recientes. La etiqueta OOM indica que no cabe en tu VRAM.",
    settingsTitle: "Barra lateral de ajustes",
    settingsBody:
      "El muestreo (temperatura/top-p/top-k) y el prompt del sistema están aquí. Si buscas respuestas más deterministas, reduce primero la temperatura.",
    plusMenuTitle: "El menú +",
    plusMenuBody:
      "Usa el menú + para adjuntar imágenes y archivos, reutilizar prompts y acceder a las herramientas disponibles. Las opciones dependen del modelo, de tus conexiones y de los permisos. Adjuntar un archivo no concede acceso a toda su carpeta.",
    compareViewTitle: "Hilos en paralelo",
    compareViewBody:
      "Compara dos modelos cualesquiera lado a lado desde el menú +. Mismo prompt, 2 hilos. Si LoRA da peores resultados que la base, suele deberse al formateo de datos, demasiadas épocas o un punto de control no óptimo.",
  },
  export: {
    trainingRunTitle: "Elegir ejecución de entrenamiento",
    trainingRunBody:
      "Comienza seleccionando la ejecución de entrenamiento. Cada ejecución agrupa los puntos de control producidos por ese ajuste fino.",
    checkpointTitle: "Elegir punto de control",
    checkpointBody:
      "Elige qué punto de control exportar. Si entrenaste múltiples puntos de control, vale la pena exportar 1 o 2 candidatos y probarlos en el Chat.",
    methodTitle: "Método de exportación",
    methodBody:
      "Elige el empaquetado. GGUF es para motores estilo llama.cpp (elige una cuantización). Safetensors es para uso con Hugging Face/Transformers. Si tienes dudas, empieza con safetensors.",
    ctaTitle: "Exportar",
    ctaBody:
      "Exporta en local o sube a HF Hub. Tras la exportación, pruébalo en el Chat y compáralo con la base para confirmar que el comportamiento es el esperado.",
  },
} as const;
