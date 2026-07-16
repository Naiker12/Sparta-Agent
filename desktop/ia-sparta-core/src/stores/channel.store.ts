import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Channel, ChannelKind } from '../types'
import { useEventBus } from './event-bus.store'

interface ChannelState {
  channels: Channel[]
  activeChannelId: string | null
  addChannel: (name: string, topic?: string, kind?: ChannelKind, icon?: string) => string
  deleteChannel: (id: string) => void
  markRead: (id: string) => void
  setActiveChannel: (id: string | null) => void
  updateIntegration: (id: string, partial: Partial<Channel['integration']>) => void
}

const defaultChannels: Channel[] = [
  {
    id: 'general', name: 'general', topic: 'Discusión general',
    createdAt: Date.now(), unreadCount: 0, kind: 'internal', members: [],
    icon: 'Hash',
  },
  {
    id: 'agentes', name: 'agentes', topic: 'Agentes y automatización',
    createdAt: Date.now(), unreadCount: 0, kind: 'internal', members: [],
    icon: 'Bot',
  },
  {
    id: 'telegram', name: 'Telegram',
    createdAt: Date.now(), unreadCount: 0, kind: 'integration', members: [],
    integration: { provider: 'telegram', status: 'not_configured' },
  },
  {
    id: 'discord', name: 'Discord',
    createdAt: Date.now(), unreadCount: 0, kind: 'integration', members: [],
    integration: { provider: 'discord', status: 'not_configured' },
  },
  {
    id: 'slack', name: 'Slack',
    createdAt: Date.now(), unreadCount: 0, kind: 'integration', members: [],
    integration: { provider: 'slack', status: 'not_configured' },
  },
  {
    id: 'whatsapp', name: 'WhatsApp',
    createdAt: Date.now(), unreadCount: 0, kind: 'integration', members: [],
    integration: { provider: 'whatsapp', status: 'not_configured' },
  },
  {
    id: 'email', name: 'Email',
    createdAt: Date.now(), unreadCount: 0, kind: 'integration', members: [],
    integration: { provider: 'email', status: 'not_configured' },
  },
]

export const useChannelStore = create<ChannelState>()(
  persist(
    (set) => ({
      channels: defaultChannels,
      activeChannelId: null,

  addChannel: (name, topic, kind = 'internal', icon?: string) => {
    const id = crypto.randomUUID()
    const channel: Channel = { id, name, topic, createdAt: Date.now(), unreadCount: 0, kind, icon }
        set((s) => ({ channels: [...s.channels, channel] }))
        useEventBus.getState().dispatch({ type: 'channel:created', channelId: id, timestamp: Date.now() })
        return id
      },

      deleteChannel: (id) => {
        set((s) => ({
          channels: s.channels.filter((c) => c.id !== id),
          activeChannelId: s.activeChannelId === id ? null : s.activeChannelId,
        }))
        useEventBus.getState().dispatch({ type: 'channel:deleted', channelId: id, timestamp: Date.now() })
      },

      markRead: (id) => {
        set((s) => ({
          channels: s.channels.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
        }))
      },

      setActiveChannel: (id) => set({ activeChannelId: id }),

      updateIntegration: (id, partial) => {
        set((s) => ({
          channels: s.channels.map((c) =>
            c.id === id && c.integration
              ? { ...c, integration: { ...c.integration, ...partial } }
              : c
          ),
        }))
      },
    }),
    { name: 'sparta-channels' }
  )
)
