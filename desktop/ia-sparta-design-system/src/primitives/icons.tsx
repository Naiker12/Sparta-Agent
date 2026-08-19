import React from 'react'
export * from '@hugeicons/react'

/**
 * Helper component for unified icon sizing and color with Sparta design tokens
 */
export function SpartaIcon({
  icon: IconComponent,
  size = 16,
  color = 'currentColor',
  className,
  style,
}: {
  icon: React.ComponentType<{ size?: string | number; color?: string; className?: string; style?: React.CSSProperties }>
  size?: number | string
  color?: string
  className?: string
  style?: React.CSSProperties
}) {
  return <IconComponent size={size} color={color} className={className} style={style} />
}
