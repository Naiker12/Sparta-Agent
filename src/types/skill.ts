export type SkillCategory = 'Coding' | 'Research' | 'Writing' | 'Analysis' | 'Automation'

export type SkillSource = 'builtin' | 'legacy' | 'user'

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
