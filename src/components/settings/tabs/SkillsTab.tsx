import { useState } from 'react'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'
import { useSkillStore } from '@/stores/skill.store'
import { useTranslation } from '@/i18n'
import { SettingGroup } from './primitives'
import { SkillDialog } from '@/components/skills/SkillDialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export function SkillsTab() {
  const { skills, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null)

  const skillToDeleteName = skills.find((s) => s.id === skillToDelete)?.name ?? ''

  function handleSubmit(name: string, description: string, prompt: string, tags: string[]) {
    if (editId) {
      updateSkill(editId, { name, description, prompt, tags })
    } else {
      addSkill(name, description, prompt, tags)
    }
    setDialogOpen(false)
    setEditId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('skills.title')}
        description={t('skills.desc')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {skills.map((skill) => (
            <div
              key={skill.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 6,
              }}
            >
              <Zap size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                  {skill.name}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
                  {skill.description}
                </div>
                {skill.tags && skill.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 9,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--bg-active)',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setEditId(skill.id)
                  setDialogOpen(true)
                }}
                title={t('skills.edit')}
                style={iconBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
              >
                <Pencil size={11} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setSkillToDelete(skill.id)}
                title={t('skills.delete')}
                style={iconBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
              >
                <Trash2 size={11} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setEditId(null)
            setDialogOpen(true)
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', marginTop: 4,
            background: 'none', border: '1px dashed var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
            fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Plus size={13} strokeWidth={1.5} />
          {t('skills.create')}
        </button>
      </SettingGroup>

      <SkillDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditId(null) }}
        onSubmit={handleSubmit}
        onDelete={editId ? () => { deleteSkill(editId); setDialogOpen(false); setEditId(null) } : undefined}
        initial={editId ? skills.find((s) => s.id === editId) ?? null : null}
      />

      <ConfirmDeleteDialog
        open={skillToDelete !== null}
        onOpenChange={(open) => !open && setSkillToDelete(null)}
        title={t('skills.delete')}
        itemLabel={skillToDeleteName}
        onConfirm={() => {
          if (skillToDelete) deleteSkill(skillToDelete)
          setSkillToDelete(null)
        }}
      />
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 26, height: 26,
  background: 'none', border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.12s',
}
