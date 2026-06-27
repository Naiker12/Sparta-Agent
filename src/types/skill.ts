export type SkillCategory = 'Coding' | 'Research' | 'Writing' | 'Analysis' | 'Automation'

export interface Skill {
  id: string
  name: string
  description: string
  prompt: string
  icon?: string
  tags?: string[]
  createdAt: number
  isTemplate?: boolean
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
  installed?: boolean
}
