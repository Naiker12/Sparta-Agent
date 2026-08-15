import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export interface ToolFallbackProps {
  toolName: string
  args?: Record<string, unknown> | string
  result?: unknown
  status?: 'running' | 'success' | 'error'
  durationMs?: number
}

export function ToolFallback({
  toolName,
  args,
  result,
  status = 'success',
  durationMs,
}: ToolFallbackProps) {
  const [isOpen, setIsOpen] = useState(false)

  const formattedArgs = typeof args === 'string' ? args : JSON.stringify(args ?? {}, null, 2)
  const formattedResult = typeof result === 'string' ? result : JSON.stringify(result ?? {}, null, 2)

  return (
    <div className="my-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 font-mono font-medium text-[var(--text-primary)]">
          {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />}
          {status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-[var(--status-ok)]" />}
          {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-[var(--status-err)]" />}
          {!['running', 'success', 'error'].includes(status) && <Wrench className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          <span>{toolName}</span>
          {durationMs !== undefined && (
            <span className="text-[10px] text-[var(--text-muted)] font-sans">
              ({durationMs}ms)
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2 font-mono text-[11px]">
          {args && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-sans">
                Argumentos
              </div>
              <pre className="p-2 rounded bg-[var(--bg-base)] text-[var(--text-secondary)] overflow-x-auto max-h-40">
                {formattedArgs}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 font-sans">
                Resultado
              </div>
              <pre className="p-2 rounded bg-[var(--bg-base)] text-[var(--text-primary)] overflow-x-auto max-h-40">
                {formattedResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
