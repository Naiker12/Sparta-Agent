import { Plug, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export type McpToolCallStatus = 'running' | 'success' | 'error'

export interface McpToolCallChipProps {
  serverId: string
  toolName: string
  status: McpToolCallStatus
  args?: unknown
  result?: unknown
  error?: string
}

export function McpToolCallChip({
  serverId,
  toolName,
  status,
  error,
}: McpToolCallChipProps) {
  const isRunning = status === 'running'
  const isSuccess = status === 'success'
  const isError = status === 'error'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'var(--font-mono, monospace)',
        background: isError
          ? 'rgba(239, 68, 68, 0.1)'
          : isSuccess
          ? 'rgba(34, 197, 94, 0.1)'
          : 'rgba(59, 130, 246, 0.1)',
        border: `1px solid ${
          isError
            ? 'rgba(239, 68, 68, 0.3)'
            : isSuccess
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(59, 130, 246, 0.3)'
        }`,
        color: isError
          ? '#ef4444'
          : isSuccess
          ? '#4ade80'
          : '#60a5fa',
        margin: '6px 0',
        maxWidth: '100%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Plug style={{ width: 14, height: 14, flexShrink: 0 }} />

      <span style={{ fontWeight: 600 }}>
        {serverId} → {toolName}
      </span>

      {isRunning && (
        <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
      )}

      {isSuccess && (
        <CheckCircle style={{ width: 14, height: 14 }} />
      )}

      {isError && (
        <AlertCircle style={{ width: 14, height: 14 }} />
      )}

      {isError && error && (
        <span style={{ fontSize: '11px', opacity: 0.85, marginLeft: '4px' }}>
          ({error})
        </span>
      )}
    </div>
  )
}
