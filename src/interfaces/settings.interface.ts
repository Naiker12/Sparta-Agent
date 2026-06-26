export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'keybinds'
  | 'models'
  | 'mcp'
  | 'memory'
  | 'skills'
  | 'agents'

export type SessionMode = 'chat' | 'agent'

export type Language = 'es' | 'en'

export interface SettingsState {
  settingsOpen: boolean
  defaultModel: string
  activeModel: string
  memoryEnabled: boolean
  webSearchEnabled: boolean
  reasoningEnabled: boolean
  sessionMode: SessionMode
  language: Language
}
