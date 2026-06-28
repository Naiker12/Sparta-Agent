import { useState, useEffect } from 'react'
import { Search, Grid3X3, AlertCircle } from 'lucide-react'
import type { DownloadableSkill, SkillCategory } from '@/types'
import { fetchAvailableSkills, isSkillInstalled, installSkill } from './SkillInstaller'
import { useSkillStore } from '@/stores/skill.store'
import { SkillCard } from './SkillCard'

const DEFAULT_CATEGORIES: { label: string; value: SkillCategory | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Coding', value: 'Coding' },
  { label: 'Research', value: 'Research' },
  { label: 'Writing', value: 'Writing' },
  { label: 'Analysis', value: 'Analysis' },
  { label: 'Automation', value: 'Automation' },
]

export function SkillExplorer() {
  const [skills, setSkills] = useState<DownloadableSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<SkillCategory | 'all'>('all')
  const [, setRefresh] = useState(0)
  const installedSkills = useSkillStore((s) => s.installedSkills)
  const loadInstalledSkills = useSkillStore((s) => s.loadInstalledSkills)

  useEffect(() => {
    loadInstalledSkills()
    fetchAvailableSkills().then((loaded) => {
      setSkills(loaded.map((s) => ({ ...s, installed: isSkillInstalled(s.id) })))
      setLoading(false)
    })
  }, [loadInstalledSkills])

  useEffect(() => {
    setSkills((prev) => prev.map((s) => ({ ...s, installed: isSkillInstalled(s.id) })))
  }, [installedSkills])

  function handleInstall(skill: DownloadableSkill) {
    const id = installSkill(skill)
    if (id) {
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, installed: true } : s)))
      setRefresh((r) => r + 1)
    }
  }

  const categories = DEFAULT_CATEGORIES

  const filtered = skills.filter((s) => {
    if (category !== 'all' && s.category !== category) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', gap: 8, fontSize: 12 }}>
        <div style={{ width: 14, height: 14, border: '2px solid var(--border-normal)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        Cargando skills...
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            style={{
              width: '100%', padding: '6px 10px 6px 28px', fontSize: 11.5,
              background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            style={{
              padding: '4px 12px', fontSize: 10.5, fontFamily: 'var(--font-ui)',
              background: category === cat.value ? 'var(--accent)' : 'var(--bg-active)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: category === cat.value ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', gap: 8 }}>
          <AlertCircle size={20} strokeWidth={1.5} />
          <div style={{ fontSize: 12, fontFamily: 'var(--font-ui)' }}>
            No se encontraron skills con esos filtros.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={skill.installed}
              onInstall={() => handleInstall(skill)}
              isDownloadable
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <Grid3X3 size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {skills.length} skills disponibles · {skills.filter((s) => s.installed).length} instaladas
        </span>
      </div>
    </div>
  )
}
