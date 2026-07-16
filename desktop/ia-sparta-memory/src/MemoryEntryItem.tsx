import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { MemoryEntry } from 'ia-sparta-core'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'

interface MemoryEntryItemProps {
  entry: MemoryEntry
  onEdit: () => void
  onDelete: () => void
}

export function MemoryEntryItem({ entry, onEdit, onDelete }: MemoryEntryItemProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: entry.source === 'auto' ? 'var(--accent)' : 'var(--text-muted)',
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            lineHeight: 1.5,
            margin: 0,
            wordBreak: 'break-word',
          }}
        >
          {entry.content}
        </p>
        {entry.category && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              marginTop: 4,
              display: 'inline-block',
            }}
          >
            #{entry.category}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          title="Editar"
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Pencil size={11} strokeWidth={1.5} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true) }}
          title="Eliminar"
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--destructive)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Trash2 size={11} strokeWidth={1.5} />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={entry.content.slice(0, 60) + (entry.content.length > 60 ? '…' : '')}
        onConfirm={onDelete}
      />
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'color 0.15s',
}
