export const channels = {
  settings: {
    owner: "Mi cuenta",
    revoke: "Revocar acceso",
    revokeHelp:
      "Se quitarán el acceso al bot, el vínculo de perfil y los proyectos de esta cuenta. Se detendrá la consulta en curso de la conexión. Puedes volver a vincularla después. Cuenta:",
    personalProfileHelp:
      "Tu Telegram ya está vinculado a tu perfil. Escribe «me quiero llamar…» para cambiar tu nombre en Spartan sin autorizarlo de nuevo.",
    title: "Canales y permisos",
    description:
      "Administra el acceso, el perfil, los proyectos y las capacidades de cada conexión.",
    keywords:
      "telegram bot canales permisos acceso proyectos vincular voz capacidades",
    configure: "Configurar",
    connection: "Conexión de Telegram",
    people: "Personas y acceso",
    peopleHelp:
      "Mi cuenta usa tu perfil y los proyectos según su política. Las otras personas solo reciben los proyectos seleccionados y no pueden cambiar tu perfil.",
    noConnections: "Todavía no tienes conexiones",
    noConnectionsHelp:
      "Añade un bot de Telegram en Canales para configurar su acceso aquí.",
    linkedProfile: "Tu perfil está vinculado",
    unlinkedProfile: "Perfil sin vincular",
    manageAccess: "Gestionar acceso",
  },
  profileBinding: {
    unnamedProfile: "Tu perfil",
    emptyNameHelp:
      "Aún no hay un nombre guardado. Puedes escribirlo aquí o cambiarlo desde Telegram después de guardar la vinculación.",
    pending: "Pendiente de guardar",
    linked: "Vinculado",
    unlinked: "Sin vincular",
    saveRequired:
      "Seleccionar el usuario no guarda el vínculo. Pulsa Guardar vinculación para permitir el cambio de nombre desde Telegram.",
    failed:
      "No se pudo guardar el vínculo. Reintenta; seleccionar el usuario no activa el permiso.",
    saved:
      "Vínculo guardado. En Telegram escribe «me quiero llamar Naiker Codes». El nombre también se actualizará en Ajustes → Perfil.",
    removed:
      "Vínculo eliminado. El cambio de nombre desde Telegram está desactivado.",

    namePlaceholder: "Tu nombre",
    title: "Perfil de Spartan",
    disabled: "Sin permiso para cambiar el perfil",
    help: "Selecciona tu ID de Telegram. Solo ese usuario podrá cambiar tu nombre con «me quiero llamar…».",
    save: "Guardar vinculación",
  },
  assistant: {
    updatingProfile: "Actualizando perfil",
    searchingWeb: "Buscando en internet",
    readingPage: "Leyendo página web",
    completed: "Solicitud completada",
    cancelled: "Solicitud cancelada",
    failed: "No se pudo completar",

    transcribing: "Transcribiendo audio",
    readingDocument: "Leyendo documento",
    responding: "Preparando respuesta",

    title: "Actividad de los canales",
    setting: "Mostrar asistente de canales",
    settingHelp:
      "Muestra el personaje mientras Telegram procesa una solicitud.",
    working: "Procesando solicitud",
    minimize: "Minimizar",
    expand: "Expandir",
  },
  naturalInteraction:
    "Habla normalmente o envía una nota con el micrófono de Telegram. Para buscar, escribe «Busca en internet…». La voz necesita estar preparada y activada en el bot.",
  compact: {
    pagination: "Paginación de actividad",
    events: "eventos",
    previous: "Anterior",
    next: "Siguiente",
    usageDetails: "Detalles de consumo",
    partial: "Datos parciales",
    showCommands: "Ver comandos",
    limits: "Límites y privacidad",
    settings: "Configurar voz y proyectos",
    voiceHelp: "Ayuda de voz",
    documentation: "Guía de Telegram",
  },
  projects: {
    readContext: "Consultar instrucciones y documentos indexados",
    contextHelp:
      "Solo del proyecto seleccionado y autorizado. El texto se envía al proveedor de esta conexión; no abre carpetas ni modifica archivos. Las consultas con proyecto seleccionado no usan búsquedas web. Cambiar permisos borra el contexto de este chat.",
    accessMode: "Acceso a proyectos",
    all: "Todos mis proyectos activos",
    selected: "Solo proyectos seleccionados",
    allHelp:
      "Tu cuenta incluye automáticamente los proyectos activos y los que crees después. Al seleccionar uno en Telegram, puede usar sus instrucciones y documentos indexados según el permiso de consulta.",
    title: "Proyectos",
    help: "Elige los proyectos autorizados y si la persona puede consultar su contexto. En Telegram usa /projects y /project para seleccionar uno. Tu cuenta vinculada tiene consulta activada; otras personas necesitan permiso explícito.",
    manage: "Gestionar proyectos autorizados",
    empty: "Crea un proyecto en Spartan para autorizarlo aquí.",
    user: "Usuario de Telegram",
  },
  documents: "Documentos recibidos",
  documentsHelp:
    "Envía TXT, Markdown, CSV o JSON en UTF-8 (hasta 256 KB y 24.000 caracteres), con tu pregunta como descripción. El texto se envía al proveedor elegido; no se guarda el archivo en el PC. PDF y Word están pendientes. La consulta del documento no usa búsquedas web.",
  voice: {
    providerScope:
      "Configuración de transcripción de Spartan. Telegram ya la usa; los demás canales y la voz del chat se conectarán más adelante.",
    elevenlabsKeyHelp:
      "Crea una clave en Developers → API Keys y habilita Speech to Text. Después pégala aquí.",
    groqKeyHelp:
      "Crea una clave en API Keys de Groq, dentro del proyecto que quieras usar. Después pégala aquí.",
    customKeyHelp:
      "Obtén la clave y la URL de transcripción en el panel de tu proveedor compatible.",
    connectionDetails: "Detalles de conexión",
    keyGuide: "Cómo crear la clave",
    retry: "Reintentar",
    keyRequired:
      "Introduce una clave API. Si cambiaste la URL, vuelve a introducir la clave.",
    endpointInvalid:
      "Usa una URL pública HTTPS que termine en /audio/transcriptions, sin credenciales ni parámetros.",
    modelInvalid: "Revisa el identificador del modelo de transcripción.",
    permissionMissing:
      "ElevenLabs indica que a esta clave le falta permiso. Activa Speech to Text → Access en la clave que guardaste en Spartan.",
    authenticationFailed:
      "La clave fue rechazada. Revisa su vigencia y el permiso de transcripción.",
    rateLimited:
      "El proveedor alcanzó su límite de uso. Revisa tu cuenta o inténtalo más tarde.",
    sampleTooLong: "El audio de prueba debe durar como máximo cinco minutos.",
    timeout: "El proveedor tardó demasiado. Inténtalo con un audio más corto.",
    modelUnavailable:
      "El proveedor rechazó la solicitud. Revisa el modelo y el formato del audio.",

    runtimeBlocked:
      "Windows bloqueó el motor Whisper por su política de integridad y firma. Reinstalar el mismo paquete no lo resolverá. Usa un proveedor por API mientras se prepara un motor compatible.",
    runtimeLaunchFailed:
      "El motor Whisper se descargó, pero no pudo ejecutarse en este equipo. Puedes usar un proveedor por API y consultar el diagnóstico de la instalación.",
    runtimeIncompatible:
      "El paquete Whisper y el motor local requieren versiones compatibles. Puedes configurar un proveedor por API mientras revisas la actualización de Spartan.",
    backToProviders: "Volver a proveedores",
    providersTab: "Proveedores",
    configurationTab: "Configuración",
    testTab: "Prueba de audio",
    addProvider: "Añadir proveedor",
    connectedProviders: "Proveedores de voz configurados",
    activeProvider: "En uso",
    editProvider: "Editar conexión",
    savedNotTested:
      "Configuración guardada. Prueba un audio para comprobar la transcripción.",
    transcriptionProvider: "Proveedor de transcripción",
    compatibleApi: "API compatible",
    transcriptionModel: "Modelo de transcripción",
    endpoint: "URL de transcripción",
    endpointHelp:
      "Para una API compatible, introduce la URL completa HTTPS que termine en /audio/transcriptions.",
    apiKey: "Clave API",
    savedCredential: "Guardada",
    retainedCredentialHelp:
      "Tu clave sigue guardada y se usa para transcribir. No se vuelve a mostrar al editar. Deja este campo vacío para conservarla o introduce una nueva para reemplazarla.",
    keySaved: "Clave guardada · deja vacío para conservarla",
    keyPrivacy: "La clave se guarda cifrada y nunca se muestra en Telegram.",
    getApiKey: "Obtener clave API",
    remoteConsent:
      "Acepto enviar los audios al proveedor seleccionado. Puede generar costes según mi cuenta.",
    saveProvider: "Guardar y usar proveedor",
    removeProvider: "Quitar conexión",
    useLocal: "Usar Whisper local",
    configurationSaved: "Configuración de voz guardada",
    configurationFailed:
      "No se pudo guardar o cargar la configuración. Revisa los campos y reintenta.",
    configurationReady: "Configurado",
    notSaved: "Sin aplicar",
    decoderUnavailable:
      "Falta el componente que lee el audio en Spartan. Completa la preparación del backend y reinicia la aplicación.",
    invalidSample:
      "No se pudo leer el audio. Prueba un archivo OGG, WAV o MP3 válido.",
    emptySample:
      "No se detectó texto en el audio. Prueba una grabación con voz clara.",
    networkFailed:
      "No se pudo conectar con el proveedor. Revisa la conexión a internet y vuelve a intentar.",
    providerUnavailable:
      "El proveedor no pudo completar la transcripción. Inténtalo de nuevo más tarde.",
    testConnection: "Probar transcripción",
    sampleAudio: "Audio de prueba",
    testHelp:
      "El audio se enviará al proveedor guardado. Máximo 5 minutos y 20 MB; puede generar consumo.",
    testing: "Transcribiendo audio de prueba…",
    testPassed: "Transcripción completada",
    testFailed:
      "No se pudo transcribir. Revisa la clave, los permisos, el modelo y el audio.",
    sampleTooLarge: "El audio no debe superar 20 MB.",
    remotePrivacy:
      "El audio se envía al proveedor de transcripción configurado. El texto reconocido se envía al proveedor del chat para responder.",

    recommended: "Recomendado",
    localSummary: "Transcripción en tu PC, sin clave API. Español e inglés.",
    setupDetails: "Detalles de instalación y privacidad",
    runtimeInstalling: "Instalando motor local…",
    preparing: "Preparando voz local…",
    setupFailed:
      "No se pudo completar la preparación de voz. Revisa la conexión y el espacio disponible, y reintenta.",

    install: "Preparar voz local",
    installing: "Instalando voz local…",
    installHelp:
      "El instalador prepara el motor Whisper y el modelo base multilingüe en los datos locales de Spartan. Puedes completar o reintentar la preparación aquí. Requiere internet para descargar; la transcripción funciona en tu PC.",
    title: "Entrada de voz",
    description:
      "Recibe notas de voz y archivos de audio de los usuarios autorizados de este bot.",
    ready: "Modelo preparado",
    needsPreparation: "Preparación necesaria",
    local: "Local",
    openSettings: "Abrir ajustes de voz",
    prepareHelp:
      "Pulsa Preparar voz local para completar la instalación del motor y Whisper base. Después activa la entrada de voz de esta conexión.",
    limits:
      "Hasta cinco minutos y 20 MB por audio. Respuestas por texto. Puedes detener la consulta con /cancel.",
    privacy:
      "El audio se transcribe en tu PC. El texto reconocido se envía al proveedor elegido para responder y se conserva en el historial de este chat.",
    prepareFailed:
      "La descarga del modelo no pudo completarse. Revisa tu conexión y el espacio disponible, y vuelve a intentarlo.",
    prepare: "Preparar Whisper base",
    downloading: "Descargando modelo…",
    downloaded: "Descargado:",
  },
  usage: {
    title: "Consumo de Telegram",
    description:
      "Tokens reportados por el proveedor, sumados por bot y por todos sus usuarios autorizados.",
    period: "Últimas 24 horas",
    unavailable: "No disponible",
    input: "Entrada conocida",
    output: "Salida conocida",
    total: "Tokens conocidos",
    coverage: "Consultas con entrada y salida completas:",
    remaining: "Consultas locales disponibles por hora:",
    partial:
      "Algunas consultas no tienen datos completos. Los totales pueden ser parciales.",
    noReports:
      "El proveedor todavía no ha reportado tokens. No se estima un consumo de cero.",
    balance:
      "El límite local es compartido por el bot. El saldo de tokens o crédito del proveedor no está disponible aquí.",
  },
  work: {
    loadFailed: "No se pudo consultar el trabajo.",
    open: "Ver trabajo en Spartan",
    running: "Spartan está preparando una respuesta para Telegram.",
    completed:
      "Telegram aceptó el envío de la respuesta. Aquí puedes revisar el resultado.",
    cancelled:
      "El usuario canceló la consulta desde Telegram. No se añadió al contexto de conversación.",
    failed: "La consulta terminó con un error. Consulta la actividad del bot.",
    review:
      "La ejecución se interrumpió o la entrega no se confirmó. Revisa Telegram antes de volver a pedirla; no se repetirá automáticamente.",
  },
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
      audioTranscriptionStarted: "Transcripción local iniciada",
      audioTranscriptionCompleted: "Texto del audio reconocido",
      documentReadStarted: "Lectura de documento iniciada",
      documentReadCompleted: "Texto del documento obtenido",
      projectAccessUpdated: "Proyectos autorizados actualizados",
      projectContextRevoked: "Consulta detenida por cambio de acceso al proyecto",
      userAccessRevoked: "Acceso de una cuenta revocado",
      profileUpdated: "Nombre del perfil actualizado",
      documentReadFailed: "No se pudo leer el documento",
      audioTranscriptionFailed: "No se pudo transcribir el audio",
      voicePreparationRequested: "Preparación de voz solicitada",
      voiceEnabled: "Entrada de voz activada",
      voiceDisabled: "Entrada de voz desactivada",
      imageSearchStarted: "Búsqueda de imágenes iniciada",
      imageSearchCompleted: "Referencias de imágenes obtenidas",
      imageSearchUnavailable: "Sin imágenes utilizables",
      photoSent: "Foto enviada",
      photoUnavailable: "Foto no disponible; se conservan los enlaces",
      deliveryCancelled: "Envío cancelado por su usuario",
      deliveryRevoked: "Envío detenido por cambio de acceso",
      webReadStarted: "Lectura de página iniciada",
      webReadCompleted: "Texto de página obtenido",
      webReadUnavailable: "Página no disponible",
      webSearchStarted: "Búsqueda web iniciada",
      webSearchCompleted: "Fuentes web obtenidas",
      webSearchUnavailable: "Sin resultados web utilizables",
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
    guestTitle: "Añadir otra persona",
    selfHelp:
      "Confirma que esta es tu cuenta. Quedará vinculada a tu perfil y tendrá acceso a tus proyectos activos y nuevos. Al seleccionar un proyecto, sus instrucciones y fragmentos indexados se enviarán al proveedor de esta conexión para responder. No tendrás que autorizar cada proyecto por separado.",
    guestHelp:
      "Esta persona podrá conversar con el bot. No obtiene acceso a tu perfil ni a tus proyectos; podrás seleccionar sus proyectos en Canales y permisos.",
    selfApprove: "Esta es mi cuenta · vincular y conectar",
    guestApprove: "Autorizar persona y conectar",
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
  projectContext: "Instrucciones y documentos indexados del proyecto",
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
    projects: "Ver los proyectos autorizados para tu usuario",
    project:
      "Seleccionar un proyecto; /project off para salir. Cambiar de proyecto reinicia el contexto del chat",
    voice: "Consultar el estado de la entrada de voz local",
    images: "Buscar imágenes de referencia: /images seguido del tema",
    read: "Leer una página pública: /read seguido de su URL",
    search: "Buscar un tema público: /search seguido de tu consulta",
    usage: "Consultar tu consumo de tokens y el límite local",
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
  webTools: "Ejecución de skills y herramientas MCP",
  publicPageRead: "Lectura de páginas públicas",
  referenceImages: "Imágenes de referencia con enlaces de origen",
  publicWebSearch: "Búsqueda pública con fuentes y enlaces",
  webSearchHelp:
    "Usa /search para buscar, /read URL para leer una página pública y /images tema para recibir hasta dos imágenes de referencia. La lectura tiene un límite de texto. Si una foto no puede enviarse, conserva sus enlaces. Las consultas automáticas requieren un modelo con herramientas.",
  available: "Disponible",
  pending: "Pendiente",
  capabilityNote:
    "Las notas de voz y los audios requieren entrada de voz activa y un modelo local preparado. PDF, Word y las acciones remotas siguen pendientes.",
  activityDescription:
    "Eventos recientes sin contenido de mensajes ni credenciales.",
  noActivity: "Sin actividad todavía",
  noActivityDescription:
    "Aquí verás el estado y las respuestas del bot después de conectarlo.",
  replySent: "Respuesta enviada",
  replyFailed: "La respuesta no pudo completarse",
} as const;
