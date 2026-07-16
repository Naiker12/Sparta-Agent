import { useState } from 'react'
import { X, ExternalLink, Tag, Calendar, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MemoryEntry, MemoryGraphNode } from '@/types'
import { getGraphNodeColor } from '@/lib/graph-colors'
import { useSessionStore } from '@/stores/session.store'
import { useMemoryStore } from '@/stores/memory.store'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

interface MemoryNodePanelProps {
  entry: MemoryEntry
  graphNode?: MemoryGraphNode
  onClose: () => void
}

export function MemoryNodePanel({ entry, onClose }: MemoryNodePanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const nodeColor = getGraphNodeColor(entry.source, entry.category)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 380,
        maxWidth: 'calc(100% - 32px)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: nodeColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            {entry.source === 'auto' ? 'Aprendido' : 'Manual'}
          </span>
        </div>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon-xs" onClick={() => setConfirmOpen(true)} title="Eliminar nodo">
            <Trash2 size={12} strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X size={12} strokeWidth={2} />
          </Button>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5, margin: '4px 0 8px', wordBreak: 'break-word' }}>
        {entry.content}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {entry.category && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <Tag size={9} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {entry.category}
            </span>
          </div>
        )}
        {entry.projectId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <ExternalLink size={9} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {entry.projectId}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Calendar size={9} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>

      {entry.sourceSessionId && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
            ORIGEN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <MessageSquare size={9} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              Conversación · {entry.sourceSessionId.slice(0, 8)}...
            </span>
          </div>
          {entry.sourceMessageId && (
            <button
              onClick={() => {
                useSessionStore.getState().switchSession(entry.sourceSessionId!)
              }}
              style={{
                fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', marginTop: 2,
              }}
            >
              → Ver conversación
            </button>
          )}
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        itemLabel={entry.content.slice(0, 60) + (entry.content.length > 60 ? '…' : '')}
        onConfirm={() => { useMemoryStore.getState().deleteEntry(entry.id); onClose() }}
      />
    </div>
  )
}
