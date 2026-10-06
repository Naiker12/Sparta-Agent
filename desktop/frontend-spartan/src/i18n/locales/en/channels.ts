export const channels = {
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
    completed:
      "Telegram accepted the reply. You can review the result here.",
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
  publicWebSearch: "Public search with sources and links",
  webSearchHelp: "Use /search followed by a public topic. Automatic search requires a model with tool support. Sources are search snippets; images and full-page reading are not available yet.",
  available: "Available",
  pending: "Pending",
  capabilityNote:
    "Attachments are not downloaded yet. Upcoming releases will add file processing and approvals for remote actions.",
  activityDescription:
    "Recent events without message content or credentials.",
  noActivity: "No activity yet",
  noActivityDescription:
    "Once connected, your bot status and replies will appear here.",
  replySent: "Reply sent",
  replyFailed: "The reply could not be completed",
} as const;
