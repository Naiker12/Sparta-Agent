import { useEffect, useState, useRef } from 'react'
import { getRandomSpinner } from 'ia-sparta-core'
import type { Message } from 'ia-sparta-core'

const STALL_TIMEOUT_MS = 2000
const stallSpinner = getRandomSpinner()

interface StreamStallIndicatorProps {
  streaming: boolean
  message?: Message
}

function getStallMessage(message?: Message): string {
  if (!message?.toolCalls?.length) return 'Pensando…'

  const running = message.toolCalls.filter((tc) => tc.status === 'running')
  if (running.length === 0) return 'Procesando…'

  const tc = running[running.length - 1]
  const elapsed = tc.startedAt ? Math.floor((Date.now() - tc.startedAt) / 1000) : 0

  if (tc.toolName === 'web_search' || tc.toolName === 'web_search_tool') {
    return elapsed > 8 ? 'Esperando resultados de búsqueda…' : 'Buscando en la web…'
  }
  if (tc.toolName === 'web_fetch' || tc.toolName === 'web_fetch_tool') {
    return elapsed > 10 ? 'Leyendo página (puede tardar)…' : 'Leyendo página…'
  }
  if (tc.toolName === 'terminal_execute_tool' || tc.toolName === 'terminal_execute_background_tool') {
    return elapsed > 15 ? 'Comando largo en ejecución…' : 'Ejecutando comando…'
  }
  if (tc.toolName === 'read_file_tool' || tc.toolName === 'read_files_tool') {
    return 'Leyendo archivos…'
  }
  if (tc.toolName === 'write_file_tool' || tc.toolName === 'patch_file_tool') {
    return 'Escribiendo archivo…'
  }

  return running.length > 1 ? `Ejecutando ${running.length} herramientas…` : 'Ejecutando herramienta…'
}

export function StreamStallIndicator({ streaming, message }: StreamStallIndicatorProps) {
  const [stalled, setStalled] = useState(false)
  const [spinner, setSpinner] = useState(0)
  const [stallMessage, setStallMessage] = useState('')
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!streaming) {
      setStalled(false)
      if (stallTimer.current) clearTimeout(stallTimer.current)
      if (msgTimer.current) clearInterval(msgTimer.current)
      return
    }

    stallTimer.current = setTimeout(() => {
      setStalled(true)
      setStallMessage(getStallMessage(message))
    }, STALL_TIMEOUT_MS)

    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current)
      if (msgTimer.current) clearInterval(msgTimer.current)
    }
  }, [streaming, message?.toolCalls?.length])

  // Update message periodically while stalled (substatus may change)
  useEffect(() => {
    if (!stalled) return
    msgTimer.current = setInterval(() => {
      setStallMessage(getStallMessage(message))
    }, 3000)
    return () => { if (msgTimer.current) clearInterval(msgTimer.current) }
  }, [stalled, message])

  useEffect(() => {
    if (!stalled) return
    const interval = setInterval(() => {
      setSpinner((s) => (s + 1) % stallSpinner.frames.length)
    }, stallSpinner.interval)
    return () => clearInterval(interval)
  }, [stalled])

  if (!stalled) return null

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        marginTop: 4,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{stallSpinner.frames[spinner]}</span>
      {stallMessage}
    </div>
  )
}
