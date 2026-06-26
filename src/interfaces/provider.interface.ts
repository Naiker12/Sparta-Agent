import type { ChatRequest, ChatStreamChunk } from './chat.interface'

export type ProviderVendor =
  | 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'azure'
  | 'deepseek' | 'together' | 'fireworks' | 'openrouter' | 'cohere' | 'perplexity' | 'xai'
  | 'ollama' | 'lmstudio' | 'llamacpp' | 'custom'

export type ProviderKind = 'cloud' | 'local'

export interface Provider {
  id: string
  vendor: ProviderVendor
  kind: ProviderKind
  label: string
  apiKey?: string
  serverUrl?: string
  defaultModel?: string
  createdAt: string
  usage?: { tokens: number; cost?: number } | null
}

export interface ModelInfo {
  id: string
  name: string
  vendor: ProviderVendor
  providerId: string
}

export interface AIProvider {
  readonly vendor: ProviderVendor
  readonly kind: ProviderKind
  listModels(): Promise<ModelInfo[]>
  testConnection(): Promise<{ ok: boolean; error?: string }>
  streamChat(req: ChatRequest): AsyncIterable<ChatStreamChunk>
}

export interface ConnectionTestResult {
  ok: boolean
  error?: string
}
