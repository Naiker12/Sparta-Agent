import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useChannelStore } from '@/stores/channel.store'
import { SidebarSection } from './SidebarSection'
import { ChannelItem } from './ChannelItem'
import { ChannelDialog } from '@/components/channels/ChannelDialog'

export function ChannelsSection() {
  const { channels, addChannel } = useChannelStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleSubmit(name: string, topic?: string) {
    addChannel(name, topic)
    setDialogOpen(false)
  }

  return (
    <>
      <SidebarSection
        title="Canales"
        count={channels.length}
        action={
          <button
            onClick={() => setDialogOpen(true)}
            style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Crear canal"
          >
            <Plus size={11} strokeWidth={2} />
          </button>
        }
      >
        {channels.length === 0 ? (
          <p
            style={{
              padding: '4px 14px 8px',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Sin canales.
          </p>
        ) : (
          channels.map((channel) => <ChannelItem key={channel.id} channel={channel} />)
        )}
      </SidebarSection>

      <ChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
