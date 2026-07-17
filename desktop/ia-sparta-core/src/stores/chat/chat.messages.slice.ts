import type { StateCreator } from 'zustand'
import type { ChatState } from './chat.store'

import { createMessagesCRUDSlice, type MessagesCRUDSlice } from './messages-crud.slice'
import { createMessagesStreamingSlice, type MessagesStreamingSlice } from './messages-streaming.slice'
import { createMessagesToolCallSlice, type MessagesToolCallSlice } from './messages-toolcall.slice'
import { createMessagesThinkingSlice, type MessagesThinkingSlice } from './messages-thinking.slice'
import { createMessagesLifecycleSlice, type MessagesLifecycleSlice } from './messages-lifecycle.slice'

export type MessagesSlice = MessagesCRUDSlice & MessagesStreamingSlice & MessagesToolCallSlice & MessagesThinkingSlice & MessagesLifecycleSlice & {
  messagesBySession: Record<string, import('../../types').Message[]>
}

export const createMessagesSlice: StateCreator<ChatState, [], [], MessagesSlice> = (...a) => ({
  messagesBySession: {},
  ...createMessagesCRUDSlice(...a),
  ...createMessagesStreamingSlice(...a),
  ...createMessagesToolCallSlice(...a),
  ...createMessagesThinkingSlice(...a),
  ...createMessagesLifecycleSlice(...a),
})
