export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'keybinds'
  | 'models'
  | 'memory'
  | 'skills'
  | 'agents'
  | 'search'
  | 'shell'
  | 'harnesses'
  | 'voice'
  | 'system'
  | 'data'

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
