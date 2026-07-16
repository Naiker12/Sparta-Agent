import type { Message, Session } from 'ia-sparta-core'

export interface ChatService {
  createSession(title?: string): Session
  sendMessage(sessionId: string, content: string): Promise<void>
  getMessages(sessionId: string): Message[]
  deleteSession(sessionId: string): void
}

export function createChatService(): ChatService {
  const sessions = new Map<string, Session>()
  const messages = new Map<string, Message[]>()

  return {
    createSession(title?: string): Session {
      const session: Session = {
        id: crypto.randomUUID(),
        title: title || 'Nueva conversación',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: 'default',
        messageCount: 0,
      }
      sessions.set(session.id, session)
      messages.set(session.id, [])
      return session
    },

    async sendMessage(sessionId: string, content: string): Promise<void> {
      // Will be implemented with AI gateway in next phase
      void sessionId
      void content
    },

    getMessages(sessionId: string): Message[] {
      return messages.get(sessionId) ?? []
    },

    deleteSession(sessionId: string): void {
      sessions.delete(sessionId)
      messages.delete(sessionId)
    },
  }
}
