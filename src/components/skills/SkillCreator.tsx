import { useState } from 'react'
import { Zap, Eye, Sparkles } from 'lucide-react'
import { useSkillStore } from '@/stores/skill.store'
import type { SkillCategory } from '@/types'

const EMOJIS = ['\u26A1', '\uD83D\uDD0D', '\uD83D\uDCD6', '\uD83D\uDC1E', '\uD83D\uDD28', '\uD83E\uDDEA', '\uD83D\uDCDD', '\uD83D\uDCD1', '\uD83C\uDF10', '\uD83D\uDD0D', '\uD83D\uDCCA', '\uD83D\uDEE0\uFE0F', '\uD83C\uDFA8', '\uD83D\uDCE6', '\uD83D\uDD2C', '\uD83D\uDCD8']

const CATEGORIES: { label: string; value: SkillCategory }[] = [
  { label: 'Coding', value: 'Coding' },
  { label: 'Research', value: 'Research' },
  { label: 'Writing', value: 'Writing' },
  { label: 'Analysis', value: 'Analysis' },
  { label: 'Automation', value: 'Automation' },
]

export function SkillCreator() {
  const { addSkill } = useSkillStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [icon, setIcon] = useState('\u26A1')
  const [category, setCategory] = useState<SkillCategory>('Coding')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    addSkill(name.trim(), description.trim(), prompt.trim(), tags, category)
    setName('')
    setDescription('')
    setPrompt('')
    setTagsInput('')
    setIcon('\u26A1')
    setCategory('Coding')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const previewTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', marginBottom: 4, fontWeight: 500 }}>
            Ícono
          </label>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                width: 40, height: 40, fontSize: 20, background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {icon}
            </button>
            {showEmojiPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowEmojiPicker(false)} />
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: 4,
                  background: 'var(--bg-modal)', border: '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md)', padding: 8,
                  display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}>
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { setIcon(e); setShowEmojiPicker(false) }}
                      style={{
                        width: 32, height: 32, fontSize: 16, background: icon === e ? 'var(--bg-active)' : 'none',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Field label="Nombre">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Code Review"
            style={inputStyle}
            autoFocus
          />
        </Field>

        <Field label="Descripción">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe brevemente qué hace esta skill"
            style={inputStyle}
          />
        </Field>

        <Field label="Categoría">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SkillCategory)}
            style={{ ...inputStyle, fontFamily: 'var(--font-ui)' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Tags (separados por coma)">
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="coding, review, quality"
            style={inputStyle}
          />
        </Field>

        <Field label="Prompt">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe el prompt que definirá el comportamiento de esta skill..."
            style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}
            rows={6}
          />
        </Field>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <button
            type="submit"
            disabled={!name.trim() || !prompt.trim()}
            style={{
              padding: '7px 18px', background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11.5,
              fontFamily: 'var(--font-ui)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              opacity: name.trim() && prompt.trim() ? 1 : 0.5,
            }}
          >
            <Sparkles size={12} strokeWidth={1.5} />
            Guardar skill
          </button>
          {saved && (
            <span style={{ fontSize: 11, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)', animation: 'fadeIn 0.2s' }}>
              Skill creada correctamente
            </span>
          )}
        </div>
      </form>

      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <Eye size={12} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Vista previa
          </span>
        </div>
        <div style={{
          background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: 14,
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                {name || 'Nombre de skill'}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 1 }}>
                {category}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: 0, lineHeight: 1.5 }}>
            {description || 'La descripción de la skill aparecerá aquí.'}
          </p>
          {previewTags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {previewTags.map((t) => (
                <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--bg-active)', color: 'var(--text-muted)' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {prompt && (
            <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
              <Zap size={10} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--accent)' }} />
              {prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 11.5,
  background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', outline: 'none',
}
