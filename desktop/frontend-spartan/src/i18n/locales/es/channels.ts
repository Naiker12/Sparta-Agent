export const channels = {
  activityView: {
    recent: "Actividad reciente",
    window: "Últimos 50 eventos",
    all: "Todos",
    responses: "Respuestas",
    errors: "Errores",
    connections: "Conexiones",
    filter: "Filtrar actividad",
    bot: "Filtrar por bot",
    allBots: "Todos los bots",
    needsAttention: "Revisar",
    unknownBot: "Conexión",
    noMatches: "Sin eventos para este filtro",
    noMatchesHelp: "Selecciona otro tipo o bot para ver su actividad.",
    event: {
      replySent: "Respuesta enviada",
      replyFailed: "La respuesta no pudo completarse",
      requestStarted: "Consulta iniciada",
      requestCancelled: "Consulta cancelada por su usuario",
      credentialsError: "No se pudo autenticar el bot",
      consumerConflict: "Otro servicio está usando este bot",
      rateLimited: "Telegram limitó las solicitudes",
      transportError: "No se pudo conectar con Telegram",
      saved: "Bot guardado",
      requested: "Conexión solicitada",
      paused: "Conexión pausada",
      connected: "Bot conectado",
      pairingStarted: "Vinculación iniciada",
      pairingApproved: "Cuenta autorizada",
      pairingCancelled: "Vinculación cancelada",
      contextReset: "Contexto reiniciado",
      unknown: "Evento registrado",
    },
    help: {
      credentialsError:
        "Revisa el token en BotFather y vuelve a configurar el bot.",
      consumerConflict:
        "Detén la conexión de este bot en la otra aplicación antes de reconectarlo.",
      rateLimited:
        "Spartan respetará la espera indicada por Telegram antes de reintentar.",
      general: "Revisa el proveedor y la conexión del bot en Conexiones.",
    },
  },
  pairing: {
    approved: "Tu cuenta ya está autorizada. Spartan está conectando el bot.",
    done: "Listo",
    listenerError:
      "Spartan no puede recibir mensajes de este bot. Revisa la conexión, el token y si otra aplicación está usando el bot antes de generar otro enlace.",
    title: "Vincular mi Telegram",
    description: "Abre tu bot y autoriza tu cuenta sin buscar tu ID.",
    qr: "Escanea para abrir tu bot en Telegram",
    openHelp:
      "Abre Telegram desde este botón o escanea el QR con tu móvil. En el chat con el bot, pulsa Iniciar.",
    open: "Abrir mi bot en Telegram",
    expiry:
      "Este enlace es privado, de un solo uso y caduca en 10 minutos. Mantén Spartan abierto.",
    waiting: "Esperando que pulses Iniciar en Telegram…",
    detected: "Cuenta detectada",
    accountId: "ID de la cuenta:",
    confirmHelp:
      "Comprueba que este código coincide con el que recibiste en Telegram:",
    approveHelp:
      "Si reconoces esta cuenta, autorízala para conectar el bot. Si no es tuya, cancela y genera otro enlace.",
    approve: "Autorizar mi cuenta y conectar",
    expired:
      "El enlace ya no está disponible. Genera uno nuevo para continuar.",
    renew: "Generar otro enlace",
    setupHelp:
      "Vincula tu cuenta abriendo tu bot en Telegram. Spartan obtiene tu ID automáticamente y te pide aprobar la cuenta.",
    manual: "Introducir IDs manualmente (avanzado)",
    setupSummary:
      "Verificaremos el bot y abriremos la vinculación. Solo responderá después de que autorices tu cuenta en Spartan.",
    verifyLink: "Verificar bot y vincular Telegram",
    noUsers: "Ninguna cuenta autorizada todavía",
    linkFailed:
      "El bot ya está guardado. No se pudo generar el enlace; vuelve a intentarlo o continúa desde su tarjeta.",
  },
  conversationContext: "Contexto de conversación",
  typingCancellation: "Indicador de escritura y cancelación",
  contextHelp:
    "Cada bot conserva el contexto reciente por usuario, hasta 6 intercambios durante 7 días. Usa /reset para borrarlo. No se comparte con tus chats ni con la memoria de Spartan.",
  loading: "Cargando canales…",
  retry: "Volver a intentar",
  working: "Guardando cambios…",

  pageDescription:
    "Elige un canal, conecta tu cuenta y empieza a hablar con Spartan.",
  platforms: "Tus canales",
  readyChannels: "Disponibles",
  upcomingChannels: "Próximamente",
  ready: "Disponible",
  soon: "Próximamente",
  navigationHelp:
    "Empieza por Telegram. Las siguientes integraciones aparecerán aquí cuando estén listas.",
  telegramDescription: "Tu asistente en conversaciones privadas de Telegram.",
  plannedDescription: "Integración en preparación.",
  plannedTitle: "Todavía no está disponible",
  otherPlannedDescription:
    "Esta integración forma parte de las siguientes etapas de Canales.",
  plannedHelp:
    "Primero validaremos Telegram y después incorporaremos Discord. Desde aquí podrás gestionar cada canal cuando esté disponible.",
  goToTelegram: "Ir a Telegram",
  yourConnections: "Tus conexiones",
  firstConnection: "Conecta tu primer bot",
  firstConnectionDescription:
    "Usa un bot propio para hablar con Spartan desde Telegram. Te guiamos paso a paso.",
  guide: {
    bot: {
      title: "Crea tu bot",
      description: "BotFather te entrega el token para conectarlo.",
    },
    model: {
      title: "Elige tu asistente",
      description: "Selecciona el proveedor y el modelo que responderán.",
    },
    access: {
      title: "Autoriza tu acceso",
      description: "Decide quién puede escribir y conecta cuando estés listo.",
    },
  },
  startSetup: "Empezar conexión",
  setupTime:
    "Necesitarás el token de tu bot. Tu cuenta se vincula desde Telegram.",
  whatYouCanDo: "Qué puedes hacer ahora",
  whatYouCanDoDescription:
    "Envía texto, conversa con Spartan y consulta tu proveedor, skills y servidores MCP.",
  accessUnderControl: "Tú decides quién entra",
  simpleSafety:
    "Solo responden tus usuarios autorizados. El token queda cifrado y las acciones remotas siguen limitadas.",
  wizardDescription: "Tres pasos para preparar tu conexión.",
  setupSteps: "Pasos de conexión",
  wizard: { bot: "Tu bot", model: "Asistente", access: "Acceso" },
  createBotTitle: "Primero, crea un bot en Telegram",
  createBotHelp:
    "Abre BotFather, envía /newbot y sigue las instrucciones. Después copia el token y pégalo aquí.",
  openBotFather: "Abrir BotFather",
  tokenPrivate:
    "Este token es privado. Spartan lo cifrará al guardar y no volverá a mostrarlo.",
  chooseAssistantHelp:
    "Elige uno de tus proveedores API configurados y el modelo que responderá por este canal.",
  noProviders:
    "Configura primero un proveedor API y sus modelos en Spartan. Después vuelve a esta conexión.",
  savePausedHelp:
    "Verificaremos el bot y guardaremos la conexión pausada. Después podrás activarla desde su tarjeta.",
  invalidIds:
    "Introduce entre 1 y 20 IDs numéricos válidos de Telegram, separados por comas.",
  back: "Atrás",
  continue: "Continuar",
  title: "Canales",
  subtitle:
    "Conecta Spartan con tus conversaciones, con acceso bajo tu control.",
  add: "Añadir conexión",
  refresh: "Actualizar",
  sections: "Secciones de canales",
  connections: "Conexiones",
  capabilities: "Capacidades",
  activity: "Actividad",
  access: "Acceso",
  activeConnections: "Conexiones activas",
  accessDefault: "Acceso predeterminado",
  permissionsDefault: "Permisos remotos",
  privateAccess: "Solo conversaciones privadas",
  controlled: "Acceso limitado",
  users: "usuarios",
  emptyTitle: "Spartan, también en Telegram",
  emptyDescription:
    "Conecta un bot propio y decide quién puede hablar con él. Elige su proveedor y modelo desde aquí.",
  connectTelegram: "Conectar Telegram",
  nextIntegration: "Siguiente integración",
  discordDescription:
    "La integración de Discord se incorporará después de validar Telegram. Todavía no está disponible.",
  securityDescription:
    "Cada conexión tiene su propio acceso. Un mensaje nunca concede permisos.",
  securityIds:
    "Solo los IDs de Telegram que autorices pueden obtener respuestas.",
  securityToken:
    "El token se cifra en el backend y nunca se devuelve a la interfaz.",
  securityTools:
    "Archivos locales, comandos y herramientas remotas permanecen bloqueados en esta entrega.",
  desktopRequired:
    "Spartan debe permanecer abierto para recibir mensajes. Pausar una conexión detiene su recepción.",
  provider: "Proveedor",
  model: "Modelo",
  authorizedUsers: "Usuarios autorizados",
  botLanguage: "Idioma del bot",
  connectionName: "Nombre de la conexión",
  botToken: "Token del bot",
  chooseProvider: "Seleccionar proveedor",
  chooseModel: "Seleccionar modelo",
  tokenHelp: "Crea un bot en",
  usersHelp:
    "Introduce tu ID numérico de Telegram. Para varios usuarios, separa los IDs con comas. No uses nombres @usuario.",
  setupDescription:
    "Verifica tu bot, selecciona un modelo y autoriza el acceso. La conexión se guarda pausada.",
  setupSafety:
    "Se requiere un proveedor API con credenciales guardadas. No compartas el token ni reutilices un bot conectado a otra aplicación.",
  verifySave: "Verificar y guardar",
  saving: "Verificando…",
  cancel: "Cancelar",
  connect: "Conectar",
  pause: "Pausar",
  remove: "Eliminar",
  removeTitle: "¿Eliminar esta conexión?",
  removeDescription:
    "Se detendrá el bot y se eliminarán su token, configuración y actividad de Spartan. Podrás volver a conectarlo.",
  paused: "Pausada",
  connected: "Conectada",
  connecting: "Conectando…",
  connectionError: "Revisar conexión",
  requestFailed: "No se pudo completar la solicitud",
  retryHelp: "Comprueba la conexión con Spartan y vuelve a intentarlo.",
  saveFailed:
    "No se pudo verificar el bot. Revisa el token, los IDs autorizados y la conexión.",
  webhookConflict:
    "Este bot tiene un webhook activo. Usa otro bot o desconéctalo de su aplicación actual.",
  duplicateBot: "Este bot ya tiene una conexión en Spartan.",
  invalidProvider:
    "Revisa el proveedor, el modelo y sus credenciales guardadas.",
  commands: "Comandos de Telegram",
  commandsDescription:
    "Escribe / en tu chat con el bot para ver estos comandos.",
  command: {
    cancel: "Cancelar tu consulta en curso",
    reset: "Reiniciar esta conversación",
    help: "Ver comandos y capacidades",
    status: "Consultar el estado de la conexión",
    provider: "Ver el proveedor y el modelo elegidos",
    tools: "Consultar los permisos de herramientas",
    skills: "Consultar las skills instaladas",
    mcp: "Consultar los servidores MCP configurados",
  },
  availableNow: "Capacidades de esta entrega",
  capabilitiesDescription:
    "El inventario refleja tu instalación; consultar una capacidad no concede permiso para ejecutarla.",
  textChat: "Conversación de texto",
  inventory: "Inventario instalado",
  audioDocuments: "Audios y documentos",
  webTools: "Web, skills y herramientas MCP",
  available: "Disponible",
  pending: "Pendiente",
  capabilityNote:
    "Los adjuntos no se descargan todavía. Las siguientes entregas incorporarán procesamiento de archivos y aprobaciones para acciones remotas.",
  activityDescription:
    "Eventos recientes sin contenido de mensajes, tokens ni credenciales.",
  noActivity: "Sin actividad todavía",
  noActivityDescription:
    "Aquí verás el estado y las respuestas del bot después de conectarlo.",
  replySent: "Respuesta enviada",
  replyFailed: "La respuesta no pudo completarse",
} as const;
