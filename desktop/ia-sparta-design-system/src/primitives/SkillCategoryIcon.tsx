import { useTheme } from 'ia-sparta-core'
import { getSkillCategoryIconPath } from 'ia-sparta-core'
import {
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
} from 'lucide-react'

interface SkillCategoryIconProps {
  category: string
  size?: number
  className?: string
}

const FALLBACK_CATEGORY_LUCIDE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'analysis': BarChart3,
  'automation': Zap,
  'autonomous-ai-agents': Bot,
  'coding': Code,
  'creative': Palette,
  'data-science': Brain,
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

export function SkillCategoryIcon({ category, size = 16, className }: SkillCategoryIconProps) {
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
        className={`shrink-0 object-contain ${className ?? ''}`}
        draggable={false}
      />
    )
  }

  const normalized = category.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const LucideIcon = FALLBACK_CATEGORY_LUCIDE_ICONS[normalized] ?? Layers

  return <LucideIcon size={size} className={`shrink-0 text-muted-foreground ${className ?? ''}`} />
}
