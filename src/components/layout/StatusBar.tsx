import { useEffect, useState } from 'react'
import { Bot, Clock, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChatStore } from '@/stores/chat.store'
import { useAgentStore } from '@/stores/agent.store'
import { useCronStore } from '@/stores/cron.store'
import { useUsageStore } from '@/stores/usage.store'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { GatewayStatusDialog } from './GatewayStatusDialog'
import { TokenUsageDialog } from './TokenUsageDialog'
import { AgentsStatusDialog } from './AgentsStatusDialog'
import { CronStatusDialog } from './CronStatusDialog'

export function StatusBar() {
  const [appVersion, setAppVersion] = useState('')
  const activeModel = useSettingsStore((s) => s.activeModel)
  const providers = useProviderStore((s) => s.providers)
  const activeProvider = providers.find((p) => p.defaultModel === activeModel)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const agents = useAgentStore((s) => s.agents)
  const cronJobs = useCronStore((s) => s.jobs)
  const totalInput = useUsageStore((s) => s.totalInput)
  const totalOutput = useUsageStore((s) => s.totalOutput)

  const [gatewayOpen, setGatewayOpen] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [cronOpen, setCronOpen] = useState(false)

  const bgStreamingCount = Object.entries(streamingBySession)
    .filter(([sid, state]) => state.isStreaming && sid !== activeSessionId)
    .length
  const runningAgentCount = agents.filter((a) => a.status === 'running' || a.status === 'thinking').length
  const cronActiveCount = cronJobs.filter((j) => j.enabled).length
  const totalTokens = totalInput + totalOutput

  useEffect(() => {
    try {
      const p = window.electronAPI?.getVersion()
      if (p?.then) {
        p.then(setAppVersion).catch(() => setAppVersion('0.0.0'))
      } else {
        setAppVersion('0.0.0')
      }
    } catch {
      setAppVersion('0.0.0')
    }
  }, [])

  return (
    <>
      <div style={{
        height: 'var(--statusbar-h)',
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        flexShrink: 0,
      }}>
        <SBItem onClick={() => setGatewayOpen(true)}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--status-ok)',
            boxShadow: '0 0 0 2px rgba(34,197,94,0.2)',
          }} />
          Gateway ready
        </SBItem>
        <SBItem onClick={() => setAgentsOpen(true)} style={{ color: runningAgentCount > 0 ? 'var(--status-warn)' : undefined }}>
          <Bot size={11} strokeWidth={1.5} />
          Agents{runningAgentCount > 0 ? ` (${runningAgentCount})` : ''}
        </SBItem>
        <SBItem onClick={() => setCronOpen(true)}>
          <Clock size={11} strokeWidth={1.5} />
          Cron{cronActiveCount > 0 ? ` (${cronActiveCount})` : ''}
        </SBItem>

        {bgStreamingCount > 0 && (
          <SBItem style={{ color: 'var(--status-think)' }}>
            <Sparkles size={11} strokeWidth={1.5} />
            {bgStreamingCount} generando en background
          </SBItem>
        )}

        <div style={{ flex: 1 }} />

        <SBItem style={{ borderLeft: '1px solid var(--border-subtle)' }}>
          {activeProvider ? <BrandIcon vendor={activeProvider.vendor} size={14} /> : null}
          {activeModel}
        </SBItem>
        <SBItem onClick={() => setTokenOpen(true)}>
          {totalTokens.toLocaleString()} tok
        </SBItem>
        <SBItem style={{ color: 'var(--text-muted)' }}>v{appVersion || '0.0.0'}</SBItem>
      </div>

      <GatewayStatusDialog open={gatewayOpen} onClose={() => setGatewayOpen(false)} />
      <TokenUsageDialog open={tokenOpen} onClose={() => setTokenOpen(false)} />
      <AgentsStatusDialog open={agentsOpen} onClose={() => setAgentsOpen(false)} />
      <CronStatusDialog open={cronOpen} onClose={() => setCronOpen(false)} />
    </>
  )
}

function SBItem({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        height: '100%',
        fontSize: 11,
        color: 'var(--text-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.1s',
        ...style,
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </div>
  )
}
