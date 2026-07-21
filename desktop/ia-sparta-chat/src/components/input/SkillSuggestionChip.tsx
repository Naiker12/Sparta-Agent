import { useSkillStore } from 'ia-sparta-core'
import { Sparkles, X, Check } from 'lucide-react'

export function SkillSuggestionChip() {
  const suggestedIds = useSkillStore((s) => s.suggestedSkillIds)
  const skills = useSkillStore((s) => s.skills)
  const installedSkills = useSkillStore((s) => s.installedSkills)
  const confirmSuggestion = useSkillStore((s) => s.confirmSuggestion)
  const dismissSuggestion = useSkillStore((s) => s.dismissSuggestion)

  if (suggestedIds.length === 0) return null

  const getSkillName = (id: string) => {
    const userSkill = skills.find((s) => s.id === id)
    if (userSkill) return userSkill.name
    const installed = installedSkills.find((s) => s.id === id)
    if (installed) return installed.name
    return id
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    }}>
      <Sparkles size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      {suggestedIds.map((id) => (
        <div
          key={id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            color: 'var(--accent)',
            cursor: 'default',
            lineHeight: '16px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
            {getSkillName(id)}
          </span>
          <button
            onClick={() => confirmSuggestion(id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: 'var(--radius-xs)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', padding: 0, flexShrink: 0,
            }}
            title="Activar esta skill"
          >
            <Check size={9} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => dismissSuggestion(id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: 'var(--radius-xs)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 0, flexShrink: 0,
            }}
            title="Descartar"
          >
            <X size={8} />
          </button>
        </div>
      ))}
    </div>
  )
}
