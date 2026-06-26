import { createProvider } from './index'
import type { Provider, ChatRequest, ChatStreamChunk, Message } from '@/interfaces'

export class AIGateway {
  async sendMessage(
    provider: Provider,
    messages: Pick<Message, 'role' | 'content'>[],
    options?: { system?: string; stream?: boolean }
  ): Promise<AsyncIterable<ChatStreamChunk>> {
    const transport = createProvider(provider)
    const req: ChatRequest = {
      model: provider.defaultModel ?? 'gpt-4',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      system: options?.system,
      stream: options?.stream ?? true,
    }
    return transport.streamChat(req)
  }

  async testConnection(provider: Provider): Promise<{ ok: boolean; error?: string }> {
    const transport = createProvider(provider)
    return transport.testConnection()
  }

  async listModels(provider: Provider) {
    const transport = createProvider(provider)
    return transport.listModels()
  }
}

export const aiGateway = new AIGateway()
