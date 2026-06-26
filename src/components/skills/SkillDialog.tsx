import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Zap, Trash2 } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { Skill } from '@/types'

interface SkillDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description: string, prompt: string, tags: string[]) => void
  onDelete?: () => void
  initial?: Skill | null
}

export function SkillDialog({ open, onClose, onSubmit, onDelete, initial }: SkillDialogProps) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt]           = useState('')
  const [tagsInput, setTagsInput]     = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setPrompt(initial?.prompt ?? '')
      setTagsInput((initial?.tags ?? []).join(', '))
    }
  }, [open, initial])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    onSubmit(name.trim(), description.trim(), prompt.trim(), tags)
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{
        width: '560px',
        maxWidth: '92vw',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        gap: 0,
        overflow: 'hidden',
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 20px', flexShrink: 0 }}>
          <DialogHeader>
            <DialogTitle style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-display)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
            }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-muted)',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                <Zap size={15} strokeWidth={2.25} />
              </span>
              {isEditing ? 'Editar skill' : 'Nueva skill'}
            </DialogTitle>
            <DialogDescription style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              marginLeft: 40,
            }}>
              Una skill es un prompt reutilizable que un agente puede invocar.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Scrollable Body ── */}
        <form
          id="skill-form"
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 28px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <Field label="Nombre">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Code Review"
            />
          </Field>

          <Field label="Descripción">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Revisa código y sugiere mejoras"
            />
          </Field>

          <Field label="Prompt">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Revisa el siguiente código y sugiere..."
              rows={6}
              style={{
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.7,
              }}
            />
          </Field>

          <Field label="Tags">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="code, review, análisis"
            />
            <span style={{
              display: 'block',
              marginTop: 5,
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
            }}>
              Separados por coma
            </span>
          </Field>
        </form>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '16px 28px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(true)}
              style={{
                marginRight: 'auto',
                color: 'var(--status-err)',
                gap: 6,
              }}
            >
              <Trash2 size={13} />
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} style={{ minWidth: 90 }}>
            Cancelar
          </Button>
          <Button
            form="skill-form"
            type="submit"
            disabled={!name.trim() || !prompt.trim()}
            style={{ minWidth: 120 }}
          >
            {isEditing ? 'Guardar cambios' : 'Crear skill'}
          </Button>
        </div>

      </DialogContent>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="¿Eliminar esta skill?"
          itemLabel={initial?.name ?? 'esta skill'}
          onConfirm={() => { onDelete(); setConfirmDeleteOpen(false) }}
        />
      )}
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}