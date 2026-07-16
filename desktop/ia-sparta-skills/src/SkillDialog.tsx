import { useState, useEffect } from 'react'
import { Zap, Trash2, X } from 'lucide-react'
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

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxWidth: '92vw',
          maxHeight: '85vh',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-muted)', color: 'var(--accent)', flexShrink: 0,
            }}>
              <Zap size={14} strokeWidth={2.25} />
            </span>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
                {isEditing ? 'Editar skill' : 'Nueva skill'}
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: '2px 0 0' }}>
                {isEditing
                  ? 'Modifica los campos de la skill existente.'
                  : 'Define una nueva skill para personalizar el comportamiento del agente.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form id="skill-form" onSubmit={handleSubmit} style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
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
                minHeight: 80,
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
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

          <Field label="Tags">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="code, review, análisis"
              style={inputStyle}
            />
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 4 }}>
              Separados por coma
            </span>
          </Field>
        </form>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(true)}
              style={{ marginRight: 'auto', color: 'var(--destructive)', gap: 6 }}
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
      </div>

      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="¿Eliminar esta skill?"
          itemLabel={initial?.name ?? 'esta skill'}
          onConfirm={() => { onDelete(); setConfirmDeleteOpen(false) }}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 12,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-normal)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
}
