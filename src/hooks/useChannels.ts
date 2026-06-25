import { useChannelStore } from '@/stores/channel.store'

export function useChannels() {
  const store = useChannelStore()
  return {
    channels: store.channels,
    addChannel: store.addChannel,
    deleteChannel: store.deleteChannel,
    markRead: store.markRead,
  }
}
