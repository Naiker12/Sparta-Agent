import { useState } from 'react'
import { ChannelSidebar } from '@/components/channels/ChannelSidebar'
import { InternalChannelView } from '@/components/channels/InternalChannelView'
import { TelegramIntegrationPanel } from '@/components/channels/TelegramIntegrationPanel'
import { ComingSoonPanel } from '@/components/channels/ComingSoonPanel'
import { ChannelDialog } from '@/components/channels/ChannelDialog'
import { useChannelStore } from '@/stores/channel.store'
import type { IntegrationProvider } from '@/types'

const TELEGRAM: IntegrationProvider = 'telegram'

export function ChannelsView() {
  const { channels, activeChannelId } = useChannelStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  function renderContent() {
    if (!activeChannel) {
      return (
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-ui)',
          }}
        >
          <div style={{ opacity: 0.3, fontSize: 48 }}>💬</div>
          <div>Selecciona un canal</div>
        </div>
      )
    }

    if (activeChannel.kind === 'internal') {
      return <InternalChannelView channel={activeChannel} />
    }

    if (activeChannel.kind === 'integration') {
      const provider = activeChannel.integration?.provider || TELEGRAM
      if (provider === TELEGRAM) {
        return <TelegramIntegrationPanel channel={activeChannel} />
      }
      return <ComingSoonPanel provider={provider} />
    }

    return null
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <ChannelSidebar onNewChannel={() => setDialogOpen(true)} />
      {renderContent()}
      <ChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(n, t, i) => {
          useChannelStore.getState().addChannel(n, t, 'internal', i)
          setDialogOpen(false)
        }}
      />
    </div>
  )
}
