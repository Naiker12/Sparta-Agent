import { useEffect, useState } from 'react'
import { Bot, Clock, Sparkles, Circle, Zap, Brain, FolderOpen, FolderX } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { useAgentStore } from 'ia-sparta-core'
import { useCronStore } from 'ia-sparta-core'
import { useUsageStore } from 'ia-sparta-core'
import { useProjectStore } from 'ia-sparta-core'
import { BrandIcon } from 'ia-sparta-design-system'
import { GatewayStatusDialog } from './GatewayStatusDialog'
import { TokenUsageDialog } from './TokenUsageDialog'
import { AgentsStatusDialog } from './AgentsStatusDialog'
import { CronStatusDialog } from './CronStatusDialog'
import { IS_WEB } from 'ia-sparta-core'
import { useWebSocketStatus } from 'ia-sparta-core'
import { messagingAdapter } from 'ia-sparta-core'
import { DEFAULT_SPINNER } from 'ia-sparta-core'

export function StatusBar() {
  const [appVersion, setAppVersion] = useState('')
  const activeModel = useSettingsStore((s) => s.activeModel)
  const providers = useProviderStore((s) => s.providers)
  const activeProvider = providers.find((p) => p.defaultModel === activeModel)
  const streamingBySession = useChatStore((s) => s.streamingBySession)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const agents = useAgentStore((s) => s.agents)
  const cronJobs = useCronStore((s) => s.jobs)
  const totalInput = useUsageStore((s) => s.totalInput)
  const totalOutput = useUsageStore((s) => s.totalOutput)
  const activeProject = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const hasProjectRoot = !!activeProject?.rootPath
  const projectName = activeProject?.name

  const [gatewayOpen, setGatewayOpen] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [cronOpen, setCronOpen] = useState(false)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const sbSpinner = DEFAULT_SPINNER

  const wsStatus = useWebSocketStatus()
  const [sidecarReady, setSidecarReady] = useState(false)

  const isThinking = Object.values(messagesBySession).some((msgs) =>
    msgs.some((m) => m.thinkingStatus === 'streaming' || m.thinkingStatus === 'starting')
  )

  // Thinking spinner animation
  useEffect(() => {
    if (!isThinking) { setSpinnerFrame(0); return }
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % sbSpinner.frames.length)
    }, sbSpinner.interval)
    return () => clearInterval(interval)
  }, [isThinking, sbSpinner])

  useEffect(() => {
    if (IS_WEB) return
    const check = async () => {
      try {
        const ready = messagingAdapter.isReady()
        setSidecarReady(ready)
      } catch {
        setSidecarReady(false)
      }
    }
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [])

  const bgStreamingCount = Object.entries(streamingBySession)
    .filter(([sid, state]) => state.isStreaming && sid !== activeSessionId)
    .length
  const runningAgentCount = agents.filter((a) => a.status === 'running' || a.status === 'thinking').length
  const cronActiveCount = cronJobs.filter((j) => j.enabled).length
  const totalTokens = totalInput + totalOutput

  useEffect(() => {
    if (!window.electronAPI?.getVersion) {
      setAppVersion('0.0.0')
      return
    }
    window.electronAPI.getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.0.0'))
  }, [])

  const wsColors: Record<string, string> = {
    connected: 'var(--status-ok)',
    connecting: 'var(--status-warn)',
    disconnected: 'var(--destructive)',
  }

  const wsLabels: Record<string, string> = {
    connected: 'Sidecar conectado',
    connecting: 'Conectando...',
    disconnected: 'Sidecar desconectado',
  }

  return (
    <>
      <div
        className="flex items-center shrink-0 px-3"
        style={{
          height: 'var(--statusbar-h)',
          background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {IS_WEB ? (
          <SBItem>
            <Circle
              size={6}
              strokeWidth={3}
              fill={wsColors[wsStatus]}
              style={{ color: wsColors[wsStatus] }}
            />
            {wsLabels[wsStatus]}
          </SBItem>
        ) : (
          <SBItem onClick={() => setGatewayOpen(true)} style={{ color: sidecarReady ? 'var(--status-ok)' : 'var(--destructive)' }}>
            <Zap size={11} strokeWidth={1.5} />
            {sidecarReady ? 'AI listo' : 'AI offline'}
          </SBItem>
        )}
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

        {isThinking && (
          <SBItem style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            <Brain size={11} strokeWidth={1.5} style={{ marginRight: 2 }} />
            {sbSpinner.frames[spinnerFrame]}
          </SBItem>
        )}

        <div className="flex-1" />

        <SBItem
          style={{ color: hasProjectRoot ? 'var(--status-ok)' : 'var(--status-warn)' }}
          title={hasProjectRoot
            ? `Proyecto: ${activeProject!.rootPath}`
            : 'Sin carpeta de proyecto abierta — herramientas de archivos desactivadas'}
        >
          {hasProjectRoot
            ? <FolderOpen size={11} strokeWidth={1.5} />
            : <FolderX size={11} strokeWidth={1.5} />}
          {projectName ?? 'Sin proyecto'}
        </SBItem>

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

function SBItem({ children, style, onClick, title }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void; title?: string }) {
  return (
    <div
      title={title}
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
