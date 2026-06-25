import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
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
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSubmit(name.trim(), description.trim(), prompt.trim(), tags)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initial ? 'Editar skill' : 'Nueva skill'}</DialogTitle>
            <DialogDescription>
              Una skill es un prompt reutilizable que un agente puede invocar.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
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
                rows={5}
              />
            </Field>
            <Field label="Tags (separados por coma)">
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="code, review"
              />
            </Field>
          </div>

          <DialogFooter style={{ marginTop: 16 }}>
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                style={{ marginRight: 'auto' }}
              >
                Eliminar
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !prompt.trim()}>
              {initial ? 'Guardar' : 'Crear skill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
