export interface OAuthProviderConfig {
  serverId: string
  name: string
  clientId: string
  clientSecret?: string
  authEndpoint: string
  tokenEndpoint: string
  scopes: string[]
  usesPKCE: boolean
  requiresBroker: boolean
  brokerEndpoint?: string
  redirectStrategy: 'loopback' | 'localhost'
  extraAuthParams?: Record<string, string>
}

export const OAUTH_PROVIDERS_CATALOG: Record<string, OAuthProviderConfig> = {
  'google-drive': {
    serverId: 'google-drive',
    name: 'Google Drive',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    usesPKCE: true,
    requiresBroker: false,
    redirectStrategy: 'loopback',
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  gmail: {
    serverId: 'gmail',
    name: 'Gmail',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    usesPKCE: true,
    requiresBroker: false,
    redirectStrategy: 'loopback',
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  'google-calendar': {
    serverId: 'google-calendar',
    name: 'Google Calendar',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
    usesPKCE: true,
    requiresBroker: false,
    redirectStrategy: 'loopback',
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  onedrive: {
    serverId: 'onedrive',
    name: 'OneDrive / SharePoint',
    get clientId() { return process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '' },
    get clientSecret() { return process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '' },
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Files.Read.All', 'Sites.Read.All', 'offline_access', 'User.Read'],
    usesPKCE: true,
    requiresBroker: false,
    redirectStrategy: 'loopback',
  },
  notion: {
    serverId: 'notion',
    name: 'Notion',
    clientId: process.env.NOTION_OAUTH_CLIENT_ID ?? '',
    authEndpoint: 'https://api.notion.com/v1/oauth/authorize',
    tokenEndpoint: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    usesPKCE: false,
    requiresBroker: true,
    brokerEndpoint: process.env.SPARTA_OAUTH_BROKER_URL ?? 'http://127.0.0.1:3000/api/oauth/notion/exchange',
    redirectStrategy: 'loopback',
    extraAuthParams: {
      owner: 'user',
    },
  },
  slack: {
    serverId: 'slack',
    name: 'Slack',
    clientId: process.env.SLACK_OAUTH_CLIENT_ID ?? '',
    authEndpoint: 'https://slack.com/oauth/v2/authorize',
    tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write', 'users:read'],
    usesPKCE: false,
    requiresBroker: true,
    brokerEndpoint: process.env.SPARTA_OAUTH_BROKER_URL ?? 'http://127.0.0.1:3000/api/oauth/slack/exchange',
    redirectStrategy: 'loopback',
  },
  figma: {
    serverId: 'figma',
    name: 'Figma',
    clientId: process.env.FIGMA_OAUTH_CLIENT_ID ?? '',
    authEndpoint: 'https://www.figma.com/oauth',
    tokenEndpoint: 'https://www.figma.com/api/oauth/token',
    scopes: ['current_user:read', 'file_content:read'],
    usesPKCE: false,
    requiresBroker: true,
    brokerEndpoint: process.env.SPARTA_OAUTH_BROKER_URL ?? 'http://127.0.0.1:3000/api/oauth/figma/exchange',
    redirectStrategy: 'loopback',
  },
}

export function getOAuthProviderConfig(serverId: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS_CATALOG[serverId]
}
