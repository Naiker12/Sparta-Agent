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
  git: {
    light: '/icons/brands/git.svg',
    dark: '/icons/brands/git.svg',
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
  figma: {
    light: '/icons/brands/figma.svg',
    dark: '/icons/brands/figma.svg',
  },
  mongodb: {
    light: '/icons/brands/mongodb.svg',
    dark: '/icons/brands/mongodb.svg',
  },
  postgresql: {
    light: '/icons/brands/postgresql.svg',
    dark: '/icons/brands/postgresql.svg',
  },
  postgres: {
    light: '/icons/brands/postgresql.svg',
    dark: '/icons/brands/postgresql.svg',
  },
  sqlite: {
    light: '/icons/brands/sqlite.svg',
    dark: '/icons/brands/sqlite.svg',
  },
  stripe: {
    light: '/icons/brands/stripe.svg',
    dark: '/icons/brands/stripe.svg',
  },
  supabase: {
    light: '/icons/brands/supabase.svg',
    dark: '/icons/brands/supabase.svg',
  },
  telegram: {
    light: '/icons/brands/telegram.svg',
    dark: '/icons/brands/telegram.svg',
  },
  whatsapp: {
    light: '/icons/brands/whatsapp-icon.svg',
    dark: '/icons/brands/whatsapp-icon.svg',
  },
  playwright: {
    light: '/icons/brands/playwright.svg',
    dark: '/icons/brands/playwright.svg',
  },
  puppeteer: {
    light: '/icons/brands/puppeteer.svg',
    dark: '/icons/brands/puppeteer.svg',
  },
  filesystem: {
    light: '/icons/brands/filesystem.svg',
    dark: '/icons/brands/filesystem.svg',
  },
  memory: {
    light: '/icons/brands/memory.svg',
    dark: '/icons/brands/memory.svg',
  },
  fetch: {
    light: '/icons/brands/fetch.svg',
    dark: '/icons/brands/fetch.svg',
  },
  sentry: {
    light: '/icons/brands/sentry.svg',
    dark: '/icons/brands/sentry.svg',
  },
  perplexity: {
    light: '/icons/brands/perplexity.svg',
    dark: '/icons/brands/perplexity.svg',
  },
  chrome: {
    light: '/icons/brands/chrome.svg',
    dark: '/icons/brands/chrome.svg',
  },
  microsoft: {
    light: '/icons/brands/microsoft.svg',
    dark: '/icons/brands/microsoft.svg',
  },
  azure: {
    light: '/icons/brands/azure.svg',
    dark: '/icons/brands/azure.svg',
  },
}

export function getSkillCategoryIconPath(category: string): CategoryIconPaths | null {
  const normalized = category.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (SKILL_CATEGORY_ICONS[normalized]) {
    return SKILL_CATEGORY_ICONS[normalized]
  }
  return null
}
