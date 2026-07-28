export interface CategoryIconPaths {
  light: string
  dark: string
}

/**
 * SVG icon registry for skill categories that have a recognizable brand logo.
 * Keys MUST match the normalized category name (lowercase, spaces→hyphens).
 * Categories without a brand logo (Analysis, Coding, etc.) fall through to
 * the Lucide fallback map in SkillCategoryIcon.tsx — that's intentional.
 */
export const SKILL_CATEGORY_ICONS: Record<string, CategoryIconPaths> = {
  github: {
    light: '/icons/brands/github.svg',
    dark: '/icons/brands/github.svg',
  },
}

export function getSkillCategoryIconPath(category: string): CategoryIconPaths | null {
  const normalized = category.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (SKILL_CATEGORY_ICONS[normalized]) {
    return SKILL_CATEGORY_ICONS[normalized]
  }
  return null
}
