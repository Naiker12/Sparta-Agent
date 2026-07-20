import { Bot } from 'lucide-react'
import { useAgentStore } from 'ia-sparta-core'

interface AgentStatusIndicatorProps {
  onClick?: () => void
  showLabel?: boolean
  className?: string
}

export function AgentStatusIndicator({ onClick, showLabel = true, className }: AgentStatusIndicatorProps) {
  const agents = useAgentStore((s) => s.agents)
  const runningAgentCount = agents.filter((a) => a.status === 'running' || a.status === 'thinking').length

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        height: '100%',
        fontSize: 11,
        color: runningAgentCount > 0 ? 'var(--status-warn)' : 'var(--text-secondary)',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.background = 'transparent' }}
    >
      <Bot size={11} strokeWidth={1.5} />
      {showLabel && (
        <span>
          Agents{runningAgentCount > 0 ? ` (${runningAgentCount})` : ''}
        </span>
      )}
    </div>
  )
}