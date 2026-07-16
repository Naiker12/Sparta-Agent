import type { AIProvider } from '../types'
import type { ChatRequest } from '../../../types'

export abstract class BaseTransport implements AIProvider {
  abstract readonly vendor: AIProvider['vendor']
  abstract readonly kind: AIProvider['kind']

  abstract buildHeaders(): Record<string, string>
  abstract buildBody(req: ChatRequest): Record<string, unknown>

  abstract listModels(): ReturnType<AIProvider['listModels']>
  abstract testConnection(): ReturnType<AIProvider['testConnection']>
  abstract streamChat(req: Parameters<AIProvider['streamChat']>[0]): ReturnType<AIProvider['streamChat']>
}
