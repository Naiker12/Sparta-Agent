export type SkillCategory =
  | 'Analysis'
  | 'Apple'
  | 'Automation'
  | 'Autonomous AI Agents'
  | 'Coding'
  | 'Computer Use'
  | 'Creative'
  | 'Data Science'
  | 'Dogfood'
  | 'Email'
  | 'GitHub'
  | 'Index Cache'
  | 'Media'
  | 'MLOps'
  | 'Note Taking'
  | 'Productivity'
  | 'Research'
  | 'Smart Home'
  | 'Social Media'
  | 'Software Development'
  | 'Writing'
  | 'Yuanbao'

const CATEGORY_INFO: { label: string; value: SkillCategory; icon: string; description: string }[] = [
  { label: 'Analysis', value: 'Analysis', icon: '\uD83D\uDCCA', description: 'Data analysis, business intelligence, and analytical workflows.' },
  { label: 'Apple', value: 'Apple', icon: '\uD83C\uDF4E', description: 'Apple / macOS skills — tools that interact with the Mac desktop (Finder, native apps) or system features.' },
  { label: 'Automation', value: 'Automation', icon: '\uD83E\uDDFB', description: 'Workflow automation, task scheduling, and process orchestration.' },
  { label: 'Autonomous AI Agents', value: 'Autonomous AI Agents', icon: '\uD83E\uDD16', description: 'Skills for spawning and orchestrating autonomous AI coding agents and multi-agent workflows.' },
  { label: 'Coding', value: 'Coding', icon: '\uD83D\uDCBB', description: 'Code writing, review, debugging, testing, and software development.' },
  { label: 'Computer Use', value: 'Computer Use', icon: '\uD83D\uDDA5\uFE0F', description: 'Desktop automation and GUI control — clicking, typing, scrolling, and browser automation.' },
  { label: 'Creative', value: 'Creative', icon: '\uD83C\uDFA8', description: 'Creative content generation — ASCII art, hand-drawn style diagrams, and visual design tools.' },
  { label: 'Data Science', value: 'Data Science', icon: '\uD83D\uDCC8', description: 'Data science workflows — interactive exploration, Jupyter notebooks, data analysis, and visualization.' },
  { label: 'Dogfood', value: 'Dogfood', icon: '\uD83D\uDC3E', description: 'Internal dogfooding skills for testing and development.' },
  { label: 'Email', value: 'Email', icon: '\u2709\uFE0F', description: 'Sending, receiving, searching, and managing email from the terminal.' },
  { label: 'GitHub', value: 'GitHub', icon: '\uD83D\uDCE6', description: 'GitHub workflow skills for managing repositories, pull requests, code reviews, issues, and CI/CD.' },
  { label: 'Index Cache', value: 'Index Cache', icon: '\uD83D\uDCD1', description: 'Search index and cache management skills.' },
  { label: 'Media', value: 'Media', icon: '\uD83C\uDFAC', description: 'Working with media content — YouTube transcripts, GIF search, music generation, and audio visualization.' },
  { label: 'MLOps', value: 'MLOps', icon: '\uD83E\uDD16', description: 'Machine Learning Operations — training, fine-tuning, deploying, and optimizing ML/AI models.' },
  { label: 'Note Taking', value: 'Note Taking', icon: '\uD83D\uDCDD', description: 'Note taking skills, to save information, assist with research, and collaborate.' },
  { label: 'Productivity', value: 'Productivity', icon: '\u26A1', description: 'Document creation, presentations, spreadsheets, and other productivity workflows.' },
  { label: 'Research', value: 'Research', icon: '\uD83D\uDD0D', description: 'Academic research, paper discovery, literature review, domain reconnaissance, and content monitoring.' },
  { label: 'Smart Home', value: 'Smart Home', icon: '\uD83C\uDFE0', description: 'Controlling smart home devices — lights, switches, sensors, and home automation systems.' },
  { label: 'Social Media', value: 'Social Media', icon: '\uD83D\uDCF1', description: 'Interacting with social platforms — posting, reading, monitoring, and account operations.' },
  { label: 'Software Development', value: 'Software Development', icon: '\uD83D\uDEE0\uFE0F', description: 'Full software development lifecycle — planning, debugging, testing, and deployment.' },
  { label: 'Writing', value: 'Writing', icon: '\u270F\uFE0F', description: 'Writing, translation, and content creation skills.' },
  { label: 'Yuanbao', value: 'Yuanbao', icon: '\uD83E\uDE99', description: 'Tencent Yuanbao integration skills.' },
]

export const SKILL_CATEGORIES = CATEGORY_INFO.map(({ label, value, icon }) => ({ label, value, icon }))

export const CATEGORY_DESCRIPTIONS = Object.fromEntries(
  CATEGORY_INFO.map((c) => [c.value, c.description])
) as Record<SkillCategory, string>

/** Normaliza cualquier string a una SkillCategory válida (fallback a la categoría por defecto). */
export function normalizeCategory(raw: string | undefined | null, defaultCat: SkillCategory = 'Productivity'): SkillCategory {
  if (!raw) return defaultCat
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, ' ')
  const match = CATEGORY_INFO.find(
    (c) => c.value.toLowerCase() === normalized.toLowerCase()
  )
  return match?.value ?? defaultCat
}

/** Formatea un string de categoría para display bonito. */
export function formatCategoryLabel(raw: string | undefined | null): string {
  if (!raw) return 'Productivity'
  const cat = CATEGORY_INFO.find(
    (c) => c.value.toLowerCase() === raw.toLowerCase().replace(/-/g, ' ')
  )
  return cat?.label ?? raw
}

export type SkillSource = 'builtin' | 'legacy' | 'user' | 'system'

export type TrustLevel = 'builtin' | 'system' | 'installed' | 'quarantined'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Skill {
  id: string
  name: string
  description: string
  prompt: string
  icon?: string
  tags?: string[]
  category?: SkillCategory
  version?: string
  author?: string
  source?: SkillSource
  featured?: boolean
  isTemplate?: boolean
  createdAt: number
}

export interface DownloadableSkill {
  id: string
  name: string
  description: string
  version: string
  author: string
  icon: string
  tags: string[]
  category: SkillCategory
  prompt: string
  featured: boolean
  source?: SkillSource
  installed?: boolean
}

export interface InstalledSkill {
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
  trustLevel?: TrustLevel
  installedAt?: number
}

export interface SkillViewResult {
  metadata: Record<string, unknown>
  body: string
  source_path: string
}

export interface SkillScanResult {
  passed: boolean
  warnings: string[]
  risk_score: number
  risk_level: RiskLevel
}
