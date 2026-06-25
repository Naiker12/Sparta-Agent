import { useState } from 'react'
import { Hash, Send, MessageSquare } from 'lucide-react'
import type { Channel } from '@/types'

interface InternalChannelViewProps {
  channel: Channel
}

export function InternalChannelView({ channel }: InternalChannelViewProps) {
  const [input, setInput] = useState('')

  function handleSend() {
    if (!input.trim()) return
    setInput('')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Hash size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            {channel.name}
          </span>
        </div>
        {channel.topic && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 2, marginLeft: 24 }}>
            {channel.topic}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 40 }}>
        <MessageSquare size={28} style={{ color: 'var(--text-muted)', opacity: 0.3 }} strokeWidth={1} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
          Sin mensajes aún
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
          Los mensajes de este canal aparecerán aquí
        </div>
      </div>

      <div
        style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`Mensaje en #${channel.name}`}
            style={{
              flex: 1, padding: '7px 12px', fontSize: 12,
              background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              padding: '7px 14px', background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
              fontFamily: 'var(--font-ui)', cursor: 'pointer',
              opacity: input.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Send size={11} strokeWidth={2} />
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
