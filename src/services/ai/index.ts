import type { Provider, AIProvider } from '@/types'
import { AnthropicTransport, ChatCompletionsTransport, OllamaTransport } from './transports'

export function createProvider(provider: Provider): AIProvider {
  switch (provider.vendor) {
    case 'anthropic':
      return new AnthropicTransport(provider.apiKey ?? '')
    case 'ollama':
      return new OllamaTransport(provider.serverUrl)
    case 'lmstudio':
    case 'llamacpp':
    case 'custom':
      return new ChatCompletionsTransport(provider.vendor, provider.apiKey ?? '', provider.serverUrl)
    default:
      return new ChatCompletionsTransport(provider.vendor, provider.apiKey ?? '')
  }
}

export type { AIProvider } from './types'
