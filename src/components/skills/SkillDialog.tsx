import { useState, useEffect } from 'react'
import { Zap, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { Skill, SkillCategory } from '@/types'
import { SKILL_CATEGORIES, normalizeCategory } from '@/types'

interface SkillDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description: string, prompt: string, tags: string[], category: SkillCategory) => void
  onDelete?: () => void
  initial?: Skill | null
}

export function SkillDialog({ open, onClose, onSubmit, onDelete, initial }: SkillDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [category, setCategory] = useState<SkillCategory>('Productivity')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setPrompt(initial?.prompt ?? '')
      setTagsInput((initial?.tags ?? []).join(', '))
      setCategory(normalizeCategory(initial?.category))
    }
  }, [open, initial])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    onSubmit(name.trim(), description.trim(), prompt.trim(), tags, category)
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-7 rounded-lg bg-accent/15 text-accent shrink-0">
              <Zap size={15} strokeWidth={2.25} />
            </span>
            {isEditing ? 'Editar skill' : 'Nueva skill'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los campos de la skill existente.'
              : 'Define una nueva skill para personalizar el comportamiento del agente.'}
          </DialogDescription>
        </DialogHeader>

        <form id="skill-form" onSubmit={handleSubmit} className="px-6 pb-2 flex flex-col gap-4">
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
              className="resize-y font-mono text-xs leading-relaxed"
            />
          </Field>

          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              className="w-full px-2.5 py-1.5 text-[11.5px] bg-input border border-border-normal rounded-md text-primary font-ui outline-none"
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tags">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="code, review, análisis"
            />
            <span className="block mt-1 text-[11px] text-muted-foreground font-ui">
              Separados por coma
            </span>
          </Field>
        </form>

        <DialogFooter className="flex-row items-center gap-2.5 px-6 py-4 border-t border-border-subtle bg-card">
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(true)}
              className="mr-auto text-destructive gap-1.5"
            >
              <Trash2 size={13} />
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="min-w-[90px]">
            Cancelar
          </Button>
          <Button
            form="skill-form"
            type="submit"
            disabled={!name.trim() || !prompt.trim()}
            className="min-w-[120px]"
          >
            {isEditing ? 'Guardar cambios' : 'Crear skill'}
          </Button>
        </DialogFooter>
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
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wide text-secondary font-ui">
        {label}
      </label>
      {children}
    </div>
  )
}
