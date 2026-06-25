import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useSkillStore } from '@/stores/skill.store'
import { SkillDialog } from '@/components/skills/SkillDialog'

export function SkillsView() {
  const { skills, addSkill, deleteSkill } = useSkillStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
          Skills
        </h2>
        <button onClick={() => { setEditId(null); setDialogOpen(true) }} style={{
          padding: '5px 12px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}>
          + Nueva skill
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start' }}>
        {skills.map((skill) => (
          <div
            key={skill.id}
            onClick={() => { setEditId(skill.id); setDialogOpen(true) }}
            style={{
              width: 240, padding: 14, cursor: 'pointer',
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-muted)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-input)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Zap size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                {skill.name}
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: 0, lineHeight: 1.5 }}>
              {skill.description}
            </p>
            {skill.tags && skill.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {skill.tags.map(t => (
                  <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-active)', color: 'var(--text-muted)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <SkillDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditId(null) }}
        onSubmit={(n, d, p, t) => { addSkill(n, d, p, t); setDialogOpen(false) }}
        onDelete={editId ? () => { deleteSkill(editId); setDialogOpen(false); setEditId(null) } : undefined}
        initial={editId ? skills.find(s => s.id === editId) ?? null : null}
      />
    </div>
  )
}
