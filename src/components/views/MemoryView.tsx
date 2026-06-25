import { useState } from 'react'
import { Brain, Plus } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory.store'
import { MemoryEntryItem } from '@/components/memory/MemoryEntryItem'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function MemoryView() {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} style={{ color: 'var(--accent)' }} />
            Memoria
          </span>
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {entries.length} recuerdos
        </span>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Añade un recuerdo persistente…"
            rows={2}
            style={{ flex: 1 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Button size="sm" onClick={handleSave} disabled={!draft.trim()}>
              <Plus size={12} />
              {editingId ? 'Guardar' : 'Añadir'}
            </Button>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDraft('') }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto', padding: 16 }}>
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
