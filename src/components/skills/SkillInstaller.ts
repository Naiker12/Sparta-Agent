import type { DownloadableSkill } from '@/types'
import { useSkillStore } from '@/stores/skill.store'

export async function fetchAvailableSkills(): Promise<DownloadableSkill[]> {
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
  return useSkillStore.getState().skills.some((s) => s.id === skillId)
}

export function installSkill(skill: DownloadableSkill): string | null {
  const store = useSkillStore.getState()
  if (store.skills.some((s) => s.id === skill.id)) return null

  const id = store.addSkill(skill.name, skill.description, skill.prompt, skill.tags)
  return id
}
