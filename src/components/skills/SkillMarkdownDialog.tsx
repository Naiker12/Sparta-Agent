import { useState } from 'react'
import { FileText, Code2, Copy, Check } from 'lucide-react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/modal'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { Skill } from '@/types'

interface SkillMarkdownDialogProps {
  open: boolean
  onClose: () => void
  skill: Skill | null
}

const SOURCE_LABEL: Record<string, string> = {
  builtin: 'Sparta Team',
  legacy: 'Legado',
  user: 'Usuario',
}

export function SkillMarkdownDialog({ open, onClose, skill }: SkillMarkdownDialogProps) {
  const [raw, setRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!skill) return null

  const body = skill.prompt || '_Esta skill no tiene contenido._'
  const sourceLabel = SOURCE_LABEL[skill.source ?? ''] ?? 'Desconocido'
  const subtitle = [skill.category ?? 'general', sourceLabel, 'SKILL.md'].filter(Boolean).join(' · ')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      console.warn('No se pudo copiar al portapapeles')
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={680} maxHeight={620}>
      <ModalHeader
        onClose={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} strokeWidth={1.5} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {skill.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {subtitle}
              </div>
            </div>
          </div>
        }
      />

      <div style={{
        display: 'flex', gap: 6, padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <ViewToggleButton active={!raw} onClick={() => setRaw(false)} icon={<FileText size={11} strokeWidth={1.5} />} label="Renderizado" />
        <ViewToggleButton active={raw} onClick={() => setRaw(true)} icon={<Code2 size={11} strokeWidth={1.5} />} label="Markdown crudo" />

        <div style={{ flex: 1 }} />

        <ToolbarButton onClick={handleCopy} icon={copied ? <Check size={11} strokeWidth={1.5} /> : <Copy size={11} strokeWidth={1.5} />} label={copied ? 'Copiado' : 'Copiar'} />
      </div>

      <ModalBody style={{ padding: raw ? 0 : '16px 20px' }}>
        {raw ? (
          <pre style={{
            margin: 0, padding: 16, fontSize: 11.5, lineHeight: 1.6,
            fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {body}
          </pre>
        ) : (
          <MarkdownRenderer content={body} />
        )}
      </ModalBody>
    </Modal>
  )
}

function ViewToggleButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        fontSize: 10.5, fontFamily: 'var(--font-ui)', borderRadius: 'var(--radius-sm)',
        border: 'none', cursor: 'pointer',
        background: active ? 'var(--bg-active)' : hover ? 'var(--bg-hover)' : 'transparent',
        color: active || hover ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 0.1s ease',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function ToolbarButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        fontSize: 10.5, fontFamily: 'var(--font-ui)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-normal)', cursor: 'pointer',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        color: 'var(--text-secondary)',
        transition: 'background 0.1s ease',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
