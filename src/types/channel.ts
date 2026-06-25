export type ChannelKind = 'internal' | 'integration'
export type IntegrationProvider = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'email'
export type IntegrationStatus = 'not_configured' | 'connecting' | 'connected' | 'error'

export interface IntegrationConfig {
  provider: IntegrationProvider
  status: IntegrationStatus
  botToken?: string
  webhookUrl?: string
  workspaceToken?: string
  errorMessage?: string
  botInfo?: {
    name: string
    username: string
    avatarUrl?: string
  }
}

export interface Channel {
  id: string
  name: string
  topic?: string
  members?: string[]
  createdAt: number
  unreadCount: number
  kind: ChannelKind
  integration?: IntegrationConfig
  icon?: string
}

export interface ChannelMessage {
  id: string
  channelId: string
  authorId: string
  content: string
  timestamp: number
}
