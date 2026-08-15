import { useState, useEffect } from 'react'
import { Zap, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  Button,
  ConfirmDeleteDialog,
} from 'ia-sparta-design-system'
import type { Skill, SkillCategory } from 'ia-sparta-core'
import { SKILL_CATEGORIES, normalizeCategory } from 'ia-sparta-core'

interface SkillDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description: string, prompt: string, tags: string[], category: SkillCategory) => void
  onDelete?: () => void
  initial?: Skill | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  borderRadius: 7,
  border: '1px solid var(--border-normal)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 11,
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.12s',
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
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    onSubmit(name.trim(), description.trim(), prompt.trim(), tags, category)
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-modal)] shadow-2xl">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-normal)', background: 'var(--bg-surface)' }}>
          <div style={{
            height: 32, width: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)', flexShrink: 0,
          }}>
            <Zap size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-ui)' }}>
              {isEditing ? 'Editar skill' : 'Nueva skill'}
            </h3>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              {isEditing
                ? 'Modifica los campos de la skill existente.'
                : 'Define una nueva skill para personalizar el comportamiento del agente.'}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form id="skill-form" onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nombre">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Code Review"
              style={inputStyle}
            />
          </Field>

          <Field label="Descripción">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Revisa código y sugiere mejoras"
              style={inputStyle}
            />
          </Field>

          <Field label="Prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Revisa el siguiente código y sugiere..."
              rows={5}
              style={{
                ...inputStyle,
                height: 'auto',
                minHeight: 90,
                padding: '8px 10px',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              style={inputStyle}
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tags" hint="Separados por coma">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="code, review, análisis"
              style={inputStyle}
            />
          </Field>
        </form>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          {onDelete && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              style={{
                marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--destructive)',
                fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-ui)', cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} className="px-4 py-1.5 shrink-0" style={{ fontSize: 11, height: 30 }}>
            Cancelar
          </Button>
          <Button form="skill-form" type="submit" disabled={!name.trim() || !prompt.trim()} className="px-4 py-1.5 shrink-0 min-w-[90px]" style={{ fontSize: 11, height: 30, fontWeight: 600 }}>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{hint}</span>}
    </div>
  )
}