import { useState, useEffect } from 'react'
import { Search, AlertCircle, ExternalLink } from 'lucide-react'
import type { DownloadableSkill, SkillCategory } from 'ia-sparta-core'
import { SKILL_CATEGORIES } from 'ia-sparta-core'
import { useSkillStore } from 'ia-sparta-core'
import { SkillCard } from './SkillCard'

const SKILLS_API = typeof window !== 'undefined' && (window as any).skills

const REPOS: { label: string; repo: string; skills: { id: string; name: string; description: string; category: SkillCategory; tags: string[]; icon: string; featured: boolean }[] }[] = [
  {
    label: 'Hermes (NousResearch)',
    repo: 'NousResearch/hermes-agent',
    skills: [
      { id: 'github', name: 'GitHub PR Workflow', description: 'Automatiza flujos de PR en GitHub.', category: 'Automation', tags: ['github', 'pr', 'workflow'], icon: '\uD83D\uDCCB', featured: true },
      { id: 'computer-use', name: 'Computer Use', description: 'Controla el navegador y automatiza tareas.', category: 'Automation', tags: ['browser', 'automation'], icon: '\uD83D\uDDA5\uFE0F', featured: true },
      { id: 'research', name: 'Deep Research', description: 'Investigación profunda con búsqueda y análisis.', category: 'Research', tags: ['research', 'analysis'], icon: '\uD83D\uDD0D', featured: true },
      { id: 'creative', name: 'Creative Writing', description: 'Asistente para escritura creativa.', category: 'Writing', tags: ['writing', 'creative'], icon: '\u270F\uFE0F', featured: false },
    ],
  },
  {
    label: 'Vercel Agent Skills',
    repo: 'vercel-labs/agent-skills',
    skills: [
      { id: 'frontend-design', name: 'Frontend Design', description: 'Genera componentes y diseños UI.', category: 'Coding', tags: ['frontend', 'design', 'ui'], icon: '\uD83C\uDFA8', featured: true },
      { id: 'data-science', name: 'Data Science', description: 'Análisis de datos y visualización.', category: 'Analysis', tags: ['data', 'science', 'analysis'], icon: '\uD83D\uDCCA', featured: true },
    ],
  },
]

const CATEGORIES: { label: string; value: SkillCategory | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  ...SKILL_CATEGORIES,
]

export function SkillExplorer() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<SkillCategory | 'all'>('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const installedSkills = useSkillStore((s) => s.installedSkills)
  const loadInstalledSkills = useSkillStore((s) => s.loadInstalledSkills)

  useEffect(() => {
    loadInstalledSkills()
  }, [loadInstalledSkills])

  // Flatten all repo skills into a single list for filtering
  const allSkills: (DownloadableSkill & { repo: string })[] = REPOS.flatMap((r) =>
    r.skills.map((s) => ({
      ...s,
      repo: r.repo,
      version: '1.0.0',
      author: r.label,
      prompt: s.description,
      installed: installedSkills.some((is) => is.id === `${r.repo.split('/')[1]}-${s.id}`)
        || useSkillStore.getState().skills.some((sk) => sk.id === s.id),
    }))
  )

  const filtered = allSkills.filter((s) => {
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

  async function handleInstall(skill: DownloadableSkill & { repo: string }) {
    setInstalling(skill.id)
    setInstallError(null)

    if (SKILLS_API) {
      const result = await SKILLS_API.install(skill.repo, skill.id)
      if (result.ok) {
        await loadInstalledSkills()
      } else {
        setInstallError(result.output || 'Error al instalar la skill')
      }
    } else {
      // Web fallback: add to store directly
      useSkillStore.getState().addSkill(
        skill.name,
        skill.description,
        skill.prompt || skill.description,
        skill.tags,
        skill.category
      )
    }

    setInstalling(null)
  }

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            className="w-full py-1.5 pl-7 pr-2.5 text-[11.5px] bg-input border border-border-normal rounded-md text-primary font-ui outline-none"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-3 py-1 text-[10.5px] font-ui border-none rounded-sm cursor-pointer transition-all ${
              category === cat.value
                ? 'bg-accent text-white'
                : 'bg-active text-secondary hover:bg-hover'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {installError && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-destructive/10 text-destructive text-[11px] font-ui rounded-md">
          <AlertCircle size={12} strokeWidth={1.5} />
          {installError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <AlertCircle size={20} strokeWidth={1.5} />
          <div className="text-xs font-ui">No se encontraron skills con esos filtros.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {REPOS.map((repo) => {
            const repoSkills = filtered.filter((s) => s.repo === repo.repo)
            if (repoSkills.length === 0) return null
            return (
              <div key={repo.repo}>
                <div className="flex items-center gap-1.5 mb-2 px-0.5">
                  <ExternalLink size={11} className="text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-ui">
                    {repo.label}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
                  {repoSkills.map((skill) => (
                    <div key={skill.id} className="relative">
                      <SkillCard
                        skill={skill}
                        installed={skill.installed}
                        isDownloadable
                        onInstall={() => handleInstall(skill)}
                      />
                      {installing === skill.id && (
                        <div className="absolute inset-0 bg-black/20 rounded-md flex items-center justify-center z-10">
                          <div className="w-4 h-4 border-2 border-border-normal border-t-accent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-4 px-3.5 py-2.5 bg-input border border-border-subtle rounded-md">
        <span className="text-[10.5px] text-muted-foreground font-ui">
          {allSkills.length} skills disponibles · {allSkills.filter((s) => s.installed).length} instaladas
        </span>
      </div>
    </div>
  )
}
