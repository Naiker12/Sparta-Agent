import { useMemo } from 'react'

export interface LocalSkill {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  icon: string
  version: string
  author: string
  source: string
  featured: boolean
}

const FM_RE = /^---\s*\n(.*?)\n---/s

function parseFrontmatter(text: string): Record<string, unknown> {
  const m = FM_RE.exec(text)
  if (!m) return {}
  const raw = m[1]
  const meta: Record<string, unknown> = {}
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val: unknown = line.slice(idx + 1).trim()
    let processedVal: string | boolean | string[] = val as string
    if (typeof val === 'string') {
      const cleaned = val.replace(/^["']\s*|\s*["']$/g, '')
      if (cleaned === 'true') processedVal = true
      else if (cleaned === 'false') processedVal = false
      else if (cleaned.startsWith('[')) {
        processedVal = cleaned.slice(1, -1).split(',').map((t: string) => t.trim().replace(/["']/g, '')).filter(Boolean)
      } else {
        processedVal = cleaned
      }
    }
    if (key) meta[key] = processedVal
  }
  return meta
}

const skillModules = import.meta.glob('../../skills/**/SKILL.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function formatSkillName(raw: string): string {
  if (!raw.includes('-') && !raw.includes('_')) {
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  return raw
    .split(/[-_]/)
    .map((w) => {
      if (w.toLowerCase() === 'api') return 'API'
      if (w.toLowerCase() === 'ai') return 'AI'
      if (w.toLowerCase() === 'ci') return 'CI'
      if (w.toLowerCase() === 'cd') return 'CD'
      if (w.toLowerCase() === 'ui') return 'UI'
      if (w.toLowerCase() === 'pr') return 'PR'
      if (w.toLowerCase() === 'mcp') return 'MCP'
      if (w.toLowerCase() === 'git') return 'Git'
      if (w.toLowerCase() === 'pdf') return 'PDF'
      if (w.toLowerCase() === 'svg') return 'SVG'
      if (w.toLowerCase() === 'html') return 'HTML'
      if (w.toLowerCase() === 'css') return 'CSS'
      if (w.toLowerCase() === 'json') return 'JSON'
      if (w.toLowerCase() === 'sql') return 'SQL'
      if (w.toLowerCase() === 'llm') return 'LLM'
      if (w.toLowerCase() === 'ocr') return 'OCR'
      if (w.toLowerCase() === 'p5') return 'p5'
      if (w.toLowerCase() === '3d') return '3D'
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

function loadAllSkills(): LocalSkill[] {
  const skills: LocalSkill[] = []

  for (const [filepath, content] of Object.entries(skillModules)) {
    const meta = parseFrontmatter(content)
    const parts = filepath.replace(/\\/g, '/').split('/')
    const dirName = parts[parts.length - 2]
    const parentDir = parts.length >= 4 ? parts[parts.length - 3] : 'skills'

    const categoryMap: Record<string, string> = {
      analysis: 'Analysis', apple: 'Apple', automation: 'Automation',
      'autonomous-ai-agents': 'Autonomous AI Agents', coding: 'Coding',
      creative: 'Creative', 'data-science': 'Data Science', dogfood: 'Dogfood',
      email: 'Email', github: 'GitHub', media: 'Media',
      mlops: 'MLOps', 'note-taking': 'Note Taking', productivity: 'Productivity',
      research: 'Research', 'smart-home': 'Smart Home', 'social-media': 'Social Media',
      'software-development': 'Software Development', writing: 'Writing',
      evaluation: 'MLOps', inference: 'MLOps', models: 'MLOps',
    }

    const iconMap: Record<string, string> = {
      analysis: '\ud83d\udcca', apple: '\ud83c\udf4e', automation: '\u26a1',
      'autonomous-ai-agents': '\ud83e\udd16', coding: '\ud83d\udcbb',
      creative: '\ud83c\udfa8', 'data-science': '\ud83d\udd2c', dogfood: '\ud83d\udc3e',
      email: '\ud83d\udce7', github: '\ud83d\udc19', media: '\ud83c\udfac',
      mlops: '\ud83e\udde0', evaluation: '\ud83e\udde0', inference: '\ud83e\udde0',
      models: '\ud83e\udde0', 'note-taking': '\ud83d\udcdd', productivity: '\ud83d\udcc2',
      research: '\ud83d\udd0d', 'smart-home': '\ud83c\udfe0', 'social-media': '\ud83d\udcf1',
      'software-development': '\ud83d\udee0\ufe0f', writing: '\u270d\ufe0f',
    }

    const rawCategory = (meta.category as string) || categoryMap[parentDir] || parentDir.charAt(0).toUpperCase() + parentDir.slice(1)
    const rawTags = meta.tags as string[] | undefined
    const category = rawCategory

    const rawName = (meta.name as string) || dirName

    const rawIcon = (meta.icon as string) || ''
    const cleanIcon = (rawIcon === '??' || rawIcon.length > 5) ? '' : rawIcon

    skills.push({
      id: (meta.id as string) || dirName,
      name: formatSkillName(rawName),
      description: (meta.description as string) || '',
      category,
      tags: Array.isArray(rawTags) ? rawTags : [category.replace(/\s+/g, '')],
      icon: cleanIcon || iconMap[parentDir] || '\ud83d\udce6',
      version: (meta.version as string) || '1.0.0',
      author: (meta.author as string) || 'Sparta Team',
      source: (meta.source as string) || 'builtin',
      featured: (meta.featured as boolean) || false,
    })
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

let _cached: LocalSkill[] = []
try {
  _cached = loadAllSkills()
} catch (e) {
  console.error('[skills] Failed to load skill index:', e)
}

export function useLocalSkillsLoader() {
  const byCategory = useMemo(() => {
    return _cached.reduce<Record<string, LocalSkill[]>>((acc, skill) => {
      const cat = skill.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(skill)
      return acc
    }, {})
  }, [])

  return {
    skills: _cached,
    byCategory,
    loading: false,
    error: null,
  }
}
