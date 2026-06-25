export type ProviderVendor =
  | 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'azure'
  | 'deepseek' | 'together' | 'fireworks' | 'openrouter' | 'cohere' | 'perplexity' | 'xai'
  | 'ollama' | 'lmstudio' | 'llamacpp' | 'custom'

export interface Provider {
  id: string
  vendor: ProviderVendor
  kind: 'cloud' | 'local'
  label: string
  apiKey?: string
  serverUrl?: string
  defaultModel?: string
  createdAt: string
  usage?: { tokens: number; cost?: number } | null
}
