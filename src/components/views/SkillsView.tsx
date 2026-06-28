import { useState, useEffect } from 'react'
import { Layers, Compass, Plus, Zap, Search, X } from 'lucide-react'
import { useSkillStore } from '@/stores/skill.store'
import { SkillCard } from '@/components/skills/SkillCard'
import { SkillExplorer } from '@/components/skills/SkillExplorer'
import { SkillCreator } from '@/components/skills/SkillCreator'
import { SkillDialog } from '@/components/skills/SkillDialog'
import type { Skill, SkillCategory } from '@/types'

type DisplaySkill = Skill & { _source?: string; version?: string; author?: string; source?: string; featured?: boolean }

type Tab = 'mine' | 'explore' | 'create'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'mine', label: 'Mis Skills', icon: <Layers size={12} strokeWidth={1.5} /> },
  { key: 'explore', label: 'Explorar', icon: <Compass size={12} strokeWidth={1.5} /> },
  { key: 'create', label: 'Crear', icon: <Plus size={12} strokeWidth={1.5} /> },
]

export function SkillsView() {
  const { skills, addSkill, updateSkill, deleteSkill, installedSkills, loadInstalledSkills } = useSkillStore()
  const [tab, setTab] = useState<Tab>('mine')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  useEffect(() => {
    loadInstalledSkills()
  }, [loadInstalledSkills])

  const allLocal: DisplaySkill[] = [
    ...skills.map((s) => ({ ...s, _source: 'user' as const })),
    ...installedSkills
      .filter((is) => !skills.some((s) => s.id === is.id))
      .map((is) => ({
        id: is.id,
        name: is.name,
        description: is.description,
        prompt: is.description,
        icon: is.icon,
        tags: is.tags as string[],
        category: is.category as SkillCategory | undefined,
        version: is.version,
        author: is.author,
        source: is.source as DisplaySkill['source'],
        featured: is.featured,
        createdAt: is.installedAt || Date.now(),
        _source: is.source,
      })),
  ]

  const filtered = allLocal.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false
    }
    if (activeFilter && !(s.tags ?? []).includes(activeFilter)) return false
    return true
  })

  const allTags = [...new Set(allLocal.flatMap((s) => s.tags ?? []))]

  function handleEdit(skill: DisplaySkill) {
    setEditId(skill.id)
    setDialogOpen(true)
  }

  function handleDelete(id: string) {
    deleteSkill(id)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>
            Skills
          </h2>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-active)', padding: '1px 6px', borderRadius: 3 }}>
            {allLocal.length}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', padding: '0 16px', flexShrink: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16 }}>
        {tab === 'mine' && (
          <div>
            {allLocal.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar en mis skills..."
                    style={{
                      width: '100%', padding: '6px 10px 6px 28px', fontSize: 11.5,
                      background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)', outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {allTags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                    style={{
                      padding: '3px 10px', fontSize: 10, fontFamily: 'var(--font-ui)',
                      background: activeFilter === tag ? 'var(--accent)' : 'var(--bg-active)',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      color: activeFilter === tag ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {tag}
                    {activeFilter === tag && <X size={8} strokeWidth={2} />}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 60, gap: 12,
              }}>
                <Zap size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} strokeWidth={1} />
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
                  {allLocal.length === 0
                    ? 'No tienes skills todavía. Crea una o explora las disponibles.'
                    : 'No se encontraron skills con ese filtro.'}
                </div>
                {allLocal.length === 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => setTab('create')}
                      style={{
                        padding: '6px 16px', background: 'var(--accent)', border: 'none',
                        borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      }}
                    >
                      Crear skill
                    </button>
                    <button
                      onClick={() => setTab('explore')}
                      style={{
                        padding: '6px 16px', background: 'none', border: '1px solid var(--border-normal)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 11,
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      }}
                    >
                      Explorar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {filtered.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onActivate={() => {}}
                    onEdit={() => handleEdit(skill)}
                    onDelete={() => handleDelete(skill.id)}
                    onExport={() => {
                      const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `${skill.id}.skill.json`; a.click()
                      URL.revokeObjectURL(url)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'explore' && <SkillExplorer />}

        {tab === 'create' && <SkillCreator />}
      </div>

      <SkillDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditId(null) }}
        onSubmit={(n, d, p, t) => {
          if (editId) {
            updateSkill(editId, { name: n, description: d, prompt: p, tags: t })
          } else {
            addSkill(n, d, p, t)
          }
          setDialogOpen(false)
          setEditId(null)
        }}
        onDelete={editId ? () => { deleteSkill(editId); setDialogOpen(false); setEditId(null) } : undefined}
        initial={editId ? skills.find(s => s.id === editId) ?? null : null}
      />
    </div>
  )
}
