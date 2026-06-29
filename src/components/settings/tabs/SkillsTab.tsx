import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSkillStore } from '@/stores/skill.store'
import { useLocalSkillsLoader } from '@/hooks/useLocalSkillsLoader'
import { useTranslation } from '@/i18n'
import { SettingGroup } from './primitives'
import { SkillDialog } from '@/components/skills/SkillDialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

interface SkillDisplay {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  source: string
  editable: boolean
}

const ICON_MAP: Record<string, string> = {
  analysis: '\ud83d\udcca', apple: '\ud83c\udf4e', automation: '\u26a1',
  'autonomous-ai-agents': '\ud83e\udd16', coding: '\ud83d\udcbb',
  creative: '\ud83c\udfa8', 'data-science': '\ud83d\udd2c', dogfood: '\ud83d\udc3e',
  email: '\ud83d\udce7', github: '\ud83d\udc19', media: '\ud83c\udfac',
  mlops: '\ud83e\udde0', 'note-taking': '\ud83d\udcdd', productivity: '\ud83d\udcc2',
  research: '\ud83d\udd0d', 'smart-home': '\ud83c\udfe0', 'social-media': '\ud83d\udcf1',
  'software-development': '\ud83d\udee0\ufe0f', writing: '\u270d\ufe0f',
}

function getSkillIcon(skill: SkillDisplay): string {
  if (skill.icon && skill.icon !== '\U0001f4e6' && skill.icon.length <= 5) return skill.icon
  const lower = skill.name.toLowerCase()
  if (lower.includes('github')) return '\ud83d\udc19'
  if (lower.includes('email')) return '\ud83d\udce7'
  if (lower.includes('note')) return '\ud83d\udcdd'
  if (lower.includes('search') || lower.includes('arxiv')) return '\ud83d\udd0d'
  if (lower.includes('design') || lower.includes('sketch') || lower.includes('excalidraw')) return '\ud83c\udfa8'
  if (lower.includes('music') || lower.includes('song')) return '\ud83c\udfb5'
  if (lower.includes('memory')) return '\ud83e\udde0'
  return '\ud83d\udce6'
}

export function SkillsTab() {
  const { skills: userSkills, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const { skills: localSkills } = useLocalSkillsLoader()
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const allSkills: SkillDisplay[] = useMemo(() => {
    const builtins = localSkills.filter((s) => s.source === 'builtin')
    const userIds = new Set(userSkills.map((s) => s.id))
    const mapped: SkillDisplay[] = [
      ...userSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: (s as any).icon || '',
        tags: s.tags ?? [],
        source: 'user',
        editable: true,
      })),
      ...builtins
        .filter((s) => !userIds.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          icon: s.icon,
          tags: s.tags,
          source: 'builtin',
          editable: false,
        })),
    ]
    return mapped.sort((a, b) => {
      if (a.editable !== b.editable) return a.editable ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [userSkills, localSkills])

  const filtered = useMemo(() => {
    if (!search.trim()) return allSkills
    const q = search.toLowerCase()
    return allSkills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    )
  }, [allSkills, search])

  const skillToDeleteName = allSkills.find((s) => s.id === skillToDelete)?.name ?? ''

  function handleSubmit(name: string, description: string, prompt: string, tags: string[], category: string) {
    if (editId) {
      updateSkill(editId, { name, description, prompt, tags, category: category as any })
    } else {
      addSkill(name, description, prompt, tags, category)
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
        <div style={{ position: 'relative', marginBottom: 8, marginTop: 4 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              fontSize: 12,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((skill) => (
            <div
              key={skill.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                opacity: skill.editable || search.trim() ? 1 : 0.7,
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>
                {getSkillIcon(skill)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    {skill.name}
                  </span>
                  {!skill.editable && (
                    <span style={{
                      fontSize: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-active)',
                      padding: '1px 4px',
                      borderRadius: 2,
                      fontFamily: 'var(--font-mono)',
                      lineHeight: '12px',
                    }}>
                      Sistema
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 10.5,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                  marginTop: 1,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {skill.description}
                </div>
              </div>
              {skill.editable && (
                <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditId(skill.id); setDialogOpen(true) }}
                    title={t('skills.edit')}
                    style={{
                      width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Pencil size={10} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setSkillToDelete(skill.id)}
                    title={t('skills.delete')}
                    style={{
                      width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--destructive)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {search ? 'No se encontraron skills con ese filtro.' : 'No hay skills disponibles.'}
            </div>
          )}
        </div>

        <button
          onClick={() => { setEditId(null); setDialogOpen(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', marginTop: 6,
            background: 'none', border: '1px dashed var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
            fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer',
            transition: 'all 0.12s', width: '100%',
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
        initial={editId ? userSkills.find((s) => s.id === editId) ?? null : null}
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
