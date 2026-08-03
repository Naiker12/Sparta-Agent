import { createProvider } from '../../ia-sparta-core/src/services/ai'
import type { Provider, ChatRequest, ChatStreamChunk, Message } from 'ia-sparta-core'

export class AIGateway {
  async sendMessage(
    provider: Provider,
    messages: Pick<Message, 'role' | 'content' | 'attachments'>[],
    options?: { system?: string; stream?: boolean }
  ): Promise<AsyncIterable<ChatStreamChunk>> {
    const transport = createProvider(provider)
    const req: ChatRequest = {
      model: provider.defaultModel ?? 'gpt-4',
      messages: messages.map(m => {
        const imageAttachments = m.attachments?.filter(a => a.kind === 'image' && a.base64Data) ?? []
        if (imageAttachments.length > 0) {
          const contentParts = [
            { type: 'text' as const, text: m.content },
            ...imageAttachments.map(img => ({
              type: 'image_url' as const,
              image_url: {
                url: `data:${img.mimeType};base64,${img.base64Data}`,
              },
            })),
          ]
          return { role: m.role, content: contentParts }
        }
        return { role: m.role, content: m.content }
      }),
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
