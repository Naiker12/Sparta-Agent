import { useState, useEffect } from 'react'
import { Zap, Trash2 } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tagsInput, setTagsInput] = useState('')
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
    <Modal open={open} onClose={onClose} width={560} maxHeight={560}>
      <ModalHeader title={(
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        </span>
      )} onClose={onClose} />

      <form id="skill-form" onSubmit={handleSubmit}>
        <ModalBody style={{ padding: '0 28px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        </ModalBody>
      </form>

      <ModalFooter>
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
      </ModalFooter>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="¿Eliminar esta skill?"
          itemLabel={initial?.name ?? 'esta skill'}
          onConfirm={() => { onDelete(); setConfirmDeleteOpen(false) }}
        />
      )}
    </Modal>
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
