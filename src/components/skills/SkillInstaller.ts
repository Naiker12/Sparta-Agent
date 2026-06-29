import type { DownloadableSkill, SkillCategory } from '@/types'
import { useSkillStore } from '@/stores/skill.store'

interface SkillManifestEntry {
  id: string
  name: string
  description: string
  version?: string
  author?: string
  icon?: string
  tags?: string[]
  category?: SkillCategory
  featured?: boolean
  source?: string
}

const SKILLS_API = typeof window !== 'undefined' && (window as any).skills

export async function fetchAvailableSkills(): Promise<DownloadableSkill[]> {
  if (SKILLS_API) {
    try {
      const list: SkillManifestEntry[] = await SKILLS_API.list()
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version || '1.0.0',
        author: s.author || 'Sparta Team',
        icon: s.icon || '\uD83D\uDCE6',
        tags: s.tags || [],
        category: (s.category || 'Coding') as DownloadableSkill['category'],
        prompt: s.description || '',
        featured: s.featured || false,
        source: (s.source || 'builtin') as DownloadableSkill['source'],
        installed: useSkillStore.getState().installedSkills.some((is) => is.id === s.id) ||
          useSkillStore.getState().skills.some((sk) => sk.id === s.id),
      }))
    } catch {
      // fall through to HTTP
    }
  }

  try {
    const res = await fetch('/skills/manifest.json')
    if (!res.ok) throw new Error('Failed to fetch skills manifest')
    const manifest: { version: string; skills: string[] } = await res.json()

    const results = await Promise.allSettled(
      manifest.skills.map(async (id) => {
        const skillRes = await fetch(`/skills/${id}.skill.json`)
        if (!skillRes.ok) throw new Error(`Failed to fetch skill ${id}`)
        return (await skillRes.json()) as DownloadableSkill
      })
    )

    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<DownloadableSkill>).value)
  } catch {
    return []
  }
}

export function isSkillInstalled(skillId: string): boolean {
  const store = useSkillStore.getState()
  return store.skills.some((s) => s.id === skillId) ||
    store.installedSkills.some((s) => s.id === skillId)
}

export function installSkill(skill: DownloadableSkill): string | null {
  const store = useSkillStore.getState()
  if (store.skills.some((s) => s.id === skill.id)) return null

  const id = store.addSkill(
    skill.name,
    skill.description,
    skill.prompt || skill.description,
    skill.tags,
    skill.category
  )
  return id
}
