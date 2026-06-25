import type { Channel } from '@/types'

interface ChannelItemProps {
  channel: Channel
}

export function ChannelItem({ channel }: ChannelItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        style={{
          color: 'var(--text-muted)',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        #
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {channel.name}
      </span>
      {channel.unreadCount > 0 && (
        <span
          style={{
            fontSize: 10,
            color: 'white',
            background: 'var(--accent)',
            padding: '1px 5px',
            borderRadius: 8,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
          }}
        >
          {channel.unreadCount}
        </span>
      )}
    </div>
  )
}
