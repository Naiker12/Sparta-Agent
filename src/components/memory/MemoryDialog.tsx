import { useState, useEffect } from 'react'
import { Brain, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemoryStore } from '@/stores/memory.store'
import type { MemoryEntry } from '@/types'
import { MemoryEntryItem } from './MemoryEntryItem'

interface MemoryDialogProps {
  open: boolean
  onClose: () => void
}

export function MemoryDialog({ open, onClose }: MemoryDialogProps) {
  const { entries, addEntry, deleteEntry } = useMemoryStore()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft('')
      setEditingId(null)
    }
  }, [open])

  function handleSave() {
    if (!draft.trim()) return
    if (editingId) {
      const target = entries.find((e) => e.id === editingId)
      if (target) {
        useMemoryStore.getState().updateEntry(editingId, { content: draft.trim() })
      }
      setEditingId(null)
    } else {
      addEntry(draft.trim(), 'manual')
    }
    setDraft('')
  }

  function handleEdit(entry: MemoryEntry) {
    setEditingId(entry.id)
    setDraft(entry.content)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Brain size={14} style={{ color: 'var(--accent)' }} />
              Memoria
            </span>
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 10,
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Añade un recuerdo persistente…"
              rows={2}
              style={{ border: 'none', background: 'transparent', padding: 0 }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
                marginTop: 6,
              }}
            >
              {editingId && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null)
                    setDraft('')
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button size="xs" onClick={handleSave} disabled={!draft.trim()}>
                <Plus size={11} />
                {editingId ? 'Guardar' : 'Añadir'}
              </Button>
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Recuerdos ({entries.length})
              </span>
            </div>
            <ScrollArea style={{ maxHeight: 260 }}>
              {entries.length === 0 ? (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    padding: '12px 0',
                  }}
                >
                  Aún no hay recuerdos.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {entries.map((entry) => (
                    <MemoryEntryItem
                      key={entry.id}
                      entry={entry}
                      onEdit={() => handleEdit(entry)}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
