import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Channel } from '@/types'
import { useEventBus } from './event-bus.store'

interface ChannelState {
  channels: Channel[]
  addChannel: (name: string, topic?: string) => string
  deleteChannel: (id: string) => void
  markRead: (id: string) => void
}

export const useChannelStore = create<ChannelState>()(
  persist(
    (set) => ({
  channels: [
    { id: 'general', name: 'general', topic: 'Discusión general', createdAt: Date.now(), unreadCount: 0 },
    { id: 'agentes', name: 'agentes', topic: 'Agentes y automatización', createdAt: Date.now(), unreadCount: 0 },
  ],

  addChannel: (name, topic) => {
    const id = crypto.randomUUID()
    const channel: Channel = { id, name, topic, createdAt: Date.now(), unreadCount: 0 }
    set((s) => ({ channels: [...s.channels, channel] }))
    useEventBus.getState().dispatch({ type: 'channel:created', channelId: id, timestamp: Date.now() })
    return id
  },

  deleteChannel: (id) => {
    set((s) => ({ channels: s.channels.filter((c) => c.id !== id) }))
    useEventBus.getState().dispatch({ type: 'channel:deleted', channelId: id, timestamp: Date.now() })
  },

  markRead: (id) => {
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    }))
  },
}),
    { name: 'sparta-channels' }
  )
)
