import { useTheme } from 'ia-sparta-core'
import { BRAND_ICONS, MONO_BRANDS } from 'ia-sparta-core'

interface BrandIconProps {
  vendor: string
  size?: number
  className?: string
}

export function BrandIcon({ vendor, size = 16, className }: BrandIconProps) {
  const { isDark } = useTheme()
  const entry = BRAND_ICONS[vendor]

  if (!entry) return null

  const src = isDark ? entry.dark : entry.light
  const isMono = MONO_BRANDS.includes(vendor)

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
