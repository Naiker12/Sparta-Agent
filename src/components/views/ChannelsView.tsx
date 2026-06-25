import { useState } from 'react'
import { Hash } from 'lucide-react'
import { useChannelStore } from '@/stores/channel.store'
import { ChannelDialog } from '@/components/channels/ChannelDialog'

export function ChannelsView() {
  const { channels, addChannel } = useChannelStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
          Canales
        </h2>
        <button onClick={() => setDialogOpen(true)} style={{
          padding: '5px 12px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}>
          + Nuevo canal
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto', padding: 12 }}>
        {channels.map((channel) => (
          <div key={channel.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', cursor: 'pointer', borderRadius: 'var(--radius-md)',
            marginBottom: 4, transition: 'background 0.12s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Hash size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
              {channel.name}
            </span>
            {channel.topic && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {channel.topic}
              </span>
            )}
            {channel.unreadCount > 0 && (
              <span style={{ fontSize: 10, color: 'white', background: 'var(--accent)', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>
                {channel.unreadCount}
              </span>
            )}
          </div>
        ))}
      </div>

      <ChannelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={(n, t) => { addChannel(n, t); setDialogOpen(false) }} />
    </div>
  )
}
