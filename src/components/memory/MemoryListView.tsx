import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory.store'
import { MemoryEntryItem } from '@/components/memory/MemoryEntryItem'

export function MemoryListView() {
  const { entries, addEntry, deleteEntry, updateEntry } = useMemoryStore()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleSave() {
    if (!draft.trim()) return
    if (editingId) {
      updateEntry(editingId, { content: draft.trim() })
      setEditingId(null)
    } else {
      addEntry(draft.trim(), 'manual')
    }
    setDraft('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Añade un recuerdo persistente…"
            rows={2}
            style={{
              flex: 1, padding: '7px 10px', fontSize: 12,
              background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)', outline: 'none', resize: 'none',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={handleSave}
              disabled={!draft.trim()}
              style={{
                padding: '5px 12px', background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
                fontFamily: 'var(--font-ui)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: draft.trim() ? 1 : 0.5,
              }}
            >
              <Plus size={12} />
              {editingId ? 'Guardar' : 'Añadir'}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setDraft('') }}
                style={{
                  padding: '5px 12px', background: 'none', border: '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 11,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry) => (
            <MemoryEntryItem
              key={entry.id}
              entry={entry}
              onEdit={() => { setEditingId(entry.id); setDraft(entry.content) }}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
          {entries.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 24, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>
              Aún no hay recuerdos. Añade uno arriba.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
