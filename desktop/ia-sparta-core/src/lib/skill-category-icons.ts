export interface CategoryIconPaths {
  light: string
  dark: string
}

export const SKILL_CATEGORY_ICONS: Record<string, CategoryIconPaths> = {
  github: {
    light: '/icons/brands/github.svg',
    dark: '/icons/brands/github.svg',
  },
  notion: {
    light: '/icons/brands/notion.svg',
    dark: '/icons/brands/notion.svg',
  },
  slack: {
    light: '/icons/brands/slack.svg',
    dark: '/icons/brands/slack.svg',
  },
  discord: {
    light: '/icons/brands/discord.svg',
    dark: '/icons/brands/discord.svg',
  },
  git: {
    light: '/icons/brands/git.svg',
    dark: '/icons/brands/git.svg',
  },
  filesystem: {
    light: '/icons/brands/filesystem.svg',
    dark: '/icons/brands/filesystem.svg',
  },
  database: {
    light: '/icons/brands/postgresql.svg',
    dark: '/icons/brands/postgresql.svg',
  },
}

export function getSkillCategoryIconPath(category: string): CategoryIconPaths | null {
  const normalized = category.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (SKILL_CATEGORY_ICONS[normalized]) {
    return SKILL_CATEGORY_ICONS[normalized]
  }
  return null
}
