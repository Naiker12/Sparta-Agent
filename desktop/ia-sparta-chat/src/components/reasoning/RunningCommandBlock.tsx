/**
 * RunningCommandBlock.tsx — Bloque de UI para mostrar un comando ejecutándose
 * en el Thinking Trace con streaming de output en vivo.
 *
 * Se renderiza cuando un ToolTraceRow detecta toolName === 'run_command'.
 * Muestra: header con el comando, cuerpo con output streaming, y estado final
 * (check/x con exit code) al terminar.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Check, X, Loader2, ChevronRight, Copy } from 'lucide-react'
import type { ToolCall } from 'ia-sparta-core'
import { useChatStore, useSessionStore } from 'ia-sparta-core'

interface RunningCommandBlockProps {
  toolCall: ToolCall
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}

function parseCommandOutput(output: string): {
  exitCode: number | null
  command: string
  body: string
} {
  if (!output) return { exitCode: null, command: '', body: '' }

  const exitMatch = output.match(/exit code:\s*(\d+)/i)
  const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : null

  const cmdMatch = output.match(/\$\s+(.+)/m)
  const command = cmdMatch ? cmdMatch[1].trim() : ''

  // Body is everything after the "$ command" line
  const bodyStart = output.indexOf('\n', output.indexOf('$'))
  const body = bodyStart >= 0 ? output.slice(bodyStart + 1).trim() : ''

  return { exitCode, command, body }
}

export function RunningCommandBlock({ toolCall }: RunningCommandBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'running')
  const [liveOutput, setLiveOutput] = useState('')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const isStreaming = useChatStore((s) => activeSessionId ? (s.streamingBySession[activeSessionId]?.isStreaming ?? false) : s.isStreaming)

  const input = toolCall.input as Record<string, unknown> | undefined
  const commandText = String(input?.command ?? '').trim()
  const cwdText = input?.cwd ? String(input.cwd) : undefined

  const isActuallyRunning = toolCall.status === 'running' && isStreaming
  const isAborted = toolCall.status === 'running' && !isStreaming
  const isCompleted = toolCall.status === 'completed'
  const isError = toolCall.status === 'error'

  // Parse output when completed
  const parsed = useMemo(() => {
    if (!isCompleted && !isError) return null
    const rawOutput = typeof toolCall.output === 'string' ? toolCall.output : ''
    return parseCommandOutput(rawOutput)
  }, [toolCall.output, isCompleted, isError])

  // Listen for live streaming output from terminal:agent-output
  useEffect(() => {
    if (!isActuallyRunning) return
    if (typeof window === 'undefined' || !window.terminal?.onAgentOutput) return

    const unsub = window.terminal.onAgentOutput((payload) => {
      // Match by command text embedded in procId pattern
      setLiveOutput((prev) => prev + stripAnsi(payload.chunk))
    })

    return () => unsub()
  }, [isActuallyRunning])

  // Listen for exit code
  useEffect(() => {
    if (!isActuallyRunning) return
    if (typeof window === 'undefined' || !window.terminal?.onAgentExit) return

    const unsub = window.terminal.onAgentExit((payload) => {
      setExitCode(payload.code)
    })

    return () => unsub()
  }, [isActuallyRunning])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && isExpanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [liveOutput, isExpanded])

  // Auto-collapse when completed
  useEffect(() => {
    if (isCompleted && parsed) {
      setExitCode(parsed.exitCode)
    }
  }, [isCompleted, parsed])

  const handleCopyOutput = useCallback(() => {
    const text = parsed?.body || liveOutput || ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [parsed, liveOutput])

  const displayOutput = isCompleted || isError
    ? (parsed?.body || typeof toolCall.output === 'string' ? stripAnsi(toolCall.output as string) : '')
    : liveOutput

  const finalExitCode = exitCode ?? parsed?.exitCode
  const isSuccess = finalExitCode === 0
  const showExitCode = finalExitCode !== null && finalExitCode !== undefined

  return (
    <div
      style={{
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'var(--font-mono, monospace)',
        margin: 0,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          width: '100%',
          padding: '3px 5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
      >
        {/* Status icon */}
        {isActuallyRunning && !showExitCode ? (
          <Loader2
            size={12}
            style={{ color: 'var(--accent, #a78bfa)', flexShrink: 0 }}
            className="animate-spin"
          />
        ) : isAborted ? (
          <X size={12} style={{ color: 'var(--status-warn, #eab308)', flexShrink: 0 }} />
        ) : showExitCode ? (
          isSuccess ? (
            <Check size={12} style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
          ) : (
            <X size={12} style={{ color: 'var(--status-err)', flexShrink: 0 }} />
          )
        ) : (
          <Terminal size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}

        {/* Command text */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11.5,
            fontWeight: 450,
          }}
        >
          <span style={{ color: 'var(--text-secondary)', marginRight: 5 }}>Ejecutó</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{commandText || 'un comando'}</span>
        </span>

        {/* Duration / exit code */}
        {showExitCode && (
          <span
            style={{
              fontSize: 10,
              color: isSuccess ? 'var(--status-ok)' : 'var(--status-err)',
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            exit {finalExitCode}
          </span>
        )}

        {isActuallyRunning && !showExitCode && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            ejecutando…
          </span>
        )}

        {isAborted && !showExitCode && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            detenido
          </span>
        )}

        {/* Expand chevron */}
        <ChevronRight
          size={12}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Output body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="cmd-output"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                position: 'relative',
              }}
            >
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '4px 8px',
                  gap: 4,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyOutput()
                  }}
                  title="Copiar salida"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copied ? '#22c55e' : 'var(--text-muted)',
                    padding: 2,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              {/* Terminal output */}
              <pre
                ref={outputRef}
                style={{
                  margin: 0,
                  padding: '0 12px 10px',
                  maxHeight: 300,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {displayOutput || (isActuallyRunning ? 'Esperando salida...' : isAborted ? '[Proceso detenido por el usuario]' : '(sin salida)')}
                {isActuallyRunning && !showExitCode && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 14,
                      background: 'var(--accent, #a78bfa)',
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </pre>

              {/* CWD info */}
              {cwdText && (
                <div
                  style={{
                    padding: '4px 12px 8px',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                  }}
                >
                  📁 {cwdText}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
