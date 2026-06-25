export interface Channel {
  id: string
  name: string
  topic?: string
  members?: string[]
  createdAt: number
  unreadCount: number
}

export interface ChannelMessage {
  id: string
  channelId: string
  authorId: string
  content: string
  timestamp: number
}
