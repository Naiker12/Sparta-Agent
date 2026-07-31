/**
 * skill-context.ts
 * Lógica de construcción del contexto de Skills para el system prompt.
 */

import { loadSkillDocuments } from 'ia-sparta-ipc-bridge'

const MAX_SKILL_CONTEXT_CHARS = 16_000
const MAX_SKILL_DOCUMENTS_PER_TURN = 4

function getSearchTerms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9_-]{3,}/g) ?? [])]
}

export function buildSkillContext(activeSkillIds: string[] | undefined, userText: string): string {
  if (!activeSkillIds?.length) return ''

  const activeIds = new Set(activeSkillIds)
  const skills = loadSkillDocuments().filter((skill) => activeIds.has(skill.id))
  if (skills.length === 0) return ''

  const manifest = skills
    .map((skill) => `- ${skill.id} | ${skill.category} | ${skill.name}: ${skill.description.slice(0, 180)}`)
    .join('\n')
  const terms = getSearchTerms(userText)
  const relevant = skills
    .map((skill) => {
      const haystack = `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(' ')} ${skill.category}`.toLowerCase()
      return { skill, score: terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, MAX_SKILL_DOCUMENTS_PER_TURN)

  let remaining = Math.max(0, MAX_SKILL_CONTEXT_CHARS - manifest.length)
  const documents = relevant.flatMap(({ skill }) => {
    if (remaining <= 0) return []
    const body = skill.body.slice(0, remaining)
    remaining -= body.length
    return [`\n## Skill: ${skill.name} (${skill.id})\n${body}`]
  })

  return [
    '## Skills disponibles',
    'Estas habilidades estan activas. Usa las instrucciones detalladas solo cuando sean relevantes para la solicitud actual.',
    manifest,
    ...documents,
  ].join('\n')
}
