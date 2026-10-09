export const channels = {
  settings: {
    owner: "My account",
    revoke: "Revoke access",
    revokeHelp:
      "This account will lose bot access, its profile link and project permissions. The connection's active request will stop. You can link it again later. Account:",
    personalProfileHelp:
      "Your Telegram is already linked to your profile. Send “call me…” to change your Spartan name without another approval.",
    title: "Channels and permissions",
    description:
      "Manage access, profile, projects and capabilities for each connection.",
    keywords:
      "telegram bot channels permissions access projects pairing link voice capabilities",
    configure: "Configure",
    connection: "Telegram connection",
    people: "People and access",
    peopleHelp:
      "My account uses your profile and projects according to its policy. Other people receive selected projects only and cannot change your profile.",
    noConnections: "No connections yet",
    noConnectionsHelp:
      "Add a Telegram bot in Channels to configure its access here.",
    linkedProfile: "Your profile is linked",
    unlinkedProfile: "Profile not linked",
    manageAccess: "Manage access",
  },
  profileBinding: {
    unnamedProfile: "Your profile",
    emptyNameHelp:
      "No name has been saved yet. Enter it here or change it from Telegram after saving the profile link.",
    pending: "Unsaved changes",
    linked: "Linked",
    unlinked: "Not linked",
    saveRequired:
      "Selecting a user does not save the link. Press Save link to allow name changes from Telegram.",
    failed:
      "Could not save the link. Retry; selecting a user does not activate permission.",
    saved:
      "Link saved. In Telegram send “call me Jane”. The name will also update in Settings → Profile.",
    removed: "Link removed. Name changes from Telegram are disabled.",

    namePlaceholder: "Your name",
    title: "Spartan profile",
    disabled: "Profile changes disabled",
    help: "Select your Telegram ID. Only this user can change your name by saying “call me…”.",
    save: "Save profile link",
  },
  assistant: {
    updatingProfile: "Updating profile",
    searchingWeb: "Searching the web",
    readingPage: "Reading web page",
    completed: "Request completed",
    cancelled: "Request cancelled",
    failed: "Could not complete request",

    transcribing: "Transcribing audio",
    readingDocument: "Reading document",
    responding: "Preparing response",

    title: "Channel activity",
    setting: "Show channel assistant",
    settingHelp: "Show the character while Telegram processes a request.",
    working: "Processing request",
    minimize: "Minimize",
    expand: "Expand",
  },
  naturalInteraction:
    "Chat normally or send a note using the Telegram microphone. To search, write “Search the web…”. Voice must be prepared and enabled for the bot.",
  compact: {
    pagination: "Activity pagination",
    events: "events",
    previous: "Previous",
    next: "Next",
    usageDetails: "Usage details",
    partial: "Partial data",
    showCommands: "Show commands",
    limits: "Limits and privacy",
    settings: "Configure voice and projects",
    voiceHelp: "Voice help",
    documentation: "Telegram guide",
  },
  projects: {
    readContext: "Read instructions and indexed documents",
    contextHelp:
      "Only from the selected, authorized project. Text is sent to this connection's provider; no folder access or file modification. Requests with a selected project do not use web lookups. Changing permissions clears this chat's context.",
    accessMode: "Project access",
    all: "All my active projects",
    selected: "Selected projects only",
    allHelp:
      "Your account automatically includes active projects and projects you create later. Selecting one in Telegram lets it use instructions and indexed documents according to the read permission.",
    title: "Projects",
    help: "Choose authorized projects and whether the person can read their context. Use /projects and /project in Telegram to select one. Your linked account has reading enabled; other people need explicit permission.",
    manage: "Manage authorized projects",
    empty: "Create a project in Spartan to authorize it here.",
    user: "Telegram user",
  },
  documents: "Received documents",
  documentsHelp:
    "Send UTF-8 TXT, Markdown, CSV or JSON (up to 256 KB and 24,000 characters), with your question as the caption. Text is sent to the selected provider; the file is not saved on the PC. PDF and Word are pending. Document queries do not use web searches.",
  voice: {
    providerScope:
      "Spartan transcription configuration. Telegram uses it now; other channels and chat voice will connect later.",
    elevenlabsKeyHelp:
      "Create a key in Developers → API Keys and enable Speech to Text. Then paste it here.",
    groqKeyHelp:
      "Create a key in Groq API Keys for the project you want to use. Then paste it here.",
    customKeyHelp:
      "Get the key and transcription URL from your compatible provider dashboard.",
    connectionDetails: "Connection details",
    keyGuide: "How to create the key",
    retry: "Retry",
    keyRequired:
      "Enter an API key. If you changed the URL, enter the key again.",
    endpointInvalid:
      "Use a public HTTPS URL ending in /audio/transcriptions, without credentials or query parameters.",
    modelInvalid: "Check the transcription model identifier.",
    permissionMissing:
      "ElevenLabs reports a missing key permission. Enable Speech to Text → Access for the key saved in Spartan.",
    authenticationFailed:
      "The key was rejected. Check its validity and transcription permission.",
    rateLimited:
      "The provider reached its usage limit. Check your account or try again later.",
    sampleTooLong: "The test audio must be no longer than five minutes.",
    timeout: "The provider took too long. Try a shorter audio.",
    modelUnavailable:
      "The provider rejected the request. Check the model and audio format.",

    runtimeBlocked:
      "Windows blocked the Whisper runtime under its code integrity and signing policy. Reinstalling the same package will not resolve it. Use an API provider while a compatible runtime is prepared.",
    runtimeLaunchFailed:
      "The Whisper runtime downloaded but could not start on this computer. You can use an API provider and check the installation diagnostics.",
    runtimeIncompatible:
      "The Whisper package and local runtime require compatible versions. You can configure an API provider while checking for a Spartan update.",
    backToProviders: "Back to providers",
    providersTab: "Providers",
    configurationTab: "Configuration",
    testTab: "Audio test",
    addProvider: "Add provider",
    connectedProviders: "Configured voice providers",
    activeProvider: "In use",
    editProvider: "Edit connection",
    savedNotTested:
      "Configuration saved. Test an audio file to verify transcription.",
    transcriptionProvider: "Transcription provider",
    compatibleApi: "Compatible API",
    transcriptionModel: "Transcription model",
    endpoint: "Transcription URL",
    endpointHelp:
      "For a compatible API, enter the complete HTTPS URL ending in /audio/transcriptions.",
    apiKey: "API key",
    savedCredential: "Saved",
    retainedCredentialHelp:
      "Your key remains saved and is used for transcription. It is not displayed again when editing. Leave this field blank to keep it, or enter a new key to replace it.",
    keySaved: "Saved key · leave blank to keep it",
    keyPrivacy: "The key is encrypted at rest and never shown in Telegram.",
    getApiKey: "Get API key",
    remoteConsent:
      "I agree to send audio to the selected provider. Charges may apply to my account.",
    saveProvider: "Save and use provider",
    removeProvider: "Remove connection",
    useLocal: "Use local Whisper",
    configurationSaved: "Voice configuration saved",
    configurationFailed:
      "Could not save or load configuration. Check the fields and retry.",
    configurationReady: "Configured",
    notSaved: "Not applied",
    decoderUnavailable:
      "Spartan is missing its audio decoder. Complete backend setup and restart the application.",
    invalidSample:
      "The audio could not be decoded. Try a valid OGG, WAV or MP3 file.",
    emptySample: "No text was detected. Try a recording with clear speech.",
    networkFailed:
      "Could not connect to the provider. Check your internet connection and try again.",
    providerUnavailable:
      "The provider could not complete transcription. Try again later.",
    testConnection: "Test transcription",
    sampleAudio: "Test audio",
    testHelp:
      "Audio will be sent to the saved provider. Maximum 5 minutes and 20 MB; usage charges may apply.",
    testing: "Transcribing test audio…",
    testPassed: "Transcription completed",
    testFailed:
      "Could not transcribe. Check the key, permissions, model and audio.",
    sampleTooLarge: "Audio must not exceed 20 MB.",
    remotePrivacy:
      "Audio is sent to the configured transcription provider. Recognized text is sent to the chat provider to respond.",

    recommended: "Recommended",
    localSummary:
      "Transcription on your PC, without an API key. Spanish and English.",
    setupDetails: "Installation and privacy details",
    runtimeInstalling: "Installing local runtime…",
    preparing: "Preparing local voice…",
    setupFailed:
      "Voice setup could not complete. Check your connection and available disk space, then retry.",

    install: "Prepare local voice",
    installing: "Installing local voice…",
    installHelp:
      "Setup prepares the Whisper runtime and multilingual base model in Spartan's local data. Complete or retry preparation here. Downloads require internet; transcription runs on your PC.",
    title: "Voice input",
    description:
      "Receive voice notes and audio files from this bot’s authorized users.",
    ready: "Model prepared",
    needsPreparation: "Preparation needed",
    local: "Local",
    openSettings: "Open voice settings",
    prepareHelp:
      "Select Prepare local voice to complete runtime and Whisper base setup. Then enable voice input for this connection.",
    limits:
      "Up to five minutes and 20 MB per audio. Text replies. Stop the request with /cancel.",
    privacy:
      "Audio is transcribed on your PC. Recognized text is sent to the selected provider to respond and kept in this chat’s history.",
    prepareFailed:
      "The model download could not complete. Check your connection and available disk space, then try again.",
    prepare: "Prepare Whisper base",
    downloading: "Downloading model…",
    downloaded: "Downloaded:",
  },
  usage: {
    title: "Telegram usage",
    description:
      "Provider-reported tokens, aggregated per bot across its authorized users.",
    period: "Last 24 hours",
    unavailable: "Unavailable",
    input: "Known input",
    output: "Known output",
    total: "Known tokens",
    coverage: "Requests with complete input and output:",
    remaining: "Local requests available per hour:",
    partial: "Some requests have incomplete usage data. Totals may be partial.",
    noReports:
      "The provider has not reported tokens yet. Zero consumption is not assumed.",
    balance:
      "The local limit is shared by the bot. Provider token balance or credit is not available here.",
  },
  work: {
    loadFailed: "Could not load work.",
    open: "View work in Spartan",
    running: "Spartan is preparing a reply for Telegram.",
    completed: "Telegram accepted the reply. You can review the result here.",
    cancelled:
      "The user cancelled the request from Telegram. It was not added to the conversation context.",
    failed: "The request ended with an error. Check the bot activity.",
    review:
      "Execution was interrupted or delivery was not confirmed. Check Telegram before requesting it again; it will not be repeated automatically.",
  },
  activityView: {
    recent: "Recent activity",
    window: "Latest 50 events",
    all: "All",
    responses: "Replies",
    errors: "Errors",
    connections: "Connections",
    filter: "Filter activity",
    bot: "Filter by bot",
    allBots: "All bots",
    needsAttention: "Needs attention",
    unknownBot: "Connection",
    noMatches: "No events match this filter",
    noMatchesHelp: "Choose another event type or bot to see its activity.",
    event: {
      replySent: "Reply sent",
      replyFailed: "Reply could not be completed",
      requestStarted: "Request started",
      requestCancelled: "Request cancelled by its sender",
      audioTranscriptionStarted: "Local transcription started",
      audioTranscriptionCompleted: "Audio text recognized",
      documentReadStarted: "Document reading started",
      documentReadCompleted: "Document text obtained",
      projectAccessUpdated: "Authorized projects updated",
      projectContextRevoked: "Request stopped because project access changed",
      userAccessRevoked: "Account access revoked",
      profileUpdated: "Profile name updated",
      documentReadFailed: "Could not read the document",
      audioTranscriptionFailed: "Audio could not be transcribed",
      voicePreparationRequested: "Voice preparation requested",
      voiceEnabled: "Voice input enabled",
      voiceDisabled: "Voice input disabled",
      imageSearchStarted: "Image search started",
      imageSearchCompleted: "Image references retrieved",
      imageSearchUnavailable: "No usable images",
      photoSent: "Photo sent",
      photoUnavailable: "Photo unavailable; links retained",
      deliveryCancelled: "Delivery cancelled by its sender",
      deliveryRevoked: "Delivery stopped after access changed",
      webReadStarted: "Page reading started",
      webReadCompleted: "Page text retrieved",
      webReadUnavailable: "Page unavailable",
      webSearchStarted: "Web search started",
      webSearchCompleted: "Web sources obtained",
      webSearchUnavailable: "No usable web results",
      credentialsError: "Bot authentication failed",
      consumerConflict: "Another service is using this bot",
      rateLimited: "Telegram limited requests",
      transportError: "Could not connect to Telegram",
      saved: "Bot saved",
      requested: "Connection requested",
      paused: "Connection paused",
      connected: "Bot connected",
      pairingStarted: "Account linking started",
      pairingApproved: "Account authorized",
      pairingCancelled: "Account linking cancelled",
      contextReset: "Context reset",
      unknown: "Event recorded",
    },
    help: {
      credentialsError:
        "Check the token in BotFather and configure the bot again.",
      consumerConflict:
        "Stop this bot connection in the other application before reconnecting.",
      rateLimited:
        "Spartan respects the waiting period specified by Telegram before retrying.",
      general: "Check the provider and bot connection in Connections.",
    },
  },
  pairing: {
    guestTitle: "Add another person",
    selfHelp:
      "Confirm this is your account. It will be linked to your profile and have access to active and new projects. When you select a project, its instructions and indexed excerpts are sent to this connection's provider to answer. You will not need separate per-project approvals.",
    guestHelp:
      "This person can chat with the bot. They do not receive access to your profile or projects; you can select their projects in Channels and permissions.",
    selfApprove: "This is my account · link and connect",
    guestApprove: "Authorize person and connect",
    approved:
      "Your account is already authorized. Spartan is connecting the bot.",
    done: "Done",
    listenerError:
      "Spartan cannot receive messages from this bot. Check the connection, token, and whether another app is using this bot before generating another link.",
    title: "Link my Telegram",
    description:
      "Open your bot and authorize your account without looking up your ID.",
    qr: "Scan to open your bot in Telegram",
    openHelp:
      "Open Telegram using this button or scan the QR with your phone. In the bot chat, press Start.",
    open: "Open my bot in Telegram",
    expiry:
      "This private link can be used once and expires in 10 minutes. Keep Spartan open.",
    waiting: "Waiting for you to press Start in Telegram…",
    detected: "Account detected",
    accountId: "Account ID:",
    confirmHelp:
      "Check that this code matches the one you received in Telegram:",
    approveHelp:
      "If you recognize this account, authorize it to connect the bot. Otherwise, cancel and generate another link.",
    approve: "Authorize my account and connect",
    expired:
      "This link is no longer available. Generate a new one to continue.",
    renew: "Generate another link",
    setupHelp:
      "Link your account by opening your bot in Telegram. Spartan detects your ID automatically and asks you to approve the account.",
    manual: "Enter IDs manually (advanced)",
    setupSummary:
      "We will verify the bot and open account linking. It will only reply after you authorize your account in Spartan.",
    verifyLink: "Verify bot and link Telegram",
    noUsers: "No accounts authorized yet",
    linkFailed:
      "Your bot has been saved. The link could not be generated; try again or continue from its card.",
  },
  conversationContext: "Conversation context",
  projectContext: "Project instructions and indexed documents",
  typingCancellation: "Typing indicator and cancellation",
  contextHelp:
    "Each bot keeps recent context per user, up to 6 exchanges for 7 days. Use /reset to clear it. Your desktop chats and Spartan memory stay separate.",
  loading: "Loading channels…",
  retry: "Try again",
  working: "Saving changes…",

  pageDescription:
    "Choose a channel, connect your account and start talking to Spartan.",
  platforms: "Your channels",
  readyChannels: "Available",
  upcomingChannels: "Coming soon",
  ready: "Available",
  soon: "Coming soon",
  navigationHelp:
    "Start with Telegram. More integrations will appear here when ready.",
  telegramDescription: "Your assistant in private Telegram conversations.",
  plannedDescription: "Integration in preparation.",
  plannedTitle: "Not available yet",
  otherPlannedDescription:
    "This integration is part of upcoming Channels stages.",
  plannedHelp:
    "We will validate Telegram first, then add Discord. You can manage each channel here once available.",
  goToTelegram: "Go to Telegram",
  yourConnections: "Your connections",
  firstConnection: "Connect your first bot",
  firstConnectionDescription:
    "Use your own bot to talk to Spartan through Telegram. We will guide you step by step.",
  guide: {
    bot: {
      title: "Create your bot",
      description: "BotFather gives you the token to connect it.",
    },
    model: {
      title: "Choose your assistant",
      description: "Select the provider and model that will respond.",
    },
    access: {
      title: "Authorize your access",
      description: "Decide who can message it and connect when ready.",
    },
  },
  startSetup: "Start setup",
  setupTime:
    "You will need your bot token. Link your account directly from Telegram.",
  whatYouCanDo: "What you can do now",
  whatYouCanDoDescription:
    "Send text, talk to Spartan and check your provider, skills and MCP servers.",
  accessUnderControl: "You decide who gets access",
  simpleSafety:
    "Only authorized users get replies. The token is encrypted and remote actions remain limited.",
  wizardDescription: "Three steps to prepare your connection.",
  setupSteps: "Connection steps",
  wizard: { bot: "Your bot", model: "Assistant", access: "Access" },
  createBotTitle: "First, create a Telegram bot",
  createBotHelp:
    "Open BotFather, send /newbot and follow its instructions. Then copy the token and paste it here.",
  openBotFather: "Open BotFather",
  tokenPrivate:
    "This token is private. Spartan will encrypt it when saved and will not show it again.",
  chooseAssistantHelp:
    "Choose one of your configured API providers and the model that will respond through this channel.",
  noProviders:
    "Configure an API provider and its models in Spartan first. Then return to this connection.",
  savePausedHelp:
    "We will verify the bot and save the connection paused. You can then activate it from its card.",
  invalidIds:
    "Enter between 1 and 20 valid numeric Telegram IDs, separated by commas.",
  back: "Back",
  continue: "Continue",
  title: "Channels",
  subtitle:
    "Connect Spartan to your conversations, with access under your control.",
  add: "Add connection",
  refresh: "Refresh",
  sections: "Channel sections",
  connections: "Connections",
  capabilities: "Capabilities",
  activity: "Activity",
  access: "Access",
  activeConnections: "Active connections",
  accessDefault: "Default access",
  permissionsDefault: "Remote permissions",
  privateAccess: "Private conversations only",
  controlled: "Limited access",
  users: "users",
  emptyTitle: "Spartan, on Telegram too",
  emptyDescription:
    "Connect your own bot and decide who can talk to it. Choose its provider and model here.",
  connectTelegram: "Connect Telegram",
  nextIntegration: "Next integration",
  discordDescription:
    "Discord integration will follow Telegram validation. It is not available yet.",
  securityDescription:
    "Each connection has its own access. A message never grants permissions.",
  securityIds: "Only Telegram IDs you authorize can receive replies.",
  securityToken:
    "The token is encrypted in the backend and never returned to the interface.",
  securityTools:
    "Local files, commands and remote tools remain blocked in this release.",
  desktopRequired:
    "Keep Spartan open to receive messages. Pausing a connection stops receiving messages.",
  provider: "Provider",
  model: "Model",
  authorizedUsers: "Authorized users",
  botLanguage: "Bot language",
  connectionName: "Connection name",
  botToken: "Bot token",
  chooseProvider: "Select provider",
  chooseModel: "Select model",
  tokenHelp: "Create a bot with",
  usersHelp:
    "Enter your numeric Telegram ID. Separate multiple IDs with commas. Do not use @usernames.",
  setupDescription:
    "Verify your bot, select a model and authorize access. The connection is saved paused.",
  setupSafety:
    "An API provider with saved credentials is required. Do not share the token or reuse a bot connected to another application.",
  verifySave: "Verify and save",
  saving: "Verifying…",
  cancel: "Cancel",
  connect: "Connect",
  pause: "Pause",
  remove: "Remove",
  removeTitle: "Remove this connection?",
  removeDescription:
    "The bot will stop and its token, configuration and activity will be removed from Spartan. You can connect it again.",
  paused: "Paused",
  connected: "Connected",
  connecting: "Connecting…",
  connectionError: "Check connection",
  requestFailed: "The request could not be completed",
  retryHelp: "Check your connection to Spartan and try again.",
  saveFailed:
    "Could not verify the bot. Check the token, authorized IDs and connection.",
  webhookConflict:
    "This bot has an active webhook. Use another bot or disconnect it from its current application.",
  duplicateBot: "This bot already has a connection in Spartan.",
  invalidProvider: "Check the provider, model and its saved credentials.",
  commands: "Telegram commands",
  commandsDescription: "Type / in your bot chat to see these commands.",
  command: {
    projects: "Show projects authorized for your user",
    project:
      "Select a project; /project off to leave. Switching projects resets chat context",
    voice: "Check local voice input status",
    images: "Find reference images: /images followed by a topic",
    read: "Read a public page: /read followed by its URL",
    search: "Search a public topic: /search followed by your query",
    usage: "Check your token usage and local request limit",
    cancel: "Cancel your active request",
    reset: "Reset this conversation",
    help: "Show commands and capabilities",
    status: "Check connection status",
    provider: "Show the selected provider and model",
    tools: "Check tool permissions",
    skills: "List installed skills",
    mcp: "List configured MCP servers",
  },
  availableNow: "Capabilities in this release",
  capabilitiesDescription:
    "The inventory reflects your installation; querying a capability does not grant permission to execute it.",
  textChat: "Text conversation",
  inventory: "Installed inventory",
  audioDocuments: "Audio and documents",
  webTools: "Skill and MCP tool execution",
  publicPageRead: "Public page reading",
  referenceImages: "Reference images with source links",
  publicWebSearch: "Public search with sources and links",
  webSearchHelp:
    "Use /search to search, /read URL to read a public page and /images topic to receive up to two reference images. Page reading is text-limited. If a photo cannot be sent, its links remain available. Automatic lookups require a model with tool support.",
  available: "Available",
  pending: "Pending",
  capabilityNote:
    "Voice notes and audio require enabled voice input and a prepared local model. PDF, Word and remote actions remain pending.",
  activityDescription: "Recent events without message content or credentials.",
  noActivity: "No activity yet",
  noActivityDescription:
    "Once connected, your bot status and replies will appear here.",
  replySent: "Reply sent",
  replyFailed: "The reply could not be completed",
} as const;
