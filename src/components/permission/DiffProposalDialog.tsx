import { useEffect, useState } from 'react'
import { useEventBus } from '@/stores/event-bus.store'
import { X, Check, FileCode } from 'lucide-react'

interface DiffProposal {
  requestId: string
  filePath: string
  originalContent: string
  newContent: string
  language: string
}

export function DiffProposalDialog() {
  const [proposal, setProposal] = useState<DiffProposal | null>(null)
  const [diffHtml, setDiffHtml] = useState('')

  useEffect(() => {
    const unsub = useEventBus.getState().subscribe((event) => {
      if (event.type === 'editor:diff_proposed') {
        const e = event as unknown as DiffProposal
        setProposal(e)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!proposal) return
    // Generate a simple line-by-line diff view
    const origLines = proposal.originalContent.split('\n')
    const newLines = proposal.newContent.split('\n')
    const maxLen = Math.max(origLines.length, newLines.length)
    const lines: string[] = []

    for (let i = 0; i < maxLen; i++) {
      const oldLine = origLines[i] ?? ''
      const newLine = newLines[i] ?? ''
      if (i >= origLines.length) {
        lines.push(`<div style="background:rgba(34,197,94,0.12);padding:1px 8px;font-family:var(--font-mono);font-size:11px;border-left:3px solid #22c55e"><span style="color:#22c55e;margin-right:8px;user-select:none">+</span>${escHtml(newLine)}</div>`)
      } else if (i >= newLines.length) {
        lines.push(`<div style="background:rgba(239,68,68,0.12);padding:1px 8px;font-family:var(--font-mono);font-size:11px;border-left:3px solid #ef4444"><span style="color:#ef4444;margin-right:8px;user-select:none">-</span>${escHtml(oldLine)}</div>`)
      } else if (oldLine !== newLine) {
        lines.push(`<div style="background:rgba(239,68,68,0.12);padding:1px 8px;font-family:var(--font-mono);font-size:11px;border-left:3px solid #ef4444"><span style="color:#ef4444;margin-right:8px;user-select:none">-</span>${escHtml(oldLine)}</div>`)
        lines.push(`<div style="background:rgba(34,197,94,0.12);padding:1px 8px;font-family:var(--font-mono);font-size:11px;border-left:3px solid #22c55e"><span style="color:#22c55e;margin-right:8px;user-select:none">+</span>${escHtml(newLine)}</div>`)
      } else {
        lines.push(`<div style="padding:1px 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);border-left:3px solid transparent"><span style="margin-right:8px;user-select:none;opacity:0.4">${i + 1}</span>${escHtml(oldLine)}</div>`)
      }
    }
    setDiffHtml(lines.join(''))
  }, [proposal])

  if (!proposal) return null

  const handleRespond = async (approved: boolean) => {
    await window.editorBridge?.respondDiff({ requestId: proposal.requestId, approved })
    setProposal(null)
    setDiffHtml('')
  }

  const fileName = proposal.filePath.split(/[\\/]/).pop() ?? proposal.filePath

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-strong)',
        borderRadius: 14,
        width: 700,
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)',
          }}>
            <FileCode size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Cambio propuesto por el agente
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {fileName}
            </div>
          </div>
          <button
            onClick={() => handleRespond(false)}
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              background: 'transparent', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Diff content */}
        <div style={{
          flex: 1, overflow: 'auto', padding: '8px 0',
          background: 'var(--bg-elevated)',
        }}>
          <div style={{ padding: '0 16px', marginBottom: 8, fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
            <span><span style={{ color: '#ef4444' }}>─</span> original</span>
            <span><span style={{ color: '#22c55e' }}>+</span> modificado</span>
            <span style={{ marginLeft: 'auto' }}>{proposal.language || 'texto'}</span>
          </div>
          <div dangerouslySetInnerHTML={{ __html: diffHtml }} />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => handleRespond(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              background: 'transparent', border: '1px solid var(--border-normal)',
              color: 'var(--text-secondary)', transition: 'all 0.12s',
            }}
          >
            <X size={13} />
            <span>Rechazar</span>
          </button>
          <button
            onClick={() => handleRespond(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              background: 'var(--accent)', border: '1px solid var(--accent)',
              color: '#fff', transition: 'all 0.12s',
            }}
          >
            <Check size={13} />
            <span>Aceptar cambio</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
