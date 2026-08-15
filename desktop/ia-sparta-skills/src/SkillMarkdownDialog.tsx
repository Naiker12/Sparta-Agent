import { useEffect, useState, useMemo } from 'react'
import { FileText, Code, Copy, Check, Loader2, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from 'ia-sparta-design-system'
import { MarkdownText } from 'ia-sparta-chat'
import type { InstalledSkill, Skill } from 'ia-sparta-core'

interface SkillMarkdownDialogProps {
  open: boolean
  onClose: () => void
  skill: (Skill | InstalledSkill) | null
  trustLevel?: string
}

const SOURCE_LABEL: Record<string, string> = {
  builtin: 'Sparta Team',
  legacy: 'Legado',
  user: 'Usuario',
  system: 'Sistema',
}

const skillBodyCache = new Map<string, string>()

export function SkillMarkdownDialog({ open, onClose, skill, trustLevel }: SkillMarkdownDialogProps) {
  const [raw, setRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !skill) return
    let cancelled = false
    const fallback = 'prompt' in skill ? skill.prompt || '' : ''

    if (skillBodyCache.has(skill.id)) {
      setBody(skillBodyCache.get(skill.id) || fallback)
      setLoading(false)
      return
    }

    setBody(fallback)
    setLoading(!fallback)

    void window.skills?.view(skill.id)
      .then((result) => {
        if (!cancelled && result.body) {
          skillBodyCache.set(skill.id, result.body)
          setBody(result.body)
        }
      })
      .catch(() => { if (!cancelled) setBody(fallback) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, skill?.id])

  const content = body || '_Esta skill no tiene contenido._'
  const sourceLabel = SOURCE_LABEL[skill?.source ?? ''] ?? 'Desconocido'
  const subtitle = [skill?.category ?? 'general', sourceLabel, 'SKILL.md'].filter(Boolean).join(' · ')
  const isQuarantined = trustLevel === 'quarantined'

  const renderedMarkdown = useMemo(() => {
    return <MarkdownText content={content} isStreaming={false} />
  }, [content])

  if (!skill) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      console.warn('No se pudo copiar al portapapeles')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-modal)] shadow-2xl">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-normal)', background: 'var(--bg-surface)' }}>
          <div style={{
            height: 32, width: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)', flexShrink: 0,
          }}>
            <FileText size={16} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-ui)' }}>
              {skill.name}
            </h3>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {isQuarantined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, margin: '12px 20px 0', padding: '8px 12px', borderRadius: 6,
            background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b', fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
          }}>
            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
            <span>Esta skill está en cuarentena — el análisis de seguridad detectó patrones de riesgo. Revisa el contenido antes de activarla.</span>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <button
            type="button"
            onClick={() => setRaw(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11,
              fontFamily: 'var(--font-ui)', fontWeight: !raw ? 600 : 400, borderRadius: 6,
              border: '1px solid ' + (!raw ? 'var(--accent)' : 'var(--border-subtle)'),
              background: !raw ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              color: !raw ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
            }}
          >
            <FileText size={12} strokeWidth={1.8} />
            Renderizado
          </button>
          <button
            type="button"
            onClick={() => setRaw(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11,
              fontFamily: 'var(--font-ui)', fontWeight: raw ? 600 : 400, borderRadius: 6,
              border: '1px solid ' + (raw ? 'var(--accent)' : 'var(--border-subtle)'),
              background: raw ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              color: raw ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
            }}
          >
            <Code size={12} strokeWidth={1.8} />
            Markdown crudo
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11,
              fontFamily: 'var(--font-ui)', fontWeight: 500, borderRadius: 6,
              border: '1px solid var(--border-normal)', background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
            }}
          >
            {copied ? <Check size={12} strokeWidth={2} style={{ color: 'var(--status-ok)' }} /> : <Copy size={12} strokeWidth={1.8} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={15} className="animate-spin" />
              Cargando SKILL.md...
            </div>
          ) : raw ? (
            <pre style={{
              margin: 0, padding: 16, fontSize: 11.5, lineHeight: 1.6,
              fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {content}
            </pre>
          ) : (
            <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.6 }}>
              {renderedMarkdown}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
