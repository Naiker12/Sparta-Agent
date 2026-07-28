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
  const [isExpanded, setIsExpanded] = useState(true)
  const [liveOutput, setLiveOutput] = useState('')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  const input = toolCall.input as Record<string, unknown> | undefined
  const commandText = String(input?.command ?? '').trim()
  const cwdText = input?.cwd ? String(input.cwd) : undefined

  const isRunning = toolCall.status === 'running'
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
    if (!isRunning) return
    if (typeof window === 'undefined' || !window.terminal?.onAgentOutput) return

    const unsub = window.terminal.onAgentOutput((payload) => {
      // Match by command text embedded in procId pattern
      setLiveOutput((prev) => prev + stripAnsi(payload.chunk))
    })

    return () => unsub()
  }, [isRunning])

  // Listen for exit code
  useEffect(() => {
    if (!isRunning) return
    if (typeof window === 'undefined' || !window.terminal?.onAgentExit) return

    const unsub = window.terminal.onAgentExit((payload) => {
      setExitCode(payload.code)
    })

    return () => unsub()
  }, [isRunning])

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
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated, #1a1a2e)',
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'var(--font-mono, monospace)',
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
      >
        {/* Status icon */}
        {isRunning && !showExitCode ? (
          <Loader2
            size={14}
            style={{ color: 'var(--accent, #a78bfa)', flexShrink: 0 }}
            className="animate-spin"
          />
        ) : showExitCode ? (
          isSuccess ? (
            <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
          ) : (
            <X size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          )
        ) : (
          <Terminal size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}

        {/* Command text */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>$</span>
          {commandText || 'Ejecutando comando...'}
        </span>

        {/* Duration / exit code */}
        {showExitCode && (
          <span
            style={{
              fontSize: 10,
              color: isSuccess ? '#22c55e' : '#ef4444',
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            exit {finalExitCode}
          </span>
        )}

        {isRunning && !showExitCode && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--accent, #a78bfa)',
              flexShrink: 0,
            }}
          >
            ejecutando…
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
                {displayOutput || (isRunning ? 'Esperando salida...' : '(sin salida)')}
                {isRunning && !showExitCode && (
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
