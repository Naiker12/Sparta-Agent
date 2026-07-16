import { Hash, Plus, Bot, Globe, BookOpen, Code, Terminal, Users, Bell, Star, Camera, MessageSquare } from 'lucide-react'
import type { Channel, IntegrationProvider } from '@/types'
import { useChannelStore } from '@/stores/channel.store'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { IntegrationStatusBadge } from './IntegrationStatusBadge'

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Hash, Bot, Globe, BookOpen, Code, Terminal, Users, Bell, Star, Camera,
}

const BRAND_INTEGRATIONS = new Set<IntegrationProvider>(['telegram', 'discord', 'slack', 'whatsapp'])

interface ChannelSidebarProps {
  onNewChannel: () => void
}

function renderIcon(channel: Channel): React.ReactNode {
  if (channel.kind === 'integration') {
    const provider = channel.integration?.provider || 'telegram'
    if (BRAND_INTEGRATIONS.has(provider)) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <BrandIcon vendor={provider} size={14} />
          <IntegrationStatusBadge status={channel.integration?.status || 'not_configured'} />
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <MessageSquare size={12} strokeWidth={1.5} />
        <IntegrationStatusBadge status={channel.integration?.status || 'not_configured'} />
      </div>
    )
  }

  const iconName = channel.icon || 'Hash'
  const Icon = ICON_MAP[iconName] || Hash
  return <Icon size={12} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
}

export function ChannelSidebar({ onNewChannel }: ChannelSidebarProps) {
  const { channels, activeChannelId } = useChannelStore()
  const internalChannels = channels.filter((c) => c.kind === 'internal')
  const integrationChannels = channels.filter((c) => c.kind === 'integration')

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          CANALES
        </span>
        <button
          onClick={onNewChannel}
          style={{
            width: 20, height: 20, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {internalChannels.map((ch) => (
          <ChannelRow
            key={ch.id}
            channel={ch}
            icon={renderIcon(ch)}
            active={ch.id === activeChannelId}
          />
        ))}

        <div style={{ height: 12 }} />

        {integrationChannels.map((ch) => {
          const isActive = ch.id === activeChannelId
          const isConfigured = ch.integration?.status !== 'not_configured'
          return (
            <ChannelRow
              key={ch.id}
              channel={ch}
              icon={renderIcon(ch)}
              active={isActive}
              dimmed={!isConfigured}
            />
          )
        })}
      </div>
    </div>
  )
}

interface ChannelRowProps {
  channel: Channel
  icon: React.ReactNode
  active: boolean
  dimmed?: boolean
}

function ChannelRow({ channel, icon, active, dimmed }: ChannelRowProps) {
  return (
    <div
      onClick={() => useChannelStore.getState().setActiveChannel(channel.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 14px', cursor: dimmed ? 'not-allowed' : 'pointer',
        background: active ? 'var(--bg-active)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        opacity: dimmed ? 0.5 : 1,
        transition: 'all 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      <span
        style={{
          flex: 1, fontSize: 12, color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {channel.name}
      </span>
      {channel.unreadCount > 0 && (
        <span
          style={{
            fontSize: 10, color: 'white', background: 'var(--accent)',
            padding: '1px 5px', borderRadius: 8, fontWeight: 600,
            fontFamily: 'var(--font-ui)',
          }}
        >
          {channel.unreadCount}
        </span>
      )}
    </div>
  )
}
