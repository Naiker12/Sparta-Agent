import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Monitor, MonitorOff } from 'lucide-react'
import { IS_ELECTRON, messagingAdapter } from 'ia-sparta-platform'

/** Shows the active runtime truthfully. Host routing is not implemented yet. */
export function HostPickerButton() {
  const [connected, setConnected] = useState(() => messagingAdapter.isReady())

  useEffect(() => {
    if (IS_ELECTRON) return
    const timer = window.setInterval(() => setConnected(messagingAdapter.isReady()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const label = IS_ELECTRON
    ? 'App de escritorio'
    : connected
      ? 'Web conectada'
      : 'Web sin conexión'
  const Icon = IS_ELECTRON ? Monitor : connected ? CheckCircle : MonitorOff

  return (
    <div
      title={IS_ELECTRON
        ? 'Entorno de escritorio: terminal y archivos locales disponibles.'
        : connected
          ? 'Entorno web conectado al servicio de chat.'
          : 'Entorno web: esperando conexión con el servicio de chat.'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', color: connected || IS_ELECTRON ? 'var(--text-secondary)' : 'var(--status-warn)',
        fontSize: 11.5, fontFamily: 'var(--font-ui)', userSelect: 'none',
      }}
    >
      {connected || IS_ELECTRON
        ? <Icon size={12} strokeWidth={1.7} />
        : <Circle size={12} strokeWidth={1.7} />}
      <span>{label}</span>
    </div>
  )
}
