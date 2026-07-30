import { useMemo } from 'react'

interface SafeSvgProps {
  content: string
  className?: string
}

export function SafeSvg({ content, className }: SafeSvgProps) {
  const sanitized = useMemo(() => {
    const match = content.match(/<svg[\s\S]*?<\/svg>/i)
    if (!match) return null
    return match[0]
  }, [content])

  if (!sanitized) return <span className={className} style={{ color: 'var(--text-danger)' }}>SVG inválido</span>

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    />
  )
}
