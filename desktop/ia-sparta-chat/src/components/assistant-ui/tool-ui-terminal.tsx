import { useState } from 'react'
import { Terminal, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

export interface ToolTerminalProps {
  command: string
  cwd?: string
  output?: string
  exitCode?: number
  isExecuting?: boolean
  durationMs?: number
}

export function ToolUITerminal({
  command,
  cwd,
  output,
  exitCode,
  isExecuting = false,
  durationMs,
}: ToolTerminalProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const isSuccess = exitCode === 0
  const isError = exitCode !== undefined && exitCode !== 0

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (output) {
      navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="my-2.5 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] overflow-hidden shadow-sm text-xs font-mono">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-pointer select-none hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium truncate pr-2">
          {isExecuting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)] shrink-0" />
          ) : isSuccess ? (
            <CheckCircle className="w-3.5 h-3.5 text-[var(--status-ok)] shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-[var(--status-err)] shrink-0" />
          ) : (
            <Terminal className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          )}
          <span className="text-[var(--accent)]">$</span>
          <span className="truncate">{command}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[var(--text-muted)] text-[11px]">
          {durationMs !== undefined && <span>{durationMs}ms</span>}
          {output && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              title="Copiar salida"
            >
              {copied ? <Check className="w-3 h-3 text-[var(--status-ok)]" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 bg-[var(--bg-base)] space-y-2">
          {cwd && (
            <div className="text-[10px] text-[var(--text-muted)] font-sans">
              Directorio: <code className="font-mono text-[var(--text-secondary)]">{cwd}</code>
            </div>
          )}
          {output ? (
            <pre className="text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
              {output}
            </pre>
          ) : isExecuting ? (
            <div className="text-[11px] text-[var(--text-muted)] italic">Ejecutando comando...</div>
          ) : (
            <div className="text-[11px] text-[var(--text-muted)] italic">Sin salida</div>
          )}
        </div>
      )}
    </div>
  )
}
