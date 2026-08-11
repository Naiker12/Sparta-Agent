import type { MCPServerConfig } from '../../shared'

export interface ToolCallContext {
  sessionId: string
  messageId: string
  toolCallId: string
  toolName: string
  toolInput: Record<string, unknown>
  mcpServers?: MCPServerConfig[]
  connectedFolder?: string
  workspaceRoot?: string
  model?: string
  vendor?: string
}

/** Base URLs de las APIs REST de Google, Microsoft Graph y Notion */
export const googleApiBaseUrls: Record<string, string> = {
  gmail: 'https://gmail.googleapis.com/gmail/v1/users/me',
  'google-drive': 'https://www.googleapis.com/drive/v3',
  'google-calendar': 'https://www.googleapis.com/calendar/v3',
  onedrive: 'https://graph.microsoft.com/v1.0/me/drive',
  notion: 'https://api.notion.com/v1',
}

/** Resuelve un campo buscando en múltiples alias */
export function resolveField(input: Record<string, unknown>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const val = input[alias]
    if (val && typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}
