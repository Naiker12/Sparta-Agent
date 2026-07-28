import React from 'react'
import { useTheme } from 'ia-sparta-core'
import { getSkillCategoryIconPath } from 'ia-sparta-core'
import {
  Apple,
  Code,
  Brain,
  Bot,
  Zap,
  BarChart3,
  Search,
  PenTool,
  Home,
  Palette,
  Mail,
  Film,
  Share2,
  Folder,
  Layers,
  Wrench,
  Sparkles,
  Monitor,
} from 'lucide-react'

export interface SkillCategoryIconProps {
  category: string
  size?: number
  strokeWidth?: number
  className?: string
}

/**
 * Lucide fallback icons for skill categories that don't have a brand SVG.
 * Keys are normalized: lowercase, spaces->hyphens, non-alphanumeric stripped.
 */
const FALLBACK_CATEGORY_LUCIDE_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  'analysis': BarChart3,
  'apple': Apple,
  'automation': Zap,
  'autonomous-ai-agents': Bot,
  'coding': Code,
  'creative': Palette,
  'data-science': Brain,
  'desktop': Monitor,
  'email': Mail,
  'media': Film,
  'mlops': Sparkles,
  'note-taking': PenTool,
  'productivity': Folder,
  'research': Search,
  'smart-home': Home,
  'social-media': Share2,
  'software-development': Wrench,
  'writing': PenTool,
}

export function SkillCategoryIcon({ category, size = 16, strokeWidth = 2.2, className }: SkillCategoryIconProps) {
  const { isDark } = useTheme()
  const iconPaths = getSkillCategoryIconPath(category)

  if (iconPaths) {
    const rawSrc = isDark ? iconPaths.dark : iconPaths.light
    const src = rawSrc.startsWith('/') ? `.${rawSrc}` : rawSrc
    return (
      <img
        src={src}
        alt={category}
        width={size}
        height={size}
        className={`shrink-0 object-contain transition-opacity duration-150 ${className ?? ''}`}
        draggable={false}
      />
    )
  }

  const normalized = category ? category.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
  const LucideIcon = FALLBACK_CATEGORY_LUCIDE_ICONS[normalized] ?? Layers

  return <LucideIcon size={size} strokeWidth={strokeWidth} className={`shrink-0 text-current opacity-90 ${className ?? ''}`} />
}
