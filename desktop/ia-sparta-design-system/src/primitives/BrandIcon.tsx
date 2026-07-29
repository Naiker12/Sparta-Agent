import { useTheme } from 'ia-sparta-core'
import { BRAND_ICONS, MONO_BRANDS } from 'ia-sparta-core'

interface BrandIconProps {
  vendor: string
  size?: number
  className?: string
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  DevTools: 'git',
  Storage: 'filesystem',
  Database: 'database',
  Productivity: 'notion',
  Web: 'fetch',
  Knowledge: 'memory',
  Utility: 'time',
  Comunicación: 'slack',
  Diseño: 'figma',
  Pagos: 'stripe',
  Monitoreo: 'sentry',
}

export function BrandIcon({ vendor, size = 16, className }: BrandIconProps) {
  const { isDark } = useTheme()
  const resolvedVendor = BRAND_ICONS[vendor] ? vendor : (CATEGORY_FALLBACKS[vendor] ?? 'filesystem')
  const entry = BRAND_ICONS[resolvedVendor]

  if (!entry) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="9" x2="15" y2="15" />
        <line x1="15" y1="9" x2="9" y2="15" />
      </svg>
    )
  }

  const rawSrc = isDark ? entry.dark : entry.light
  const src = rawSrc.startsWith('/') ? `.${rawSrc}` : rawSrc
  const isMono = MONO_BRANDS.includes(resolvedVendor)

  return (
    <img
      src={src}
      alt={vendor}
      width={size}
      height={size}
      className={`brand-icon${isMono ? ' brand-icon-mono' : ''}${className ? ` ${className}` : ''}`}
      draggable={false}
      style={{
        flexShrink: 0,
        objectFit: 'contain',
      }}
    />
  )
}
